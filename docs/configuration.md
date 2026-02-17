# Configuration

CloudVoyager supports three configuration formats depending on the command you're using.

## Single Project Config

Used by: `transfer`, `test`, `validate`, `status`, `reset`

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

## Transfer-All Config

Used by: `transfer-all`

Transfers all projects from a SonarQube server to a single SonarCloud organization.

```json
{
  "sonarqube": {
    "url": "https://sonarqube.example.com",
    "token": "sqp_your_sonarqube_token_here"
  },
  "sonarcloud": {
    "url": "https://sonarcloud.io",
    "token": "your_sonarcloud_token_here",
    "organization": "my-organization"
  },
  "transfer": {
    "mode": "full",
    "stateFile": "./.cloudvoyager-state.json",
    "batchSize": 100
  },
  "transferAll": {
    "projectKeyPrefix": "",
    "projectKeyMapping": {
      "old-project-key": "new-project-key"
    },
    "excludeProjects": ["project-to-skip"]
  }
}
```

See `examples/transfer-all-config.example.json` for a complete example.

## Migration Config

Used by: `migrate`

Performs a full migration from a SonarQube server to one or more SonarCloud organizations, including projects, quality gates, quality profiles, groups, permissions, portfolios, and more.

```json
{
  "sonarqube": {
    "url": "https://sonarqube.example.com",
    "token": "sqp_your_sonarqube_admin_token"
  },
  "sonarcloud": {
    "organizations": [
      {
        "key": "org-one",
        "token": "sonarcloud_token_for_org_one",
        "url": "https://sonarcloud.io"
      },
      {
        "key": "org-two",
        "token": "sonarcloud_token_for_org_two",
        "url": "https://sonarcloud.io"
      }
    ]
  },
  "transfer": {
    "mode": "full",
    "batchSize": 100
  },
  "migrate": {
    "outputDir": "./migration-output",
    "skipIssueSync": false,
    "skipHotspotSync": false,
    "dryRun": false
  }
}
```

See `examples/migrate-config.example.json` for a complete example.

---

## Configuration Options

### SonarQube Settings

| Option | Required | Description |
|--------|----------|-------------|
| `url` | Yes | SonarQube server URL |
| `token` | Yes | SonarQube API token (or set via `SONARQUBE_TOKEN` env var) |
| `projectKey` | For `transfer` only | Project key to export (not needed for `transfer-all` or `migrate`) |

### SonarCloud Settings (Single Org)

Used by `transfer`, `transfer-all`, `test`, `validate`, `status`, `reset`.

| Option | Required | Description |
|--------|----------|-------------|
| `url` | No | SonarCloud server URL (default: `https://sonarcloud.io`) |
| `token` | Yes | SonarCloud API token (or set via `SONARCLOUD_TOKEN` env var) |
| `organization` | Yes | SonarCloud organization key |
| `projectKey` | For `transfer` only | Destination project key |

### SonarCloud Settings (Multi-Org)

Used by `migrate`. Instead of a single org, you provide an array of target organizations.

| Option | Required | Description |
|--------|----------|-------------|
| `organizations[].key` | Yes | SonarCloud organization key |
| `organizations[].token` | Yes | SonarCloud API token for this org |
| `organizations[].url` | No | SonarCloud server URL (default: `https://sonarcloud.io`) |

### Transfer Settings

| Option | Default | Description |
|--------|---------|-------------|
| `mode` | `incremental` | `"incremental"` or `"full"` |
| `stateFile` | `./.cloudvoyager-state.json` | Path to state file for incremental transfers |
| `batchSize` | `100` | Number of items per batch (1–500) |

### Transfer-All Settings

| Option | Default | Description |
|--------|---------|-------------|
| `projectKeyPrefix` | `""` | Prefix to prepend to SonarQube project keys for SonarCloud |
| `projectKeyMapping` | `{}` | Explicit mapping from SonarQube project key to SonarCloud project key |
| `excludeProjects` | `[]` | SonarQube project keys to exclude from transfer |

### Migrate Settings

| Option | Default | Description |
|--------|---------|-------------|
| `outputDir` | `./migration-output` | Directory for mapping CSVs and server info output |
| `skipIssueSync` | `false` | Skip syncing issue statuses, assignments, and comments |
| `skipHotspotSync` | `false` | Skip syncing hotspot statuses and comments |
| `dryRun` | `false` | Extract and generate mappings without migrating |

### Rate Limit Settings

Controls retry and throttling behavior for SonarCloud API requests. **Disabled by default** — rate limiting is only active when you explicitly configure it. Add a `rateLimit` section to any config file to enable it.

```json
{
  "rateLimit": {
    "maxRetries": 5,
    "baseDelay": 1000,
    "minRequestInterval": 150
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `maxRetries` | `0` | Max retry attempts when SonarCloud returns 503 or 429. Set to `0` to disable retries. Retries use exponential backoff (delay doubles each attempt). |
| `baseDelay` | `1000` | Initial delay in ms before the first retry. Doubles each retry: 1000ms → 2000ms → 4000ms → etc. Only applies when `maxRetries` > 0. |
| `minRequestInterval` | `0` | Minimum ms to wait between POST (write) requests. Set to `0` to disable throttling. Values like `100`–`200` help avoid triggering rate limits during high-volume operations. |

**Example: aggressive rate limiting for large migrations:**

```json
{
  "rateLimit": {
    "maxRetries": 10,
    "baseDelay": 2000,
    "minRequestInterval": 250
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SONARQUBE_TOKEN` | Override SonarQube token from config |
| `SONARCLOUD_TOKEN` | Override SonarCloud token from config |
| `LOG_LEVEL` | Set logging level (`debug`, `info`, `warn`, `error`) |
| `LOG_FILE` | Path to log file (optional) |
| `MAX_SOURCE_FILES` | Limit number of source files to extract (0 = all) |

## npm Scripts

All commands are available as npm scripts for convenience:

| Script | What it does |
|--------|-------------|
| `npm run validate` | Validate `config.json` |
| `npm run test:connection` | Test connections using `config.json` |
| `npm run transfer` | Transfer a single project using `config.json` |
| `npm run transfer-all` | Transfer all projects using `config.json` |
| `npm run transfer-all:dry-run` | Dry run transfer-all |
| `npm run status` | Show sync status |
| `npm run reset` | Clear sync history |
| `npm run migrate` | Full migration using `migrate-config.json` |
| `npm run migrate:dry-run` | Dry run migration |
| `npm run migrate:skip-hotspots` | Migrate without hotspot sync |
| `npm run migrate:skip-issues` | Migrate without issue sync |
| `npm run migrate:minimal` | Migrate without issue or hotspot sync |

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
