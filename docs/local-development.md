# Local Development

This guide covers how to build and run CloudVoyager locally from source.

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** (comes with Node.js)

## Install Dependencies

```bash
npm install
```

## Running from Source (No Build Required)

You can run CloudVoyager directly from source using Node.js:

```bash
# General syntax
node src/index.js <command> [options]

# Or via npm
npm start -- <command> [options]
```

### Examples

```bash
# Validate a config file
node src/index.js validate -c config.json

# Test connections to SonarQube and SonarCloud
node src/index.js test -c config.json

# Transfer a single project
node src/index.js transfer -c config.json --verbose

# Transfer all projects
node src/index.js transfer-all -c config.json --verbose

# Dry-run a full migration (no changes made)
node src/index.js migrate -c migrate-config.json --verbose --dry-run

# Run a full migration
node src/index.js migrate -c migrate-config.json --verbose

# Run a full migration with auto-tuning (adjusts concurrency/batch sizes automatically)
node src/index.js migrate -c migrate-config.json --verbose --auto-tune

# Sync metadata only (issues + hotspots)
node src/index.js sync-metadata -c migrate-config.json --verbose

# Sync only issue metadata (skip hotspots)
node src/index.js sync-metadata -c migrate-config.json --verbose --skip-hotspot-metadata-sync

# Sync only hotspot metadata (skip issues)
node src/index.js sync-metadata -c migrate-config.json --verbose --skip-issue-metadata-sync

# Check transfer status
node src/index.js status -c config.json

# Reset state (clear sync history)
node src/index.js reset -c config.json
```

## Building the Binary

CloudVoyager can be compiled into a standalone binary using Node.js [Single Executable Applications (SEA)](https://nodejs.org/api/single-executable-applications.html). This produces a self-contained binary that does not require Node.js to be installed on the target machine.

### Step 1: Bundle Only (No Binary)

This creates a single bundled JavaScript file at `dist/cli.cjs`:

```bash
npm run build
```

You can then run the bundle with Node.js:

```bash
node dist/cli.cjs migrate -c migrate-config.json --verbose
```

### Step 2: Build the Standalone Binary

This bundles the code and packages it into a platform-specific binary:

```bash
npm run package
```

The binary will be created at `dist/bin/cloudvoyager-<platform>-<arch>`, for example:

| Platform | Output Binary |
|----------|--------------|
| macOS (Apple Silicon) | `dist/bin/cloudvoyager-macos-arm64` |
| macOS (Intel) | `dist/bin/cloudvoyager-macos-x64` |
| Linux (x64) | `dist/bin/cloudvoyager-linux-x64` |
| Linux (ARM64) | `dist/bin/cloudvoyager-linux-arm64` |
| Windows (x64) | `dist/bin/cloudvoyager-win-x64.exe` |
| Windows (ARM64) | `dist/bin/cloudvoyager-win-arm64.exe` |

> **Note:** The binary is built for your current platform. To build for other platforms, run the build on that platform or use CI (see the GitHub Actions workflow).

### Running the Binary

Once built, make it executable (macOS/Linux) and run it directly:

```bash
# Make executable (macOS/Linux only)
chmod +x dist/bin/cloudvoyager-macos-arm64

# Run it
./dist/bin/cloudvoyager-macos-arm64 migrate -c migrate-config.json --verbose
```

### Examples Using the Binary

```bash
# Validate config
./dist/bin/cloudvoyager-macos-arm64 validate -c migrate-config.json

# Test connections
./dist/bin/cloudvoyager-macos-arm64 test -c migrate-config.json

# Dry-run migration
./dist/bin/cloudvoyager-macos-arm64 migrate -c migrate-config.json --verbose --dry-run

# Full migration with auto-tune
./dist/bin/cloudvoyager-macos-arm64 migrate -c migrate-config.json --verbose --auto-tune

# Transfer all projects
./dist/bin/cloudvoyager-macos-arm64 transfer-all -c config.json --verbose

# Sync metadata only
./dist/bin/cloudvoyager-macos-arm64 sync-metadata -c migrate-config.json --verbose
```

## Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

## Running Tests

```bash
# Run tests with coverage
npm test

# Run tests without coverage (faster)
npm run test:fast
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `LOG_LEVEL` | Set logging level: `debug`, `info`, `warn`, `error` |
| `LOG_FILE` | Path to log file (optional, logs to console by default) |
| `SONARQUBE_TOKEN` | Override SonarQube token from config |
| `SONARCLOUD_TOKEN` | Override SonarCloud token from config |
| `MAX_SOURCE_FILES` | Limit number of source files to extract (`0` = all) |

### Example with Environment Variables

```bash
# Run with debug logging to a file
LOG_LEVEL=debug LOG_FILE=./cloudvoyager.log node src/index.js migrate -c migrate-config.json --verbose

# Override tokens via environment
SONARQUBE_TOKEN=sqp_xxx SONARCLOUD_TOKEN=sqa_yyy node src/index.js transfer -c config.json --verbose

# Limit source files for testing
MAX_SOURCE_FILES=10 node src/index.js transfer -c config.json --verbose
```

## npm Script Shortcuts

For convenience, common commands are available as npm scripts:

```bash
npm run transfer              # Transfer single project (verbose)
npm run transfer:auto-tune    # Transfer single project with auto-tune
npm run transfer-all          # Transfer all projects (verbose)
npm run transfer-all:dry-run  # Dry-run transfer all
npm run migrate               # Full migration (verbose)
npm run migrate:dry-run       # Dry-run migration
npm run migrate:auto-tune     # Full migration with auto-tune
npm run sync-metadata         # Sync metadata only
```

> **Note:** These npm scripts expect a `config.json` or `migrate-config.json` file in the project root. See [configuration.md](configuration.md) for config file details.
