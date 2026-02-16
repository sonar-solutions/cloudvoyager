# Configuration

## Config File

Create a `config.json` file:

```json
{
  "sonarqube": {
    "url": "https://sonarqube.example.com",
    "token": "sqp_your_sonarqube_token_here",
    "projectKey": "my-project-key"
  },
  "sonarcloud": {
    "url": "https://sonarcloud.io",
    "token": "your_sonarcloud_token_here",
    "organization": "my-organization",
    "projectKey": "my-project-key"
  },
  "transfer": {
    "mode": "incremental",
    "stateFile": "./.cloudvoyager-state.json",
    "batchSize": 100
  }
}
```

See `examples/config.example.json` for a complete example.

## Configuration Options

### SonarQube Settings
| Option | Description |
|--------|-------------|
| `url` | SonarQube server URL |
| `token` | SonarQube API token (or set via `SONARQUBE_TOKEN` env var) |
| `projectKey` | Project key to export |

### SonarCloud Settings
| Option | Description |
|--------|-------------|
| `url` | SonarCloud server URL (default: `https://sonarcloud.io`) |
| `token` | SonarCloud API token (or set via `SONARCLOUD_TOKEN` env var) |
| `organization` | SonarCloud organization key |
| `projectKey` | Destination project key |

### Transfer Settings
| Option | Description |
|--------|-------------|
| `mode` | `"incremental"` or `"full"` (default: `incremental`) |
| `stateFile` | Path to state file (default: `./.cloudvoyager-state.json`) |
| `batchSize` | Number of items per batch (default: `100`) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SONARQUBE_TOKEN` | Override SonarQube token from config |
| `SONARCLOUD_TOKEN` | Override SonarCloud token from config |
| `LOG_LEVEL` | Set logging level (`debug`, `info`, `warn`, `error`) |
| `LOG_FILE` | Path to log file (optional) |
| `MAX_SOURCE_FILES` | Limit number of source files to extract (0 = all) |

## Incremental Transfers

When using incremental mode, the tool:
1. Tracks the last successful sync timestamp
2. Only fetches issues created after the last sync
3. Maintains a list of processed issues to avoid duplicates
4. Records sync history for audit purposes

To force a full transfer, use the `reset` command to clear the state.

### State File

The state file (`.cloudvoyager-state.json` by default) contains:
- Last sync timestamp
- List of processed issue keys
- Completed branches
- Sync history (last 10 entries)
