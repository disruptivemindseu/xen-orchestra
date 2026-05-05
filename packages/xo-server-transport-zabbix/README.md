<!-- DO NOT EDIT MANUALLY, THIS FILE HAS BEEN GENERATED -->

# xo-server-transport-zabbix

> Send backup health status to Zabbix with PSK authentication

## Overview

The Zabbix transport plugin integrates Xen Orchestra backup health monitoring with Zabbix. It sends backup status to a Zabbix host using the **Trapper protocol** with **PSK (Pre-Shared Key)** authentication for secure communication.

## Key Features

- **Secure PSK Authentication**: Uses Pre-Shared Key for encrypted communication with Zabbix
- **Simple Protocol**: Lightweight Zabbix Trapper protocol, no API credentials needed
- **Flexible Item Keys**: Supports any item key name (configured by calling plugins)
- **Connection Testing**: Built-in test to verify Zabbix connectivity
- **Low Overhead**: Efficient TCP protocol suitable for frequent updates

## Requirements

- Zabbix server version 5.0 or higher
- PSK configured on Zabbix server
- Network access from Xen Orchestra to Zabbix Trapper port (default: 10051)
- A Zabbix host to receive status updates (e.g., "XOA")

## Usage

Like all other xo-server plugins, it can be configured directly via
the web interface, see [the plugin documentation](https://docs.xen-orchestra.com/architecture#plugins).

### Configuration

The plugin requires:

1. **Zabbix Server**: Hostname or IP of your Zabbix server
2. **Port**: Zabbix Trapper port (default: 10051)
3. **Host**: Zabbix host name (default: "XOA")
4. **PSK Identity**: PSK identity configured in Zabbix (e.g., "PSK_SENDER_001")
5. **PSK Value**: PSK as hex string (e.g., "a1b2c3d4...")

For detailed setup instructions, see [.USAGE.md](.USAGE.md).

### API Method

#### `Xo#sendZabbixEvent( { status, message }, key )`

This xo method sends backup status to a Zabbix item.

**Parameters:**

- `status`: Backup status (0: OK | 1: WARNING | 2: CRITICAL)
- `message`: Status description (optional)
- `key`: Zabbix item key to send value to (required, specified by calling plugin)

**Example:**

```javascript
// Send backup success to backup.health item
await xo.sendZabbixEvent(
  {
    status: 0,
    message: 'All backups completed successfully'
  },
  'backup.health'
)

// Send backup failure
await xo.sendZabbixEvent(
  {
    status: 2,
    message: 'Critical: backup job failed'
  },
  'backup.health'
)
```

### Test Connection

#### `Xo#testZabbixConnection()`

Tests connectivity to the Zabbix server.

**Example:**

```javascript
try {
  const result = await xo.testZabbixConnection()
  console.log('Connected to Zabbix:', result.message)
} catch (error) {
  console.error('Failed to connect:', error.message)
}
```

## Status Values

| Value | Meaning |
|-------|---------|
| 0 | OK - Successful |
| 1 | WARNING - Completed with issues |
| 2 | CRITICAL - Failed |

## Contributions

Contributions are _very_ welcomed, either on the documentation or on
the code.

You may:

- report any [issue](https://github.com/vatesfr/xen-orchestra/issues)
  you've encountered;
- fork and create a pull request.

## License

[AGPL-3.0-or-later](https://spdx.org/licenses/AGPL-3.0-or-later) © [Vates SAS](https://vates.fr)
