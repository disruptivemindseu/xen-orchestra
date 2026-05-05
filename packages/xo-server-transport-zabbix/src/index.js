import net from 'net'
import crypto from 'crypto'
import { createLogger } from '@xen-orchestra/log'

const { debug, warn } = createLogger('xo:server:transport:zabbix')

// ===================================================================

export const configurationSchema = {
  type: 'object',
  properties: {
    server: {
      type: 'string',
      description: 'The Zabbix server address (e.g., zabbix.example.com)',
    },
    port: {
      type: 'integer',
      default: 10051,
      description: 'The Zabbix Trapper port (default: 10051)',
    },
    host: {
      type: 'string',
      default: 'XOA',
      description: 'The Zabbix host name that will receive backup status (default: XOA)',
    },
    pskIdentity: {
      type: 'string',
      description: 'PSK identity (e.g., "PSK_SENDER_001"). Leave empty for no PSK authentication.',
    },
    pskValue: {
      type: 'string',
      description: 'PSK value as hex string (e.g., a1b2c3d4...). Leave empty for no PSK authentication.',
    },
  },
  additionalProperties: false,
  required: ['server'],
}

// ===================================================================

export const OK = 0
export const WARNING = 1
export const CRITICAL = 2

class XoServerTransportZabbix {
  constructor({ xo }) {
    this._sendZabbix = this._sendZabbix.bind(this)
    this._testConnection = this._testConnection.bind(this)
    this._set = xo.defineProperty.bind(xo)
    this._unsets = []
    this._conf = null
    this._pskValue = null
  }

  configure(configuration) {
    debug('Configuring transport-zabbix with:', {
      server: configuration.server,
      port: configuration.port,
      host: configuration.host,
      pskIdentity: configuration.pskIdentity ? '***' : undefined,
      pskValueLength: configuration.pskValue ? configuration.pskValue.length : 0,
    })

    this._conf = {
      server: configuration.server,
      port: configuration.port || 10051,
      host: configuration.host || 'XOA',
      pskIdentity: configuration.pskIdentity || undefined,
      pskValue: configuration.pskValue || undefined,
    }

    // Reset PSK
    this._pskValue = null

    // Convert PSK hex string to buffer only if both identity and value are provided
    if (this._conf.pskValue && this._conf.pskIdentity) {
      try {
        this._pskValue = Buffer.from(this._conf.pskValue, 'hex')
        debug(`PSK configured (${this._conf.pskValue.length} hex characters)`)
      } catch (error) {
        warn(`Failed to parse PSK value: ${error.message}`)
        this._pskValue = null
      }
    } else if (this._conf.pskValue || this._conf.pskIdentity) {
      warn('PSK partially configured: both identity and value are required')
    } else {
      debug('No PSK configured - using unencrypted connection')
    }
  }

  load() {
    this._unsets.push(this._set('sendZabbixEvent', this._sendZabbix))
    this._unsets.push(this._set('testZabbixConnection', this._testConnection))
  }

  unload() {
    this._unsets.forEach(unset => unset())
    this._unsets = []
  }

  test(data) {
    debug('Test called with data:', data)
    debug('Test configuration:', {
      server: this._conf?.server,
      port: this._conf?.port,
      host: this._conf?.host,
      pskIdentity: this._conf?.pskIdentity,
      hasPskValue: !!this._pskValue,
    })
    return this._testConnection()
  }

  async _testConnection() {
    if (!this._conf || !this._conf.server) {
      const msg = 'No server configured'
      warn(msg)
      throw new Error(msg)
    }

    debug(`Starting test connection to ${this._conf.server}:${this._conf.port}`)

    try {
      const clock = Math.floor(Date.now() / 1000)
      await this._sendTrapperData(
        this._conf.host,
        'xoa.test.connection',
        '1',
        clock
      )
      return { success: true, message: 'Successfully sent test data to Zabbix server' }
    } catch (error) {
      warn(`Test failed: ${error.message}`)
      throw error
    }
  }

  _computePSKHash(identity, psk) {
    // Compute the PSK hash used in Zabbix protocol
    // Format: MD5(identity_bytes + psk_bytes)
    const identityBuffer = Buffer.from(identity, 'utf-8')
    const combined = Buffer.concat([identityBuffer, psk])
    return crypto.createHash('md5').update(combined).digest()
  }

  _sendTrapperData(host, key, value, clock) {
    return new Promise((resolve, reject) => {
      const data = {
        request: 'sender data',
        data: [
          {
            host,
            key,
            value,
            clock,
          },
        ],
      }

      const payload = JSON.stringify(data)
      const dataBuffer = Buffer.from(payload, 'utf-8')

      debug(`Payload: ${payload}`)

      // Build packet: ZBXD\1 + length(8 bytes) + PSK hash (if configured) + data
      const header = Buffer.alloc(5)
      header.write('ZBXD')
      header[4] = 1 // Protocol version

      const lengthBuffer = Buffer.alloc(8)

      let packet
      if (this._pskValue && this._conf.pskIdentity) {
        debug('Using PSK authentication')
        const pskHash = this._computePSKHash(this._conf.pskIdentity, this._pskValue)
        const totalDataLength = pskHash.length + dataBuffer.length
        lengthBuffer.writeUInt32LE(totalDataLength, 0)
        packet = Buffer.concat([header, lengthBuffer, pskHash, dataBuffer])
        debug(`Sending PSK-encrypted packet to Zabbix (data: ${dataBuffer.length} bytes, PSK hash: ${pskHash.length} bytes, packet size: ${packet.length})`)
      } else {
        if (this._pskValue && !this._conf.pskIdentity) {
          warn('PSK value provided but PSK identity is missing')
        }
        debug('Sending unencrypted packet (no PSK configured)')
        lengthBuffer.writeUInt32LE(dataBuffer.length, 0)
        packet = Buffer.concat([header, lengthBuffer, dataBuffer])
        debug(`Sending unencrypted packet to Zabbix (packet size: ${packet.length})`)
      }

      debug(`Packet hex: ${packet.toString('hex')}`)

      const socket = net.createConnection(this._conf.port, this._conf.server)

      socket.on('connect', () => {
        debug(
          `Connected to Zabbix server ${this._conf.server}:${this._conf.port} for data send`
        )
        socket.write(packet, err => {
          if (err) {
            warn(`Failed to write packet: ${err.message}`)
            reject(err)
          } else {
            debug('Packet written successfully')
          }
        })
      })

      socket.on('data', responseData => {
        debug(`Zabbix server response (${responseData.length} bytes): ${responseData.toString()}`)
        socket.destroy()
        resolve(responseData)
      })

      socket.on('end', () => {
        debug('Socket end event received')
      })

      socket.on('error', error => {
        warn(`Failed to send to Zabbix: ${error.message}`)
        reject(error)
      })

      socket.on('timeout', () => {
        warn('Zabbix connection timeout')
        socket.destroy()
        reject(new Error('Zabbix server connection timeout'))
      })

      socket.setTimeout(5000)
    })
  }

  _statusToValue(status) {
    // Convert status to a numeric value
    // OK (0) -> 0, WARNING (1) -> 1, CRITICAL (2) -> 2
    return String(status)
  }

  async _sendZabbix({ message, status }, key) {
    try {
      if (!key) {
        throw new Error('Item key is required')
      }

      const clock = Math.floor(Date.now() / 1000)
      const value = this._statusToValue(status)

      debug(
        `Sending backup status to Zabbix: host=${this._conf.host}, key=${key}, value=${value}, message=${message}`
      )

      await this._sendTrapperData(this._conf.host, key, value, clock)
      return { success: true }
    } catch (error) {
      warn(`Failed to send backup status to Zabbix: ${error.message}`)
      throw error
    }
  }
}

export default opts => new XoServerTransportZabbix(opts)
