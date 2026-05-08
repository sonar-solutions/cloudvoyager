# Core Technologies

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CloudVoyager is built on a carefully selected stack of battle-tested open-source technologies. Each technology was chosen to address specific requirements of the SonarQube Server-to-SonarQube Cloud migration workflow.

## 1. Node.js

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

### Why Node.js

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Node.js provides the ideal foundation for a cross-platform CLI tool that interfaces with REST APIs. The choice delivers:

- **Cross-platform consistency** — Same JavaScript runtime on Windows, macOS, and Linux eliminates platform-specific bug hunting
- **Native async I/O** — Non-blocking HTTP requests align perfectly with the I/O-heavy migration workflow (fetching issues, uploading reports)
- **Ecosystem richness** — Access to mature packages for HTTP clients, logging, and CLI building without reinventing the wheel
- **ESM module support** — Native ES Modules (`"type": "module"`) enable clean static imports across the codebase

### Runtime Version Requirements

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

| Role | Minimum Version | Notes |
|------|----------------|-------|
| Development / CLI | Node 18+ | Required by `engines.node` in `package.json` |
| SEA Binary Packaging | Node 20 | Node 22+ embeds the sentinel twice, causing `postject` to fail |

### Single Executable Application (SEA)

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CloudVoyager ships as a standalone binary using Node.js SEA (Single Executable Application). The build pipeline:

1. Bundles the CLI with `esbuild` into `dist/cli.cjs`
2. Generates an SEA blob via `node --experimental-sea-config`
3. Injects the blob into the Node binary using `postject`
4. Re-signs macOS binaries with `codesign`

This approach produces a distributable binary that does not require the end user to have Node.js installed.

## 2. Protobuf

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

### Why Protobuf

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

SonarQube Cloud accepts scanner reports only in Protocol Buffer format. Protobuf was chosen because:

- **SonarQube Cloud API requirement** — The scanner report upload endpoint expects a binary-encoded Protobuf payload, not JSON
- **Compact binary encoding** — Protobuf messages are significantly smaller than equivalent JSON, reducing upload time for large codebases
- **Strict schema enforcement** — The `.proto` schema definitions (`scanner-report.proto`) catch structural errors at build time rather than at upload time
- **Language neutrality** — The same schema is used across all supported SonarQube Server versions (9.9, 10.0, 10.4, 2025.1)

### Protobuf Schema

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The scanner report schema lives at:

```
src/pipelines/sq-2025/protobuf/schema/scanner-report.proto
```

Key message types defined in the schema:

- `Metadata` — Report-level information (project key, analysis mode, timestamp)
- `Component` — Source files and directories in the project
- `Issue` — Code issues (bugs, vulnerabilities, code smells)
- `Measure` — Quality metrics (coverage, duplications, complexity)
- `Changesets` — Git history per component
- `ExternalIssue` — Issues from external linters
- `Duplication` — Code duplication groups

### Protobufjs Integration

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The project uses `protobufjs` (v7.2.0) for runtime schema loading and encoding. The encoder factory is in:

```
src/pipelines/sq-2025/protobuf/encoder/helpers/create-protobuf-encoder.js
```

## 3. Winston

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

### Why Winston

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Structured logging is critical for a migration tool that may run unattended in CI environments. Winston (v3.11.0) was chosen because:

- **Multiple transport targets** — Logs can be written to the console, to files, and to custom destinations simultaneously
- **Log level filtering** — granular control over verbosity (`error`, `warn`, `info`, `debug`) without code changes
- **Structured metadata** — Supports attaching contextual objects (project key, branch name, migration phase) to log entries
- **Timestamp formatting** — Consistent, readable timestamps on every log line
- **Colorization** — Human-readable colored output in terminal; plain output when redirected to files

### Logger Usage in CloudVoyager

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The logger is initialized per the migration context and exported from:

```
src/shared/utils/logger/index.js
```

Commands and pipeline stages import and configure the logger with context-specific metadata:

```javascript
import { logger } from '../../shared/utils/logger/index.js';

logger.info('Starting migration', { projectKey: 'my-project', branch: 'main' });
```

## 4. Commander.js

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

### Why Commander.js

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Commander.js (v12.0.0) is the de facto standard for Node.js CLI frameworks. The choice is driven by:

- **Zero-configuration subcommands** — Each migration subcommand (`migrate`, `verify`, `sync-metadata`) is registered as a separate module
- **Built-in version flag** — `--version` and `-V` work automatically after a single `.version()` call
- **Typed options** — boolean flags (`--verbose`), value options (`-c config.json`), and variadic arguments all handled declaratively
- **Automatic help generation** — `cloudvoyager --help` produces formatted documentation from the registered commands
- **Minimal footprint** — Ships with CloudVoyager as a production dependency

### Command Architecture

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The CLI entry point at `src/index.js` registers all subcommands:

```
src/commands/
  migrate.js          — Full migration workflow
  transfer.js         — Data transfer operations
  verify.js           — Verify migrated data
  sync-metadata.js    — Sync quality gates and profiles
  reset.js            — Reset migration state
  status.js           — Show migration status
  validate.js         — Validate configuration
  test-connection.js — Test SonarQube Server/SonarQube Cloud connectivity
```

## 5. Ajv

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

### Why Ajv

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Configuration errors should be caught before any migration work begins. Ajv (v8.12.0) was chosen because:

- **JSON Schema draft-07 compliance** — Industry-standard schema language with broad tooling support
- **Strict validation** — `additionalProperties: false` ensures configs do not contain typos or unknown keys
- **Default value injection** — Ajv can populate optional fields with schema defaults, reducing repetitive config
- **Formatted validation** — `ajv-formats` adds validation for common formats (`uri`, `date-time`, `uuid`)
- **Detailed error messages** — Each validation error includes the JSON path (`instancePath`) and a human-readable message

### Schema Hierarchy

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The configuration is validated against a layered schema structure:

```
src/shared/config/schema-migrate/helpers/migrate-config-schema.js
src/shared/config/schema-shared/helpers/rate-limit-schema.js
src/shared/config/schema-shared/helpers/performance-schema.js
src/shared/config/schema.js
```

Top-level schema references sub-schemas for `sonarqube`, `sonarcloud`, `transfer`, `migrate`, `rateLimit`, and `performance` sections.

### Validation Flow

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

```
loadConfig() → validateConfig() → throws ValidationError on failure
```

The validator is compiled once and reused across all config loads, avoiding repeated compilation overhead.

## 6. Electron

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

### Why Electron

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

While CloudVoyager is primarily a CLI tool, a desktop GUI is provided for users who prefer a visual interface. Electron (v33.4.11) was chosen because:

- **Cross-platform desktop** — Same codebase runs on Windows, macOS, and Linux
- **Chromium rendering** — Modern HTML/CSS UI with full Flexbox and CSS Grid support
- **Node.js integration** — The desktop app can invoke the CLI directly, sharing all migration logic
- **IPC architecture** — Renderer process communicates with main process via typed IPC channels, keeping the UI responsive
- **Native OS integration** — Window management, system dialogs, and single-instance enforcement work out of the box

### Desktop App Architecture

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

```
desktop/src/
  main/main.js         — Electron main process (window management, IPC)
  preload/preload.js   — Context bridge (exposes safe IPC methods to renderer)
  renderer/            — HTML, CSS, and frontend JavaScript
  config-store.js      — Persistent config storage (electron-store)
  ipc-handlers.js      — Handlers for CLI invocations from the UI
```

### Building Desktop Binaries

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

The desktop app is packaged with `electron-builder`. Each platform is built separately:

```bash
npm run build:mac-arm64   # macOS Apple Silicon
npm run build:mac-x64     # macOS Intel
npm run build:win-x64     # Windows x64
npm run build:linux-x64   # Linux x64
npm run build:linux-arm64 # Linux ARM64
```

## 7. GitHub Actions

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

### Why GitHub Actions

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

CI/CD is implemented entirely in GitHub Actions because:

- **Native to the repository** — No external CI service configuration required
- **Matrix builds** — Test across Node.js versions, platforms, and SonarQube Server versions in parallel
- **Artifact sharing** — `actions/cache` (not `actions/upload-artifact`) passes build artifacts between jobs
- **Workflow composition** — Reusable workflows (`workflow_call`) allow `build.yml` to be composed into release pipelines
- **Secrets management** — `SONARCLOUD_TOKEN` and `SONARQUBE_TOKEN` stored as repository secrets

### Workflows

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

| Workflow | Purpose |
|----------|---------|
| `unit-tests.yml` | Run AVA unit tests on every push |
| `build.yml` | Build SEA binaries for all 6 platforms |
| `build-desktop.yml` | Build Electron desktop app for all platforms |
| `regression.yml` | End-to-end regression tests with real SonarQube Server/SonarQube Cloud |
| `release.yml` | Create GitHub releases with attached binaries |
| `gh-release.yml` | Draft GitHub release notes |
| `version-bump.yml` | Automated version bumping on main branch |

### Build Strategy for SEA Binaries

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Each platform is built in a dedicated job:

| Platform | Runner | Strategy |
|----------|--------|----------|
| linux-x64 | `ubuntu-latest` | Native build |
| linux-arm64 | `ubuntu-24.04-arm` | Native build |
| macos-arm64 | `macos-latest` | Native build |
| macos-x64 | `macos-latest` | Cross-compile via downloaded Node binary |
| win-x64 | `windows-latest` | Native build |
| win-arm64 | `windows-11-arm` | Native build on ARM runner |

### Regression Testing Strategy

<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Regression workflows spin up real SonarQube Server and SonarQube Cloud instances and run actual migration commands. The workflows use `actions/cache` to share state between jobs rather than artifact uploads, following the project's CI best practice of using cache for inter-job data transfer.
