# Seawhale to Skywhale

A Node.js CLI tool to migrate data from self-hosted SonarQube instances to SonarCloud.

## Overview

Seawhale to Skywhale acts as a "pseudo sonarscanner" that:
1. Extracts all relevant data (code, issues, metrics, active rules) from SonarQube via its REST API
2. Packages this data into protobuf format matching SonarCloud's scanner report schema
3. Submits the packaged data to SonarCloud's Compute Engine endpoint

This enables organizations to migrate their analysis history and metrics from SonarQube to SonarCloud without re-running scans.

## Features

- **Full Data Extraction** - Projects, branches, quality gates, issues, metrics, measures, source code
- **Active Rules with Smart Filtering** - Extracts quality profile rules, filtered by project languages (84% size reduction)
- **Protobuf Encoding** - Scanner report format using the official SonarCloud protobuf schema
- **SCM Revision Tracking** - Includes git commit hash for duplicate detection and analysis history
- **Incremental Transfers** - State management for incremental sync with history tracking
- **Configuration Validation** - JSON schema validation with environment variable support

### Generated Report Structure

```
scanner-report.zip:
├── metadata.pb          - Analysis metadata with SCM revision ID
├── activerules.pb       - Language-filtered quality profile rules
├── context-props.pb     - SCM and CI detection metadata
├── component-{ref}.pb   - Component definitions (project + files)
├── issues-{ref}.pb      - Code issues with text ranges and flows
├── measures-{ref}.pb    - Metrics and measurements per component
└── source-{ref}.txt     - Source code files (plain text)
```

## Requirements

- Node.js >= 18.0.0
- Valid SonarQube API token with project access
- Valid SonarCloud API token with organization access

## Installation

```bash
# Install dependencies
npm install

# Optional: Link globally for easy CLI access
npm link
```

## Configuration

Create a configuration file (e.g., `config.json`):

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
    "stateFile": "./.seawhale-state.json",
    "batchSize": 100
  }
}
```

See `examples/config.example.json` for a complete example.

### Configuration Options

#### SonarQube Settings
- `url` - SonarQube server URL
- `token` - SonarQube API token (or set via `SONARQUBE_TOKEN` env var)
- `projectKey` - Project key to export

#### SonarCloud Settings
- `url` - SonarCloud server URL (default: `https://sonarcloud.io`)
- `token` - SonarCloud API token (or set via `SONARCLOUD_TOKEN` env var)
- `organization` - SonarCloud organization key
- `projectKey` - Destination project key

#### Transfer Settings
- `mode` - `"incremental"` or `"full"` (default: `incremental`)
- `stateFile` - Path to state file (default: `./.seawhale-state.json`)
- `batchSize` - Number of items per batch (default: `100`)

## Usage

### Validate Configuration

```bash
node src/index.js validate -c config.json
```

### Test Connections

```bash
node src/index.js test -c config.json
```

### Run Transfer

```bash
# Run transfer and wait for analysis to complete
node src/index.js transfer -c config.json

# Run with verbose logging
node src/index.js transfer -c config.json --verbose

# Upload without waiting for analysis
node src/index.js transfer -c config.json --no-wait
```

### Check Status

```bash
node src/index.js status -c config.json
```

### Reset State

```bash
# Reset state (with confirmation)
node src/index.js reset -c config.json

# Skip confirmation
node src/index.js reset -c config.json --yes
```

## Commands

| Command | Description |
|---------|-------------|
| `transfer` | Transfer data from SonarQube to SonarCloud |
| `validate` | Validate configuration file |
| `test` | Test connections to SonarQube and SonarCloud |
| `status` | Show current synchronization status |
| `reset` | Reset state and clear sync history |

### Common Options

- `-c, --config <path>` - Path to configuration file (required for all commands)
- `-v, --verbose` - Enable verbose logging (transfer command)
- `--no-wait` - Don't wait for analysis to complete (transfer command)
- `-y, --yes` - Skip confirmation prompt (reset command)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SONARQUBE_TOKEN` | Override SonarQube token from config |
| `SONARCLOUD_TOKEN` | Override SonarCloud token from config |
| `LOG_LEVEL` | Set logging level (`debug`, `info`, `warn`, `error`) |
| `LOG_FILE` | Path to log file (optional) |
| `MAX_SOURCE_FILES` | Limit number of source files to extract (0 = all) |

## Architecture

```
src/
├── index.js              # CLI entry point (Commander-based)
├── config/
│   ├── loader.js         # Config loading and validation (Ajv)
│   └── schema.js         # JSON schema definition
├── sonarqube/
│   ├── api-client.js     # HTTP client with pagination and auth
│   ├── models.js         # Data models
│   └── extractors/       # Specialized data extractors
│       ├── index.js      # DataExtractor orchestrator
│       ├── projects.js   # Project metadata, branches, quality gates
│       ├── issues.js     # Issues with pagination
│       ├── metrics.js    # Metric definitions
│       ├── measures.js   # Project and component measures
│       └── sources.js    # Source code files
├── protobuf/
│   ├── builder.js        # Transforms extracted data into protobuf messages
│   ├── encoder.js        # Encodes messages using protobufjs
│   └── schema/           # Protocol buffer definitions (.proto files)
│       ├── scanner-report.proto
│       └── constants.proto
├── sonarcloud/
│   ├── api-client.js     # SonarCloud HTTP client
│   └── uploader.js       # Report packaging and CE submission
├── state/
│   ├── storage.js        # File-based state persistence
│   └── tracker.js        # Incremental transfer state tracking
└── utils/
    ├── logger.js         # Winston-based logging
    └── errors.js         # Custom error classes
```

### Data Flow

1. **Configuration Loading** - Load and validate config, apply env var overrides
2. **State Initialization** - Load previous state for incremental transfers
3. **Connection Testing** - Verify connectivity to SonarQube and SonarCloud
4. **Data Extraction** - Extract all data from SonarQube using specialized extractors
5. **Message Building** - Transform extracted data into protobuf message structures
6. **Encoding** - Encode messages to binary protobuf format
7. **Upload** - Submit encoded report to SonarCloud CE endpoint
8. **State Update** - Record successful transfer in state file

## Incremental Transfers

When using incremental mode, the tool:
1. Tracks the last successful sync timestamp
2. Only fetches issues created after the last sync
3. Maintains a list of processed issues to avoid duplicates
4. Records sync history for audit purposes

To force a full transfer, use the `reset` command to clear the state.

### State File

The state file (`.seawhale-state.json` by default) contains:
- Last sync timestamp
- List of processed issue keys
- Completed branches
- Sync history (last 10 entries)

## Technical Details

### Protobuf Field Names

protobufjs automatically converts snake_case field names to camelCase in JavaScript:
- `analysis_date` becomes `analysisDate`
- `scm_revision_id` becomes `scmRevisionId`
- `component_ref` becomes `componentRef`

All field names in the codebase use camelCase to match this convention.

### Language Filtering

Active rules are filtered by languages actually used in the project, resulting in ~84% reduction in payload size. This improves upload speed and reduces SonarCloud processing time.

### SCM Revision Tracking

The tool includes `scm_revision_id` (git commit hash) in metadata. SonarCloud uses this to detect and reject duplicate reports, enabling proper analysis history tracking.

## Troubleshooting

### Authentication Errors
- Verify your tokens have the correct permissions
- Check that tokens haven't expired
- Ensure the project key exists in SonarQube
- Verify the organization key is correct in SonarCloud

### Connection Timeouts
- Check network connectivity to both servers
- Verify firewall rules allow access
- Use `--verbose` flag for detailed connection logs

### Large Reports
```bash
# Limit source file extraction for testing
export MAX_SOURCE_FILES=10
node src/index.js transfer -c config.json
```

## Development

```bash
# Install dependencies
npm install

# Run with local changes
node src/index.js <command> [options]

# Lint code
npm run lint
npm run lint:fix
```

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation and [CONTINUE.md](CONTINUE.md) for current development progress.

## Contributing

Contributions are welcome! Please ensure:
- Code follows the existing style (use ESLint)
- Changes are well-documented
- Configuration validation is maintained
- Error handling is comprehensive

## License

MIT
