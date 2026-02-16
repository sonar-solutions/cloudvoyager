# Seawhale to Skywhale

A Node.js CLI tool to migrate data from self-hosted SonarQube instances to SonarCloud.

**Status: Working** - Successfully tested with full report transfers (metadata, components, sources, active rules, measures, issues, and changesets) accepted by SonarCloud.

## Overview

Seawhale to Skywhale acts as a "pseudo sonarscanner" that:
1. Extracts all relevant data (code, issues, metrics, active rules, changesets) from SonarQube via its REST API
2. Packages this data into protobuf format matching SonarCloud's scanner report schema
3. Submits the packaged data to SonarCloud's Compute Engine endpoint

This enables organizations to migrate their analysis history and metrics from SonarQube to SonarCloud without re-running scans.

## Features

- **Full Data Extraction** - Projects, branches, quality gates, issues, metrics, measures, source code, changesets
- **Active Rules with Smart Filtering** - Extracts quality profile rules, filtered by project languages (~84% size reduction)
- **Protobuf Encoding** - Scanner report format matching SonarCloud's expected schema with proper encoding (length-delimited for issues, measures, and active rules)
- **SCM Revision Tracking** - Includes git commit hash for duplicate detection and analysis history
- **Branch Name Resolution** - Automatically uses SonarCloud's main branch name to avoid mismatches with SonarQube
- **Incremental Transfers** - State management for incremental sync with history tracking
- **Configuration Validation** - JSON schema validation with environment variable support

### Generated Report Structure

```
scanner-report.zip:
├── metadata.pb          - Analysis metadata with SCM revision ID (single message)
├── activerules.pb       - Language-filtered quality profile rules (length-delimited)
├── context-props.pb     - SCM and CI detection metadata (empty file)
├── component-{ref}.pb   - Component definitions, flat structure (single message each)
├── issues-{ref}.pb      - Code issues with text ranges and flows (length-delimited)
├── measures-{ref}.pb    - Metrics and measurements per file component (length-delimited)
├── changesets-{ref}.pb  - SCM changeset info per file component (single message each)
└── source-{ref}.txt     - Source code files (plain text)
```

Note: Measures are only generated for file components (no project-level `measures-1.pb`). Components use a flat structure where all files are direct children of the project (no directory components).

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
│   ├── api-client.js     # HTTP client with pagination, auth, SCM revision
│   ├── models.js         # Data models (with language support)
│   └── extractors/       # Specialized data extractors
│       ├── index.js      # DataExtractor orchestrator
│       ├── projects.js   # Project metadata, branches, quality gates
│       ├── issues.js     # Issues with pagination
│       ├── metrics.js    # Metric definitions
│       ├── measures.js   # Project and component measures
│       ├── sources.js    # Source code files (with language info)
│       ├── rules.js      # Active rules extraction
│       ├── changesets.js  # SCM changeset data per file
│       ├── symbols.js    # Symbol references
│       └── syntax-highlighting.js  # Syntax highlighting data
├── protobuf/
│   ├── builder.js        # Transforms extracted data into protobuf messages
│   ├── encoder.js        # Encodes messages using protobufjs
│   └── schema/           # Protocol buffer definitions (.proto files)
│       ├── scanner-report.proto
│       └── constants.proto
├── sonarcloud/
│   ├── api-client.js     # SonarCloud HTTP client (quality profiles, branch name)
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

### Protobuf Encoding

The scanner report uses two encoding styles:
- **Single message** (no length delimiter): `metadata.pb`, `component-{ref}.pb`, `changesets-{ref}.pb`
- **Length-delimited** (multiple messages): `issues-{ref}.pb`, `measures-{ref}.pb`, `activerules.pb`

protobufjs automatically converts snake_case field names to camelCase in JavaScript:
- `analysis_date` becomes `analysisDate`
- `scm_revision_id` becomes `scmRevisionId`
- `component_ref` becomes `componentRef`

All field names in the codebase use camelCase to match this convention.

### Measure Type Mapping

Measures use typed value fields based on metric type:
- **Integer metrics** (`intValue`): `functions`, `statements`, `classes`, `ncloc`, `comment_lines`, `complexity`, `cognitive_complexity`, `violations`, `sqale_index`
- **String metrics** (`stringValue`): `executable_lines_data`, `ncloc_data`, `alert_status`
- **Float/percentage metrics** (`doubleValue`): `coverage`, `line_coverage`, `branch_coverage`, `duplicated_lines_density`, ratings

### Active Rules

- Active rules are filtered by languages actually used in the project, resulting in ~84% reduction in payload size
- Rule keys are stripped of the repository prefix (e.g., `S7788` not `jsarchitecture:S7788`)
- Quality profile keys are mapped to SonarCloud profile keys (not SonarQube keys)

### Component Structure

Components use a flat structure - all files are direct children of the project component (no directory components). Line counts are derived from actual source file content rather than SonarQube measures API values.

### SCM Revision Tracking

The tool includes `scm_revision_id` (git commit hash) in metadata. SonarCloud uses this to detect and reject duplicate reports, enabling proper analysis history tracking.

### Branch Name Resolution

The tool fetches the main branch name from SonarCloud (via `getMainBranchName()` API) rather than using the SonarQube branch name. This avoids mismatches where SonarQube uses "main" but SonarCloud expects "master" (or vice versa).

## Troubleshooting

### Authentication Errors
- Verify your tokens have the correct permissions
- Check that tokens haven't expired
- Ensure the project key exists in SonarQube
- Verify the organization key is correct in SonarCloud

### Generic "Issue whilst processing" Error
This vague SonarCloud error can be caused by:
- **Branch name mismatch** - SonarQube and SonarCloud have different main branch names. The tool handles this automatically via `getMainBranchName()`, but verify your SonarCloud project's branch configuration
- **Line count mismatch** - Source file line counts don't match component metadata. The tool uses actual source content line counts to avoid this

### Report Rejected by SonarCloud
- **Empty ScmInfo** - Ensure `changesetIndexByLine` is populated for ADDED files (array of zeros, one per line)
- **Issue gap field** - The `gap` field should not be included in issues (it's scanner-computed, not from SonarQube)
- **Duplicate report** - SonarCloud rejects reports with the same `scm_revision_id`. Use a different commit or update the source project

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
