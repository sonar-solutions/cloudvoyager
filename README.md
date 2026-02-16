# CloudVoyager

Migrate your data from self-hosted SonarQube to SonarCloud — no re-scanning needed.

## How It Works

This tool copies your projects, issues, metrics, and source code from SonarQube and uploads them to SonarCloud in the format it expects.

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Create a config file

Copy the example and fill in your details:

```bash
cp examples/config.example.json config.json
```

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

You'll need API tokens from both SonarQube and SonarCloud.

### 3. Test your connections

```bash
node src/index.js test -c config.json
```

### 4. Run the transfer

```bash
node src/index.js transfer -c config.json
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

## Further Reading

- [Configuration Guide](docs/configuration.md) — all config options, env vars, incremental transfers
- [Architecture](docs/architecture.md) — project structure, data flow, report format
- [Technical Details](docs/technical-details.md) — protobuf encoding, measure types, active rules
- [Troubleshooting](docs/troubleshooting.md) — common errors and fixes

## License

MIT
