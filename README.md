# CloudVoyager

Migrate your data from self-hosted SonarQube to SonarCloud — no re-scanning needed.

## How It Works

This tool copies your projects, issues, metrics, and source code from SonarQube and uploads them to SonarCloud in the format it expects.

## Quick Start

### 1. Download

Download the latest binary for your platform from the [Releases](https://github.com/joshuaquek/cloudvoyager/releases) page:

| Platform | Binary |
|----------|--------|
| macOS (Apple Silicon) | `cloudvoyager-macos-arm64` |
| macOS (Intel) | `cloudvoyager-macos-x64` |
| Linux (x64) | `cloudvoyager-linux-x64` |
| Linux (ARM64) | `cloudvoyager-linux-arm64` |
| Windows (x64) | `cloudvoyager-win-x64.exe` |

Make the binary executable (macOS/Linux):

```bash
chmod +x cloudvoyager-*
```

### 2. Create a config file

You'll need API tokens from both SonarQube and SonarCloud - Ensure that you have **Admin Access** to both your SonarQube Server and SonarCloud organization, and that you have API tokens for both.

Create a `config.json` file with your details:

```json
{
  "sonarqube": {
    "url": "https://your-sonarqube-server.com",
    "token": "your_sonarqube_token",
    "projectKey": "your-project-key"
  },
  "sonarcloud": {
    "url": "https://sonarcloud.io",
    "token": "your_sonarcloud_token",
    "organization": "your-org",
    "projectKey": "your-project-key"
  }
}
```

### 3. Test your connections

```bash
./cloudvoyager test -c config.json
```

### 4. Run the transfer

```bash
./cloudvoyager transfer -c config.json
```

That's it! Your data will appear in SonarCloud once the transfer completes.

## All Commands

| Command | What it does |
|---------|-------------|
| `test` | Check that both servers are reachable |
| `validate` | Check your config file for errors |
| `transfer` | Run the migration |
| `status` | See what's been synced so far |
| `reset` | Clear sync history and start fresh |

Add `--verbose` to any command for more detail.

```bash
./cloudvoyager transfer -c config.json --verbose
```

## Limitations
- Each project's past historical metrics (purely just historical metrics and not the actual issues itself), found in each project's **Activity** tab in the SonarQube Dashboard Web UI, cannot be migrated.


## Further Reading

- [Configuration Guide](docs/configuration.md) — all config options, env vars, incremental transfers
- [Architecture](docs/architecture.md) — project structure, data flow, report format
- [Technical Details](docs/technical-details.md) — protobuf encoding, measure types, active rules
- [Troubleshooting](docs/troubleshooting.md) — common errors and fixes

## License

MIT
