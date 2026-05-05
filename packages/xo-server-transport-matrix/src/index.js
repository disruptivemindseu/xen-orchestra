import * as matrix from 'matrix-js-sdk'

// ===================================================================

const logAndRethrow = error => {
  console.error('[WARN] plugin transport-matrix:', (error != null && error.stack) || error)

  throw error
}

// ===================================================================

export const configurationSchema = {
  type: 'object',
  properties: {
    homeserver: {
      type: 'string',
      description: 'The Matrix homeserver URL (e.g., https://matrix.org).',
    },
    accessToken: {
      type: 'string',
      description: 'The access token for the user.',
    },
  },
  additionalProperties: false,
  required: ['homeserver', 'accessToken'],
}

export const testSchema = {
  type: 'object',
  properties: {
    roomId: {
      type: 'string',
      description: 'The Matrix room ID to test (e.g., !abc123:matrix.org).',
    },
  },
  additionalProperties: false,
  required: ['roomId'],
}

// ===================================================================

class XoServerTransportMatrix {
  constructor({ xo }) {
    this._sendMatrix = this._sendMatrix.bind(this)
    this._set = xo.defineProperty.bind(xo)
    this._unset = null

    // Defined in configure().
    this._client = null
  }

  configure({ homeserver, accessToken }) {
    this._client = matrix.createClient({
      baseUrl: homeserver,
      accessToken,
      deviceId: 'xo-server-bot',
    })
  }

  load() {
    this._unset = this._set('sendMatrixMessage', this._sendMatrix)
  }

  unload() {
    this._unset()
  }

  test({ roomId }) {
    return this._sendMatrix({
      message: `Hi there,

The transport-matrix plugin for Xen Orchestra server seems to be working fine, nicely done :)`,
      roomId,
    })
  }

  async _sendMatrix({ message, roomId, content }) {
    try {
      if (content) {
        await this._client.sendEvent(roomId, 'm.room.message', content)
      } else {
        await this._client.sendTextMessage(roomId, message)
      }
    } catch (error) {
      return logAndRethrow(error)
    }
  }
}

export default opts => new XoServerTransportMatrix(opts)
