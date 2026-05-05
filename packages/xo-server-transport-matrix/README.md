<!-- DO NOT EDIT MANUALLY, THIS FILE HAS BEEN GENERATED -->

# xo-server-transport-matrix

> xo-server plugin to send messages to Matrix rooms

## Usage

Like all other xo-server plugins, it can be configured directly via
the web interface, see [the plugin documentation](https://docs.xen-orchestra.com/architecture#plugins). You can also test the configuration to verify it works.

### Matrix

#### Get Your Access Token

1. Log in to your Matrix account on your homeserver
2. Open the application settings (usually in your client like Element)
3. Navigate to the security/sessions section
4. Create a new access token or use an existing one
5. Copy the access token (keep it secure!)

#### Configure the Plugin

The plugin requires the following information:

- **Homeserver URL**: The full URL of your Matrix homeserver (e.g., `https://matrix.org`)
- **Access Token**: The access token for authentication
  - This is all you need to configure the transport plugin
  - Room IDs will be specified by other plugins (like perf-alert) that use this transport

## Contributions

Contributions are _very_ welcomed, either on the documentation or on
the code.

You may:

- report any [issue](https://github.com/vatesfr/xen-orchestra/issues)
  you've encountered;
- fork and create a pull request.

## License

[AGPL-3.0-or-later](https://spdx.org/licenses/AGPL-3.0-or-later) © [Vates SAS](https://vates.fr)
