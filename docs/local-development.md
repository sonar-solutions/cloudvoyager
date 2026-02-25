# 🛠️ Local Development

<!-- Last updated: Feb 21, 2026 at 10:30:00 AM -->

Use this guide to build and run CloudVoyager locally. All developers should **build the binary and run that** — do not run directly from source. This ensures consistent behavior across environments and eliminates "works on my machine" issues.

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## ✅ Prerequisites

1. **Node.js** >= 18.0.0
2. **npm** (comes with Node.js)

Install dependencies:

```bash
npm install
```

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📦 Building the Binary

CloudVoyager can be compiled into a standalone binary using two packaging backends. Both produce a self-contained binary that does not require Node.js or Bun to be installed on the target machine.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Node.js SEA (Default)

```bash
npm run package           # Build for current platform
```

Uses esbuild for bundling + Node.js [Single Executable Applications (SEA)](https://nodejs.org/api/single-executable-applications.html) with V8 code cache. Builds for the current platform. This is the recommended method — it is stable and well-tested.

<!-- Updated: Feb 21, 2026 at 04:02:35 PM -->
### Bun Compile (Experimental)

```bash
npm run package:bun           # Build for current platform
npm run package:bun:cross     # Cross-compile 5 platform binaries
```

Uses Bun's single-step compile — source goes directly to a native binary with no intermediate bundle. Bun is installed as an optional dependency — no global install required. While faster to build, Bun binaries may silently crash at runtime in some environments, so this is considered experimental.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Output

| Platform | Output Binary | Build Method |
|----------|--------------|-------------|
| macOS (Apple Silicon) | `dist/bin/cloudvoyager-macos-arm64` | Node.js SEA |
| macOS (Intel) | `dist/bin/cloudvoyager-macos-x64` | Node.js SEA |
| Linux (x64) | `dist/bin/cloudvoyager-linux-x64` | Node.js SEA |
| Linux (ARM64) | `dist/bin/cloudvoyager-linux-arm64` | Node.js SEA |
| Windows (x64) | `dist/bin/cloudvoyager-win-x64.exe` | Node.js SEA |
| Windows (ARM64) | `dist/bin/cloudvoyager-win-arm64.exe` | Node.js SEA |

> **Note:** `npm run package` builds for your current platform only using Node.js SEA. In CI, 6 parallel runners each build a native binary for their platform.

If you only need the bundled JavaScript file (without the standalone binary), you can run:

```bash
npm run build
```

This creates `dist/cli.cjs`, which can be run with `node dist/cli.cjs <command> [options]`.

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🏃 Running the Binary

After building, make it executable (macOS/Linux) and run it directly:

```bash
# Make executable (macOS/Linux only)
chmod +x dist/bin/cloudvoyager-macos-arm64

# Run it
./dist/bin/cloudvoyager-macos-arm64 migrate -c migrate-config.json --verbose
```

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Quick Start Examples

```bash
# Validate a config file
./cloudvoyager validate -c config.json

# Test connections to SonarQube and SonarCloud
./cloudvoyager test -c config.json

# Transfer a single project
./cloudvoyager transfer -c config.json --verbose

# Transfer all projects
./cloudvoyager transfer-all -c config.json --verbose

# Dry-run a full migration (no changes made)
./cloudvoyager migrate -c migrate-config.json --verbose --dry-run

# Run a full migration
./cloudvoyager migrate -c migrate-config.json --verbose

# Run a full migration with auto-tuning
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune

# Sync metadata only (issues + hotspots)
./cloudvoyager sync-metadata -c migrate-config.json --verbose

# Check transfer status
./cloudvoyager status -c config.json

# Reset state (clear sync history)
./cloudvoyager reset -c config.json
```

> **Tip:** Use `--verbose` on any command to enable debug-level logging. Substitute `./cloudvoyager` with your actual binary path (e.g. `./dist/bin/cloudvoyager-macos-arm64`).

See the [CLI Reference](#-cli-reference) section below for all available flags and exhaustive usage examples.

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📖 CLI Reference

This section documents every command and flag available in CloudVoyager. The examples use `./cloudvoyager` as shorthand — substitute with your actual binary path (e.g. `./dist/bin/cloudvoyager-macos-arm64`).

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Global Flag

| Flag | Short | Description |
|------|-------|-------------|
| `--version` | `-V` | Print the CloudVoyager version number and exit |
| `--help` | `-h` | Display help for the command |

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### `validate` — Validate configuration file

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file to validate |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
#### Examples

```bash
# Validate a config file
./cloudvoyager validate -c config.json

# Validate using short flag
./cloudvoyager validate -c config.json
```

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### `test` — Test connections to SonarQube and SonarCloud

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file containing connection details |
| `--verbose` | `-v` | No | — | Enable debug-level logging for detailed output |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
#### Examples

```bash
# Test connections
./cloudvoyager test -c config.json

# Test connections with verbose output
./cloudvoyager test -c config.json --verbose
```

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### `status` — Show current synchronization status

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file (reads the state file path from it) |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
#### Examples

```bash
# Check sync status
./cloudvoyager status -c config.json
```

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### `reset` — Reset state and clear sync history

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file (reads the state file path from it) |
| `--yes` | `-y` | No | — | Skip the confirmation prompt and reset immediately |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
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

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### `transfer` — Transfer a single project from SonarQube to SonarCloud

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the configuration file |
| `--verbose` | `-v` | No | — | Enable debug-level logging for detailed output |
| `--wait` | — | No | — | Wait for the SonarCloud analysis to complete before returning (blocks until the Compute Engine task finishes) |
| `--concurrency <n>` | — | No | Integer | Override the maximum concurrency for I/O operations (source file extraction, hotspot extraction, etc.) |
| `--max-memory <mb>` | — | No | Integer | Set the max heap size in MB; auto-restarts the process with increased heap if the current heap is too small |
| `--auto-tune` | — | No | — | Auto-detect hardware (CPU cores, available memory) and set optimal concurrency and memory values |
| `--skip-all-branch-sync` | — | No | — | Only sync the main branch (skip non-main branches). Equivalent to setting `transfer.syncAllBranches: false` in config |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
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

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
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
| `--skip-all-branch-sync` | — | No | — | Only sync the main branch of each project (skip non-main branches). Equivalent to setting `transfer.syncAllBranches: false` in config |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
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

<!-- Updated: Feb 21, 2026 at 10:30:00 AM -->
### `migrate` — Full migration from SonarQube to one or more SonarCloud organizations

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the migration configuration file |
| `--verbose` | `-v` | No | — | Enable debug-level logging for detailed output |
| `--wait` | — | No | — | Wait for each SonarCloud analysis to complete before proceeding |
| `--dry-run` | — | No | — | Extract data and generate project/key mappings without actually migrating any data |
| `--skip-issue-metadata-sync` | — | No | — | Skip syncing issue metadata (statuses, assignments, comments, tags) after transfer |
| `--skip-hotspot-metadata-sync` | — | No | — | Skip syncing hotspot metadata (statuses, comments) after transfer |
| `--skip-quality-profile-sync` | — | No | — | Skip syncing quality profiles (projects use default SonarCloud profiles) |
| `--concurrency <n>` | — | No | Integer | Override the maximum concurrency for I/O operations (applies to source extraction, hotspot extraction, issue sync, and hotspot sync) |
| `--max-memory <mb>` | — | No | Integer | Set the max heap size in MB; auto-restarts with increased heap if needed |
| `--project-concurrency <n>` | — | No | Integer | Maximum number of projects to migrate concurrently |
| `--auto-tune` | — | No | — | Auto-detect hardware and set optimal concurrency, memory, and project-concurrency values |
| `--skip-all-branch-sync` | — | No | — | Only sync the main branch of each project (skip non-main branches). Equivalent to setting `transfer.syncAllBranches: false` in config |
| `--only <components>` | — | No | Comma-separated list | Only migrate specific components. Valid values: `scan-data`, `scan-data-all-branches`, `portfolios`, `quality-gates`, `quality-profiles`, `permission-templates`, `permissions`, `issue-metadata`, `hotspot-metadata`, `project-settings` |

<!-- Updated: Feb 21, 2026 at 10:30:00 AM -->
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

# Migration skipping quality profile sync (use default SonarCloud profiles)
./cloudvoyager migrate -c migrate-config.json --verbose --skip-quality-profile-sync

# Migration skipping quality profile sync with auto-tune
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune --skip-quality-profile-sync

# Migration skipping quality profiles and all metadata syncs
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune --skip-issue-metadata-sync --skip-hotspot-metadata-sync --skip-quality-profile-sync

# Selective migration: only scan data (main branch)
./cloudvoyager migrate -c migrate-config.json --verbose --only scan-data

# Selective migration: only scan data (all branches)
./cloudvoyager migrate -c migrate-config.json --verbose --only scan-data-all-branches

# Selective migration: only quality gates
./cloudvoyager migrate -c migrate-config.json --verbose --only quality-gates

# Selective migration: only quality profiles
./cloudvoyager migrate -c migrate-config.json --verbose --only quality-profiles

# Selective migration: only permissions (groups + global + project)
./cloudvoyager migrate -c migrate-config.json --verbose --only permissions

# Selective migration: only permission templates
./cloudvoyager migrate -c migrate-config.json --verbose --only permission-templates

# Selective migration: only portfolios
./cloudvoyager migrate -c migrate-config.json --verbose --only portfolios

# Selective migration: only issue metadata
./cloudvoyager migrate -c migrate-config.json --verbose --only issue-metadata

# Selective migration: only hotspot metadata
./cloudvoyager migrate -c migrate-config.json --verbose --only hotspot-metadata

# Selective migration: only project settings
./cloudvoyager migrate -c migrate-config.json --verbose --only project-settings

# Selective migration: combine multiple components
./cloudvoyager migrate -c migrate-config.json --verbose --only scan-data,quality-gates,permissions

# Selective migration with auto-tune
./cloudvoyager migrate -c migrate-config.json --verbose --auto-tune --only scan-data-all-branches

# Selective migration with project concurrency
./cloudvoyager migrate -c migrate-config.json --verbose --project-concurrency 3 --only scan-data
```

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### `sync-metadata` — Sync issue and hotspot metadata for already-migrated projects

| Flag | Short | Required | Argument | Description |
|------|-------|----------|----------|-------------|
| `--config <path>` | `-c` | Yes | File path | Path to the migration configuration file |
| `--verbose` | `-v` | No | — | Enable debug-level logging for detailed output |
| `--skip-issue-metadata-sync` | — | No | — | Skip syncing issue metadata (statuses, assignments, comments, tags); only sync hotspot metadata |
| `--skip-hotspot-metadata-sync` | — | No | — | Skip syncing hotspot metadata (statuses, comments); only sync issue metadata |
| `--skip-quality-profile-sync` | — | No | — | Skip syncing quality profiles (projects use default SonarCloud profiles) |
| `--concurrency <n>` | — | No | Integer | Override the maximum concurrency for I/O operations (issue sync, hotspot sync, hotspot extraction) |
| `--max-memory <mb>` | — | No | Integer | Set the max heap size in MB; auto-restarts with increased heap if needed |
| `--auto-tune` | — | No | — | Auto-detect hardware and set optimal concurrency and memory values |
| `--skip-all-branch-sync` | — | No | — | Only sync the main branch of each project (skip non-main branches). Equivalent to setting `transfer.syncAllBranches: false` in config |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
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

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🧹 Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint:fix
```

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🧪 Running Tests

```bash
# Run tests with coverage
npm test

# Run tests without coverage (faster)
npm run test:fast
```

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🌍 Environment Variables

| Variable | Description |
|----------|-------------|
| `LOG_LEVEL` | Set logging level: `debug`, `info`, `warn`, `error` |
| `LOG_FILE` | Path to log file (optional, logs to console by default) |
| `SONARQUBE_TOKEN` | Override SonarQube token from config |
| `SONARCLOUD_TOKEN` | Override SonarCloud token from config |
| `SONARQUBE_URL` | Override SonarQube URL from config |
| `SONARCLOUD_URL` | Override SonarCloud URL from config |
| `MAX_SOURCE_FILES` | Limit number of source files to extract (`0` = all) |

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Examples with environment variables

```bash
# Run with debug logging to a file
LOG_LEVEL=debug LOG_FILE=./cloudvoyager.log ./cloudvoyager migrate -c migrate-config.json --verbose

# Override tokens via environment
SONARQUBE_TOKEN=sqp_xxx SONARCLOUD_TOKEN=sqa_yyy ./cloudvoyager transfer -c config.json --verbose

# Limit source files for testing
MAX_SOURCE_FILES=10 ./cloudvoyager transfer -c config.json --verbose
```

---

<!-- Updated: Feb 21, 2026 at 10:30:00 AM -->
## ⚡ npm Scripts

The following npm scripts are available for building, testing, and linting:

| What it does | npm script |
|-------------|-----------|
| Run CLI (no arguments) | `npm start` |
| Install dependencies | `npm install` |
| Bundle JavaScript only | `npm run build` |
| Build binary for current platform (Node.js SEA) | `npm run package` |
| Build binary via Bun (experimental) | `npm run package:bun` |
| Cross-compile via Bun (experimental) | `npm run package:bun:cross` |
| Run tests with coverage | `npm test` |
| Run tests (no coverage) | `npm run test:fast` |
| Lint | `npm run lint` |
| Lint with auto-fix | `npm run lint:fix` |
| Validate config | `npm run validate` |
| Test connections | `npm run test:connection` |
| Check sync status | `npm run status` |
| Reset state | `npm run reset` |
| Transfer single project | `npm run transfer` |
| Transfer single project (auto-tune) | `npm run transfer:auto-tune` |
| Transfer all projects | `npm run transfer-all` |
| Transfer all projects (dry-run) | `npm run transfer-all:dry-run` |
| Transfer all projects (auto-tune) | `npm run transfer-all:auto-tune` |
| Full migration | `npm run migrate` |
| Full migration (dry-run) | `npm run migrate:dry-run` |
| Full migration (auto-tune) | `npm run migrate:auto-tune` |
| Migration, skip issue metadata | `npm run migrate:skip-issue-metadata` |
| Migration, skip hotspot metadata | `npm run migrate:skip-hotspot-metadata` |
| Migration, skip all metadata | `npm run migrate:skip-all-metadata` |
| Migration, skip all metadata (auto-tune) | `npm run migrate:skip-all-metadata:auto-tune` |
| Migration, skip quality profiles | `npm run migrate:skip-quality-profiles` |
| Migration, skip quality profiles (auto-tune) | `npm run migrate:skip-quality-profiles:auto-tune` |
| Migration, skip all (metadata + profiles, auto-tuned) | `npm run migrate:skip-all` |
| Migration, only scan data (main branch) | `npm run migrate:only-scan-data` |
| Migration, only scan data (all branches) | `npm run migrate:only-scan-data-all-branches` |
| Migration, only quality gates | `npm run migrate:only-quality-gates` |
| Migration, only quality profiles | `npm run migrate:only-quality-profiles` |
| Migration, only permissions | `npm run migrate:only-permissions` |
| Migration, only permission templates | `npm run migrate:only-permission-templates` |
| Migration, only portfolios | `npm run migrate:only-portfolios` |
| Migration, only issue metadata | `npm run migrate:only-issue-metadata` |
| Migration, only hotspot metadata | `npm run migrate:only-hotspot-metadata` |
| Migration, only project settings | `npm run migrate:only-project-settings` |
| Sync metadata (issues + hotspots) | `npm run sync-metadata` |
| Sync metadata (auto-tune) | `npm run sync-metadata:auto-tune` |
| Sync metadata, skip issue metadata | `npm run sync-metadata:skip-issue-metadata` |
| Sync metadata, skip hotspot metadata | `npm run sync-metadata:skip-hotspot-metadata` |
| Sync metadata, skip quality profiles | `npm run sync-metadata:skip-quality-profiles` |

> **Note:** Always use the built binary to run CloudVoyager commands (e.g. `./cloudvoyager migrate -c ...`). See the [CLI Reference](#-cli-reference) section for all available commands and flags.

---

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📚 Further Reading

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Architecture](architecture.md) — project structure, data flow, report format
- [Technical Details](technical-details.md) — protobuf encoding, measure types, active rules
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them

<!--
## Change Log
| Date | Section | Change |
|------|---------|--------|
| 2026-02-21 | Bun Compile | Fixed dependency type: optionalDependency not devDependency |
| 2026-02-19 | Building, CLI Reference, Tests, npm Scripts | API expansion, test suite, bun builds |
| 2026-02-18 | Output, transfer, transfer-all, migrate | --wait flag, --auto-tune, Windows ARM64 |
| 2026-02-17 | Quick Start, sync-metadata | Migration engine commands |
| 2026-02-16 | Prerequisites, Running, validate, test, status, reset, Linting, Env Vars | Core CLI commands |
-->
