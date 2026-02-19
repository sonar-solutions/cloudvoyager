# 🛠️ Local Development

Use this guide to build and run CloudVoyager from source on your local machine.

---

## ✅ Prerequisites

1. **Node.js** >= 18.0.0
2. **npm** (comes with Node.js)

Install dependencies:

```bash
npm install
```

---

## 🚀 Running from Source (No Build Required)

You can run CloudVoyager directly from source using Node.js — no build step needed:

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

> **Tip:** Use `--verbose` on any command to enable debug-level logging.

See the [CLI Reference](#-cli-reference) section below for all available flags and exhaustive usage examples.

---

## 📦 Building the Binary

CloudVoyager can be compiled into a standalone binary using Node.js [Single Executable Applications (SEA)](https://nodejs.org/api/single-executable-applications.html). This produces a self-contained binary that does not require Node.js to be installed on the target machine.

### Step 1: Bundle only (no binary)

This creates a single bundled JavaScript file at `dist/cli.cjs`:

```bash
npm run build
```

You can then run the bundle with Node.js:

```bash
node dist/cli.cjs migrate -c migrate-config.json --verbose
```

### Step 2: Build the standalone binary

This bundles the code **and** packages it into a platform-specific binary:

```bash
npm run package
```

The binary will be created at `dist/bin/cloudvoyager-<platform>-<arch>`:

| Platform | Output Binary |
|----------|--------------|
| macOS (Apple Silicon) | `dist/bin/cloudvoyager-macos-arm64` |
| macOS (Intel) | `dist/bin/cloudvoyager-macos-x64` |
| Linux (x64) | `dist/bin/cloudvoyager-linux-x64` |
| Linux (ARM64) | `dist/bin/cloudvoyager-linux-arm64` |
| Windows (x64) | `dist/bin/cloudvoyager-win-x64.exe` |
| Windows (ARM64) | `dist/bin/cloudvoyager-win-arm64.exe` |

> **Note:** The binary is built for your current platform only. To build for other platforms, run the build on that platform or use CI (see the GitHub Actions workflow).

---

## 🏃 Running the Binary

Once built, make it executable (macOS/Linux) and run it directly:

```bash
# Make executable (macOS/Linux only)
chmod +x dist/bin/cloudvoyager-macos-arm64

# Run it
./dist/bin/cloudvoyager-macos-arm64 migrate -c migrate-config.json --verbose
```

### Examples

See the [CLI Reference](#-cli-reference) section below for all available flags and exhaustive usage examples.

---

## 📖 CLI Reference

This section documents every command and flag available in CloudVoyager. The examples use the binary path `./cloudvoyager` as shorthand — substitute with your actual binary path (e.g. `./dist/bin/cloudvoyager-macos-arm64`) or `node src/index.js` when running from source.

### Global Flag

| Flag | Short | Description |
|------|-------|-------------|
| `--version` | `-V` | Print the CloudVoyager version number and exit |
| `--help` | `-h` | Display help for the command |

---

### `validate` — Validate configuration file

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file to validate |

#### Examples

```bash
# Validate a config file
./cloudvoyager validate -c config.json

# Validate using short flag
./cloudvoyager validate -c migrate-config.json
```

---

### `test` — Test connections to SonarQube and SonarCloud

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file containing connection details |

#### Examples

```bash
# Test connections
./cloudvoyager test -c config.json

# Test connections with a migration config
./cloudvoyager test -c migrate-config.json
```

---

### `status` — Show current synchronization status

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file (reads the state file path from it) |

#### Examples

```bash
# Check sync status
./cloudvoyager status -c config.json
```

---

### `reset` — Reset state and clear sync history

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file (reads the state file path from it) |
| `--yes` | `-y` | No | — | Skip the confirmation prompt and reset immediately |

#### Examples

```bash
# Reset state (will show a confirmation warning and exit)
./cloudvoyager reset -c config.json

# Reset state without confirmation
./cloudvoyager reset -c config.json --yes

# Reset state using short flags
./cloudvoyager reset -c config.json -y
```

---

### `transfer` — Transfer a single project from SonarQube to SonarCloud

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file |
| `--verbose` | `-v` | No | — | Enable debug-level logging for detailed output |
| `--wait` | — | No | — | Wait for the SonarCloud analysis to complete before returning (blocks until the Compute Engine task finishes) |
| `--concurrency <n>` | — | No | Integer | Override the maximum concurrency for I/O operations (source file extraction, hotspot extraction, etc.) |
| `--max-memory <mb>` | — | No | Integer | Set the max heap size in MB; auto-restarts the process with increased heap if the current heap is too small |
| `--auto-tune` | — | No | — | Auto-detect hardware (CPU cores, available memory) and set optimal concurrency and memory values |

#### Examples

```bash
# Basic transfer
./cloudvoyager transfer -c config.json

# Transfer with verbose logging
./cloudvoyager transfer -c config.json --verbose

# Transfer with verbose logging (short flag)
./cloudvoyager transfer -c config.json -v

# Transfer and wait for SonarCloud analysis to finish
./cloudvoyager transfer -c config.json --wait

# Transfer with verbose logging and wait for analysis
./cloudvoyager transfer -c config.json --verbose --wait

# Transfer with custom concurrency (e.g. 8 parallel I/O operations)
./cloudvoyager transfer -c config.json --concurrency 8

# Transfer with verbose logging and custom concurrency
./cloudvoyager transfer -c config.json --verbose --concurrency 8

# Transfer with custom max memory (e.g. 4096 MB)
./cloudvoyager transfer -c config.json --max-memory 4096

# Transfer with verbose logging and custom max memory
./cloudvoyager transfer -c config.json --verbose --max-memory 4096

# Transfer with auto-tuned performance settings
./cloudvoyager transfer -c config.json --auto-tune

# Transfer with verbose logging and auto-tune
./cloudvoyager transfer -c config.json --verbose --auto-tune

# Transfer with all flags combined: verbose, wait, auto-tune
./cloudvoyager transfer -c config.json --verbose --wait --auto-tune

# Transfer with all manual performance flags: verbose, wait, concurrency, max-memory
./cloudvoyager transfer -c config.json --verbose --wait --concurrency 8 --max-memory 4096

# Transfer with concurrency, max-memory, and wait (no verbose)
./cloudvoyager transfer -c config.json --wait --concurrency 8 --max-memory 4096

# Transfer with auto-tune and wait
./cloudvoyager transfer -c config.json --wait --auto-tune

# Transfer with auto-tune and max-memory override
./cloudvoyager transfer -c config.json --auto-tune --max-memory 8192

# Transfer with verbose, auto-tune, and max-memory override
./cloudvoyager transfer -c config.json --verbose --auto-tune --max-memory 8192
```

---

### `transfer-all` — Transfer ALL projects from SonarQube to SonarCloud

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file |
| `--verbose` | `-v` | No | — | Enable debug-level logging for detailed output |
| `--wait` | — | No | — | Wait for each SonarCloud analysis to complete before proceeding to the next project |
| `--dry-run` | — | No | — | List all discovered projects and their SonarCloud key mappings without actually transferring anything |
| `--concurrency <n>` | — | No | Integer | Override the maximum concurrency for I/O operations per project |
| `--max-memory <mb>` | — | No | Integer | Set the max heap size in MB; auto-restarts with increased heap if needed |
| `--project-concurrency <n>` | — | No | Integer | Maximum number of projects to transfer concurrently |
| `--auto-tune` | — | No | — | Auto-detect hardware and set optimal concurrency, memory, and project-concurrency values |

#### Examples

```bash
# Basic transfer-all
./cloudvoyager transfer-all -c config.json

# Transfer all with verbose logging
./cloudvoyager transfer-all -c config.json --verbose

# Dry-run: list all projects that would be transferred
./cloudvoyager transfer-all -c config.json --dry-run

# Dry-run with verbose logging (see debug details during project discovery)
./cloudvoyager transfer-all -c config.json --verbose --dry-run

# Transfer all and wait for each analysis to complete
./cloudvoyager transfer-all -c config.json --wait

# Transfer all with verbose logging and wait
./cloudvoyager transfer-all -c config.json --verbose --wait

# Transfer all with custom I/O concurrency
./cloudvoyager transfer-all -c config.json --concurrency 8

# Transfer all with verbose logging and custom I/O concurrency
./cloudvoyager transfer-all -c config.json --verbose --concurrency 8

# Transfer all with custom max memory
./cloudvoyager transfer-all -c config.json --max-memory 4096

# Transfer all with verbose logging and custom max memory
./cloudvoyager transfer-all -c config.json --verbose --max-memory 4096

# Transfer all with project-level concurrency (e.g. 3 projects at once)
./cloudvoyager transfer-all -c config.json --project-concurrency 3

# Transfer all with verbose logging and project concurrency
./cloudvoyager transfer-all -c config.json --verbose --project-concurrency 3

# Transfer all with auto-tuned settings
./cloudvoyager transfer-all -c config.json --auto-tune

# Transfer all with verbose logging and auto-tune
./cloudvoyager transfer-all -c config.json --verbose --auto-tune

# Transfer all with all manual performance flags
./cloudvoyager transfer-all -c config.json --verbose --wait --concurrency 8 --max-memory 4096 --project-concurrency 3

# Transfer all with auto-tune, wait, and verbose
./cloudvoyager transfer-all -c config.json --verbose --wait --auto-tune

# Transfer all with auto-tune and project concurrency override
./cloudvoyager transfer-all -c config.json --auto-tune --project-concurrency 5

# Transfer all with auto-tune, verbose, and max-memory override
./cloudvoyager transfer-all -c config.json --verbose --auto-tune --max-memory 8192

# Transfer all with concurrency, project-concurrency, and max-memory (no verbose)
./cloudvoyager transfer-all -c config.json --concurrency 8 --project-concurrency 3 --max-memory 4096

# Transfer all with concurrency, project-concurrency, max-memory, and wait
./cloudvoyager transfer-all -c config.json --wait --concurrency 8 --project-concurrency 3 --max-memory 4096

# Dry-run with auto-tune (preview auto-detected settings and project list)
./cloudvoyager transfer-all -c config.json --verbose --dry-run --auto-tune
```

---

### `migrate` — Full migration from SonarQube to one or more SonarCloud organizations

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the migration configuration file |
| `--verbose` | `-v` | No | — | Enable debug-level logging for detailed output |
| `--wait` | — | No | — | Wait for each SonarCloud analysis to complete before proceeding |
| `--dry-run` | — | No | — | Extract data and generate project/key mappings without actually migrating any data |
| `--skip-issue-metadata-sync` | — | No | — | Skip syncing issue metadata (statuses, assignments, comments, tags) after transfer |
| `--skip-hotspot-metadata-sync` | — | No | — | Skip syncing hotspot metadata (statuses, comments) after transfer |
| `--concurrency <n>` | — | No | Integer | Override the maximum concurrency for I/O operations (applies to source extraction, hotspot extraction, issue sync, and hotspot sync) |
| `--max-memory <mb>` | — | No | Integer | Set the max heap size in MB; auto-restarts with increased heap if needed |
| `--project-concurrency <n>` | — | No | Integer | Maximum number of projects to migrate concurrently |
| `--auto-tune` | — | No | — | Auto-detect hardware and set optimal concurrency, memory, and project-concurrency values |

#### Examples

```bash
# Basic migration
./cloudvoyager migrate -c migrate-config.json

# Migration with verbose logging
./cloudvoyager migrate -c migrate-config.json --verbose

# Dry-run: extract data and show mappings without migrating
./cloudvoyager migrate -c migrate-config.json --dry-run

# Dry-run with verbose logging
./cloudvoyager migrate -c migrate-config.json --verbose --dry-run

# Migration and wait for each analysis to complete
./cloudvoyager migrate -c migrate-config.json --wait

# Migration with verbose logging and wait
./cloudvoyager migrate -c migrate-config.json --verbose --wait

# Migration skipping issue metadata sync (transfer code + hotspot metadata only)
./cloudvoyager migrate -c migrate-config.json --skip-issue-metadata-sync

# Migration skipping issue metadata sync with verbose logging
./cloudvoyager migrate -c migrate-config.json --verbose --skip-issue-metadata-sync

# Migration skipping hotspot metadata sync (transfer code + issue metadata only)
./cloudvoyager migrate -c migrate-config.json --skip-hotspot-metadata-sync

# Migration skipping hotspot metadata sync with verbose logging
./cloudvoyager migrate -c migrate-config.json --verbose --skip-hotspot-metadata-sync

# Migration skipping both issue and hotspot metadata sync (transfer code only)
./cloudvoyager migrate -c migrate-config.json --skip-issue-metadata-sync --skip-hotspot-metadata-sync

# Migration skipping both metadata syncs with verbose logging
./cloudvoyager migrate -c migrate-config.json --verbose --skip-issue-metadata-sync --skip-hotspot-metadata-sync

# Migration with custom I/O concurrency
./cloudvoyager migrate -c migrate-config.json --concurrency 8

# Migration with verbose logging and custom I/O concurrency
./cloudvoyager migrate -c migrate-config.json --verbose --concurrency 8

# Migration with custom max memory
./cloudvoyager migrate -c migrate-config.json --max-memory 4096

# Migration with verbose logging and custom max memory
./cloudvoyager migrate -c migrate-config.json --verbose --max-memory 4096

# Migration with project-level concurrency
./cloudvoyager migrate -c migrate-config.json --project-concurrency 3

# Migration with verbose logging and project concurrency
./cloudvoyager migrate -c migrate-config.json --verbose --project-concurrency 3

# Migration with auto-tuned settings
./cloudvoyager migrate -c migrate-config.json --auto-tune

# Migration with verbose logging and auto-tune
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune

# Migration with all manual performance flags
./cloudvoyager migrate -c migrate-config.json --verbose --wait --concurrency 8 --max-memory 4096 --project-concurrency 3

# Migration with auto-tune, wait, and verbose
./cloudvoyager migrate -c migrate-config.json --verbose --wait --auto-tune

# Migration with auto-tune and project concurrency override
./cloudvoyager migrate -c migrate-config.json --auto-tune --project-concurrency 5

# Migration with auto-tune, verbose, and max-memory override
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune --max-memory 8192

# Dry-run with auto-tune (preview settings and mappings)
./cloudvoyager migrate -c migrate-config.json --verbose --dry-run --auto-tune

# Migration with concurrency and skip issue metadata sync
./cloudvoyager migrate -c migrate-config.json --verbose --concurrency 8 --skip-issue-metadata-sync

# Migration with concurrency and skip hotspot metadata sync
./cloudvoyager migrate -c migrate-config.json --verbose --concurrency 8 --skip-hotspot-metadata-sync

# Migration with all performance flags and skip both metadata syncs
./cloudvoyager migrate -c migrate-config.json --verbose --wait --concurrency 8 --max-memory 4096 --project-concurrency 3 --skip-issue-metadata-sync --skip-hotspot-metadata-sync

# Migration with auto-tune and skip issue metadata sync
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune --skip-issue-metadata-sync

# Migration with auto-tune and skip hotspot metadata sync
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune --skip-hotspot-metadata-sync

# Migration with auto-tune, wait, and skip both metadata syncs
./cloudvoyager migrate -c migrate-config.json --verbose --wait --auto-tune --skip-issue-metadata-sync --skip-hotspot-metadata-sync
```

---

### `sync-metadata` — Sync issue and hotspot metadata for already-migrated projects

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the migration configuration file |
| `--verbose` | `-v` | No | — | Enable debug-level logging for detailed output |
| `--skip-issue-metadata-sync` | — | No | — | Skip syncing issue metadata (statuses, assignments, comments, tags); only sync hotspot metadata |
| `--skip-hotspot-metadata-sync` | — | No | — | Skip syncing hotspot metadata (statuses, comments); only sync issue metadata |
| `--concurrency <n>` | — | No | Integer | Override the maximum concurrency for I/O operations (issue sync, hotspot sync, hotspot extraction) |
| `--max-memory <mb>` | — | No | Integer | Set the max heap size in MB; auto-restarts with increased heap if needed |
| `--auto-tune` | — | No | — | Auto-detect hardware and set optimal concurrency and memory values |

#### Examples

```bash
# Sync all metadata (issues + hotspots)
./cloudvoyager sync-metadata -c migrate-config.json

# Sync all metadata with verbose logging
./cloudvoyager sync-metadata -c migrate-config.json --verbose

# Sync only issue metadata (skip hotspots)
./cloudvoyager sync-metadata -c migrate-config.json --skip-hotspot-metadata-sync

# Sync only issue metadata with verbose logging
./cloudvoyager sync-metadata -c migrate-config.json --verbose --skip-hotspot-metadata-sync

# Sync only hotspot metadata (skip issues)
./cloudvoyager sync-metadata -c migrate-config.json --skip-issue-metadata-sync

# Sync only hotspot metadata with verbose logging
./cloudvoyager sync-metadata -c migrate-config.json --verbose --skip-issue-metadata-sync

# Sync metadata with custom I/O concurrency
./cloudvoyager sync-metadata -c migrate-config.json --concurrency 8

# Sync metadata with verbose logging and custom I/O concurrency
./cloudvoyager sync-metadata -c migrate-config.json --verbose --concurrency 8

# Sync metadata with custom max memory
./cloudvoyager sync-metadata -c migrate-config.json --max-memory 4096

# Sync metadata with verbose logging and custom max memory
./cloudvoyager sync-metadata -c migrate-config.json --verbose --max-memory 4096

# Sync metadata with auto-tuned settings
./cloudvoyager sync-metadata -c migrate-config.json --auto-tune

# Sync metadata with verbose logging and auto-tune
./cloudvoyager sync-metadata -c migrate-config.json --verbose --auto-tune

# Sync only issues with custom concurrency
./cloudvoyager sync-metadata -c migrate-config.json --verbose --concurrency 8 --skip-hotspot-metadata-sync

# Sync only hotspots with custom concurrency
./cloudvoyager sync-metadata -c migrate-config.json --verbose --concurrency 8 --skip-issue-metadata-sync

# Sync only issues with auto-tune
./cloudvoyager sync-metadata -c migrate-config.json --verbose --auto-tune --skip-hotspot-metadata-sync

# Sync only hotspots with auto-tune
./cloudvoyager sync-metadata -c migrate-config.json --verbose --auto-tune --skip-issue-metadata-sync

# Sync metadata with all manual performance flags
./cloudvoyager sync-metadata -c migrate-config.json --verbose --concurrency 8 --max-memory 4096

# Sync metadata with auto-tune and max-memory override
./cloudvoyager sync-metadata -c migrate-config.json --verbose --auto-tune --max-memory 8192

# Sync only issues with all manual performance flags
./cloudvoyager sync-metadata -c migrate-config.json --verbose --concurrency 8 --max-memory 4096 --skip-hotspot-metadata-sync

# Sync only hotspots with all manual performance flags
./cloudvoyager sync-metadata -c migrate-config.json --verbose --concurrency 8 --max-memory 4096 --skip-issue-metadata-sync
```

---

## 🧹 Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

---

## 🧪 Running Tests

```bash
# Run tests with coverage
npm test

# Run tests without coverage (faster)
npm run test:fast
```

---

## 🌍 Environment Variables

| Variable | Description |
|----------|-------------|
| `LOG_LEVEL` | Set logging level: `debug`, `info`, `warn`, `error` |
| `LOG_FILE` | Path to log file (optional, logs to console by default) |
| `SONARQUBE_TOKEN` | Override SonarQube token from config |
| `SONARCLOUD_TOKEN` | Override SonarCloud token from config |
| `MAX_SOURCE_FILES` | Limit number of source files to extract (`0` = all) |

### Examples with environment variables

```bash
# Run with debug logging to a file
LOG_LEVEL=debug LOG_FILE=./cloudvoyager.log node src/index.js migrate -c migrate-config.json --verbose

# Override tokens via environment
SONARQUBE_TOKEN=sqp_xxx SONARCLOUD_TOKEN=sqa_yyy node src/index.js transfer -c config.json --verbose

# Limit source files for testing
MAX_SOURCE_FILES=10 node src/index.js transfer -c config.json --verbose
```

---

## ⚡ npm Script Shortcuts

For convenience, common commands are available as npm scripts:

| What it does | npm script |
|-------------|-----------|
| Transfer single project (verbose) | `npm run transfer` |
| Transfer single project (auto-tuned) | `npm run transfer:auto-tune` |
| Transfer all projects (verbose) | `npm run transfer-all` |
| Dry-run transfer all | `npm run transfer-all:dry-run` |
| Full migration (verbose) | `npm run migrate` |
| Dry-run migration | `npm run migrate:dry-run` |
| Full migration (auto-tuned) | `npm run migrate:auto-tune` |
| Sync metadata only | `npm run sync-metadata` |
| Sync only issue metadata | `npm run sync-metadata:issues-only` |
| Sync only hotspot metadata | `npm run sync-metadata:hotspots-only` |

> **Note:** These npm scripts expect a `config.json` or `migrate-config.json` file in the project root. See the [Configuration Reference](configuration.md) for config file details.

---

## 📚 Further Reading

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Architecture](architecture.md) — project structure, data flow, report format
- [Technical Details](technical-details.md) — protobuf encoding, measure types, active rules
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them
