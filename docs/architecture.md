# 🏗️ Architecture

<!-- Last updated: Mar 19, 2026 -->

<!-- Updated: Mar 19, 2026 -->
## 📁 Project Structure

CloudVoyager uses a **pipeline-per-version** architecture. Each supported SonarQube version range has its own self-contained pipeline, while shared (version-independent) code lives in `src/shared/`.

```
src/
├── index.js                          # CLI entry point (Commander-based)
├── version-router.js                 # Detects SQ version, loads correct pipeline
├── commands/                         # CLI command handlers
│   ├── transfer.js                    # Single-project transfer command
│   ├── migrate.js                     # Full migration command
│   ├── sync-metadata.js               # Standalone metadata sync command
│   └── verify.js                      # Migration verification command
├── pipelines/                        # Version-specific pipeline implementations
│   ├── sq-9.9/                        # SonarQube 9.9 LTS
│   ├── sq-10.0/                       # SonarQube 10.0–10.3
│   ├── sq-10.4/                       # SonarQube 10.4–10.8
│   └── sq-2025/                       # SonarQube 2025.1+
└── shared/                           # Version-independent shared code
    ├── config/                        # Configuration loading and validation
    │   ├── loader.js                   # Config loading (Ajv + ajv-formats) for transfer commands
    │   ├── loader-migrate.js           # Config loading for migrate/sync-metadata commands
    │   ├── schema.js                   # JSON schema for transfer config
    │   ├── schema-migrate.js           # JSON schema for migration config
    │   └── schema-shared.js            # Shared schema definitions (performance, rateLimit)
    ├── mapping/                       # Organization mapping and CSV tools
    │   ├── org-mapper.js               # Map projects to target orgs (by DevOps binding)
    │   ├── csv-generator.js            # Generate mapping CSVs for review
    │   ├── csv-tables.js               # CSV table formatting helpers
    │   ├── csv-reader.js               # Parse CSV files from dry-run output
    │   └── csv-applier.js              # Apply CSV overrides to filter/modify extracted data
    ├── reports/                       # Migration report generation
    │   ├── index.js                    # Report generation orchestrator
    │   ├── shared.js                   # Shared report utilities
    │   ├── format-text.js              # Plain text report formatter
    │   ├── format-markdown.js          # Markdown report formatter
    │   ├── format-markdown-executive.js # Executive summary markdown formatter
    │   ├── format-performance.js       # Performance report formatter
    │   ├── format-pdf.js               # PDF report formatter
    │   ├── format-pdf-executive.js     # Executive summary PDF formatter
    │   ├── format-pdf-performance.js   # Performance report PDF formatter
    │   ├── pdf-helpers.js              # Shared PDF generation helpers
    │   ├── pdf-sections.js             # PDF report section builders
    │   ├── pdf-exec-sections.js        # Executive summary PDF section builders
    │   ├── pdf-perf-sections.js        # Performance report PDF section builders
    │   └── perf-tables.js              # Performance data table formatters
    ├── state/                         # State management and persistence
    │   ├── storage.js                  # File-based state persistence (atomic write, backup rotation)
    │   ├── tracker.js                  # Incremental transfer state tracking (with lock integration)
    │   ├── lock.js                     # Advisory lock files for concurrent run prevention
    │   ├── checkpoint.js               # Phase-level checkpoint journal for pause/resume
    │   ├── extraction-cache.js         # Disk-cached extraction results (gzipped JSON)
    │   └── migration-journal.js        # Multi-project migration progress tracking
    ├── utils/                         # Utility modules
    │   ├── logger.js                   # Winston-based logging
    │   ├── errors.js                   # Custom error classes (LockError, StaleResumeError, etc.)
    │   ├── concurrency.js              # Concurrency primitives (limiter, mapConcurrent, progress)
    │   ├── system-info.js              # System info detection (CPU, memory) and auto-tune
    │   ├── shutdown.js                 # Graceful SIGINT/SIGTERM shutdown coordinator
    │   ├── progress.js                 # Checkpoint progress display and ETA
    │   └── version.js                  # SonarQube version parsing and comparison
    └── verification/                  # Migration verification
        ├── verify-pipeline.js          # Verification orchestrator (read-only comparison)
        ├── checkers/                   # Per-check verification modules
        │   ├── issues.js               # Issue matching and verification
        │   ├── hotspots.js             # Hotspot matching and verification
        │   ├── branches.js             # Branch parity verification
        │   ├── measures.js             # Metrics comparison
        │   ├── quality-gates.js        # Quality gate verification
        │   ├── quality-profiles.js     # Quality profile verification
        │   ├── groups.js               # User group verification
        │   ├── permissions.js          # Permission verification
        │   ├── project-config.js       # Project config verification
        │   └── portfolios.js           # Portfolio verification (reference)
        └── reports/                    # Verification report generation
            ├── index.js                # Report orchestrator (JSON + MD + PDF + console)
            ├── format-markdown.js      # Markdown verification report
            └── format-pdf.js           # PDF verification report
```

### Version-Specific Pipeline Structure

Each pipeline under `src/pipelines/sq-{version}/` has an identical directory layout:

```
sq-{version}/
├── transfer-pipeline.js           # Single-project transfer orchestrator
├── migrate-pipeline.js            # Full multi-org migration orchestrator
├── sonarqube/                     # SonarQube integration (version-specific behavior hardcoded)
│   ├── api-client.js               # HTTP client with pagination, auth, SCM revision
│   ├── models.js                   # Data models (with language support)
│   ├── api/                        # API method modules
│   │   ├── issues-hotspots.js       # Issue and hotspot API methods
│   │   ├── permissions.js           # Permission API methods
│   │   ├── quality.js               # Quality gate and profile API methods
│   │   └── server-config.js         # Server info, settings, webhooks API methods
│   └── extractors/                 # Specialized data extractors
│       ├── index.js                 # DataExtractor orchestrator
│       ├── projects.js, issues.js, hotspots.js, measures.js, sources.js, ...
│       └── (25+ extractor modules)
├── protobuf/                      # Protobuf encoding (version-specific schema/builder)
│   ├── builder.js                   # Orchestrates protobuf message building
│   ├── build-components.js          # Component protobuf messages
│   ├── build-issues.js              # Issue protobuf messages
│   ├── build-external-issues.js     # External issue protobuf messages
│   ├── build-duplications.js        # Duplication protobuf messages
│   ├── build-measures.js            # Measure protobuf messages
│   ├── encoder.js                   # Encodes messages using protobufjs
│   ├── encode-types.js              # Typed encoding helpers
│   └── schema/                      # .proto definitions
│       ├── scanner-report.proto
│       └── constants.proto
├── sonarcloud/                    # SonarCloud integration (version-specific migrators)
│   ├── api-client.js               # SonarCloud HTTP client (retry, throttle)
│   ├── uploader.js                 # Report packaging and CE submission
│   ├── enterprise-client.js        # Enterprise edition API client
│   ├── rule-enrichment.js          # Rule enrichment from SonarCloud (sq-9.9 uses this)
│   ├── api/                        # API method modules
│   │   ├── hotspots.js, issues.js, permissions.js, project-config.js, ...
│   └── migrators/                  # SonarCloud migration modules
│       ├── quality-gates.js, quality-profiles.js, groups.js, permissions.js, ...
│       ├── issue-sync.js            # Sync issue statuses, assignments, comments, tags
│       └── hotspot-sync.js          # Sync hotspot statuses and comments
└── pipeline/                      # Migration pipeline stages
    ├── extraction.js                # Server-wide data extraction orchestration
    ├── org-migration.js             # Per-organization migration logic
    ├── project-migration.js         # Per-project migration logic
    └── results.js                   # Migration result tracking and aggregation
```

<!-- Updated: Mar 19, 2026 -->
## 🔄 Version Routing

`version-router.js` detects the SonarQube server version and dynamically imports the correct pipeline:

1. Makes a lightweight `GET /api/system/status` call to get the server version
2. Maps the version to a pipeline: `sq-9.9`, `sq-10.0`, `sq-10.4`, or `sq-2025`
3. Dynamically imports `transfer-pipeline.js` and `migrate-pipeline.js` from the selected pipeline
4. Returns the pipeline functions to the calling command

No runtime version checks exist within any pipeline — each pipeline has its behavior hardcoded for its target SonarQube version range.

| SQ Version | Pipeline | Key Differences |
|------------|----------|-----------------|
| 9.9 LTS | sq-9.9 | Legacy `statuses` param, Clean Code enriched from SonarCloud |
| 10.0–10.3 | sq-10.0 | Legacy `statuses` param, native Clean Code |
| 10.4–10.8 | sq-10.4 | Modern `issueStatuses` param |
| 2025.1+ | sq-2025 | Modern `issueStatuses` param, Web API V2 with fallbacks |

<!-- Updated: Mar 19, 2026 -->
## 🔄 Commands and Pipelines

<!-- Updated: Mar 19, 2026 -->
### `transfer` — Single Project

Uses `pipelines/sq-{version}/transfer-pipeline.js` (selected by version-router):

1. **Load config** — validate and apply env var overrides
2. **Initialize state** — load previous state for incremental transfers
3. **Acquire lock file** — prevent concurrent runs on the same project
4. **Initialize checkpoint journal** — load or create checkpoint for pause/resume
5. **Test connections** — verify SonarQube and SonarCloud connectivity
6. **Extract data** — extract project data from SonarQube (issues, sources, measures, etc.)
7. **Build messages** — transform extracted data into protobuf message structures
8. **Encode** — encode messages to binary protobuf format
9. **Upload** — submit encoded report to SonarCloud CE endpoint
10. **Release lock** — release the advisory lock file
11. **Update state** — record successful transfer in state file

Interrupted transfers resume from the last completed checkpoint phase, skipping already-finished steps.

<!-- Updated: Mar 19, 2026 -->
### `migrate` — Full Multi-Org Migration

Uses `pipelines/sq-{version}/migrate-pipeline.js` (selected by version-router):

1. **Extract server-wide data** — projects, quality gates, quality profiles, groups, permissions, templates, portfolios, DevOps bindings, server info, webhooks
2. **Generate organization mappings** — map projects to target orgs by DevOps binding, generate CSV files for review
3. **Save server info** — write system, plugins, settings, webhooks, ALM settings as JSON reference files
4. **Initialize migration journal** — load or create journal tracking per-org and per-project progress
5. **For each target organization:**
   - Create groups
   - Set global permissions
   - Create quality gates
   - Restore quality profiles (custom via backup XML, built-in as renamed custom profiles)
   - Compare quality profiles and write diff report (`quality-profiles/quality-profile-diff.json`)
   - Create permission templates
   - For each project:
     - Resolve project key (use original SonarQube key; fall back to `{org}_{key}` if taken globally)
     - Upload scanner report (via transfer pipeline)
     - Sync issue statuses, assignments, comments, tags
     - Sync hotspot statuses and comments
     - Set project settings, tags, links, new code periods
     - Set DevOps binding
     - Assign quality gate
     - Assign migrated built-in quality profiles
     - Set project-level permissions
   - Create portfolios and assign projects

On resume, completed organizations and projects are skipped based on the migration journal.

<!-- Updated: Mar 4, 2026 at 12:00:00 PM -->
### `verify` — Migration Verification

Uses `shared/verification/verify-pipeline.js`:

1. **Connect to SonarQube** — verify connectivity
2. **Fetch project list** — get all projects from SonarQube
3. **Build org mappings** — map projects to target orgs (same logic as `migrate`)
4. **For each target organization:**
   - Verify quality gates (existence + conditions)
   - Verify quality profiles (existence + rule counts)
   - Verify groups
   - Verify global permissions
   - Verify permission templates
   - For each project:
     - Verify project exists in SonarCloud
     - Verify branches (SQ vs SC)
     - Verify issues (matched by rule+file+line; compare statuses, status history via changelog, assignments, comments, tags)
     - Verify hotspots (matched by rule+file+line; compare statuses, comments)
     - Verify measures (18 key metrics)
     - Verify quality gate and profile assignments
     - Verify project settings, tags, links, new code periods, DevOps bindings
     - Verify project permissions
5. **Portfolio check** — reference verification (SQ only)
6. **Generate reports** — JSON, Markdown, PDF, and console summary

<!-- Updated: Mar 19, 2026 -->
## 🧩 Key Design Patterns

- **Extractor Pattern** — specialized modules for each data type with consistent interface
- **Migrator Pattern** — specialized modules for each SonarCloud migration target
- **Client-Service Pattern** — API clients handle HTTP, services handle business logic
- **Builder Pattern** — ProtobufBuilder constructs complex message structures
- **State Pattern** — StateTracker manages transfer state for incremental sync
- **Checkpoint Pattern** — write-ahead journal tracks phase completion for crash recovery
- **Lock Pattern** — advisory lock files prevent concurrent runs with stale detection
- **Error Hierarchy** — custom error classes provide specific error handling
- **Concurrency Pattern** — `mapConcurrent` replaces sequential loops with bounded parallel execution

<!-- Updated: Mar 19, 2026 -->
## ⚡ Concurrency and Performance

CloudVoyager uses a zero-dependency concurrency layer (`src/shared/utils/concurrency.js`) for parallel I/O:

- **`createLimiter(concurrency)`** — p-limit equivalent for bounding concurrent async operations
- **`mapConcurrent(items, fn, opts)`** — parallel map with concurrency limit, `settled` mode (continue on errors), and progress callbacks
- **`resolvePerformanceConfig(rawConfig)`** — merges user config with CPU-aware defaults
- **`createProgressLogger(label, total)`** — progress logging callback for long-running concurrent ops

Extractors and migrators use `mapConcurrent` to parallelize HTTP calls (source file fetching, hotspot detail fetching, issue/hotspot sync). Each version-specific `migrate-pipeline.js` resolves performance config and passes concurrency settings to all operations.

<!-- Updated: Mar 19, 2026 -->
## 📦 Build and Packaging

CloudVoyager uses **esbuild + Node.js SEA** (Single Executable Applications) as the default, stable packaging pipeline. An experimental **Bun compile** pipeline is also available but may silently crash at runtime in some environments.

<!-- Updated: Mar 19, 2026 -->
### Build Process (`scripts/build.js`)

**Default (Node.js SEA):** Two-step — esbuild bundles `src/index.js` into `dist/cli.cjs` (with `.proto` schemas inlined as text), then Node.js SEA packages it into a standalone binary with V8 code cache via postject.

**Experimental (Bun):** Single-step compile — Bun bundles all source files (including `.proto` schemas as text via `--loader .proto:text`) and compiles to a native binary in one command. No intermediate bundle file. Faster builds but less stable at runtime.

<!-- Updated: Mar 19, 2026 -->
### Output Structure

```
dist/
├── cli.cjs              # Bundled CLI (bundle-only build)
├── sea-config.json      # SEA configuration
├── sea-prep.blob        # SEA blob
└── bin/                 # Standalone binaries
    ├── cloudvoyager-macos-arm64      # Node.js SEA
    ├── cloudvoyager-macos-x64        # Node.js SEA
    ├── cloudvoyager-linux-x64        # Node.js SEA
    ├── cloudvoyager-linux-arm64      # Node.js SEA
    ├── cloudvoyager-win-x64.exe      # Node.js SEA
    └── cloudvoyager-win-arm64.exe    # Node.js SEA
```

<!-- Updated: Mar 19, 2026 -->
### Build Commands

```bash
npm run build            # Bundle only via esbuild (dist/cli.cjs)
npm run package          # Node.js SEA binary for current platform (default)
node scripts/build.js --package --target=macos-x64  # Cross-compile for a different platform
npm run package:bun      # Bun compile for current platform (experimental)
npm run package:bun:cross # Bun cross-compile 5 platforms (experimental)
```

CI uses 6 parallel jobs — one per platform. Most build natively on their target runner; macOS x64 cross-compiles from an ARM64 runner by downloading the target Node.js binary.

All CLI flags (`--concurrency`, `--max-memory`, `--project-concurrency`) work identically whether running via `node src/index.js`, `node dist/cli.cjs`, or the standalone binary.

<!-- Updated: Mar 19, 2026 -->
## 📄 Generated Report Structure

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

Measures are only generated for file components (no project-level `measures-1.pb`). Components use a flat structure where all files are direct children of the project (no directory components).

<!-- Updated: Mar 13, 2026 at 12:00:00 PM -->
## 🖥️ Desktop App Architecture

CloudVoyager Desktop is an Electron application in the `desktop/` directory that wraps the CLI binary with a guided wizard UI.

### Directory Structure

```
desktop/
├── package.json              # Electron app config and build scripts
├── electron-builder.yml      # Cross-platform packaging config
├── scripts/
│   └── prepare-cli.js        # Copies CLI binary for local development
├── src/
│   ├── main/
│   │   ├── main.js           # Electron main process, window creation
│   │   ├── cli-runner.js     # Spawns CLI binary, pipes stdout/stderr via IPC
│   │   ├── ipc-handlers.js   # All IPC channel registrations
│   │   └── config-store.js   # electron-store wrapper (encrypted token storage)
│   ├── preload/
│   │   └── preload.js        # contextBridge API exposed to renderer
│   └── renderer/
│       ├── index.html        # Single HTML entry point
│       ├── styles/           # CSS (dark theme)
│       └── js/
│           ├── app.js        # Hash-based screen router
│           ├── screens/      # Wizard screens (welcome, transfer, migrate, etc.)
│           └── components/   # Reusable UI (log viewer, form builder, wizard nav, sidebar history)
├── resources/
│   └── cli/                  # CLI binary placed here at build time
└── assets/                   # App icons (PNG, ICNS, ICO)
```

### How It Works

1. **Config Wizard** — User fills out forms in the renderer process
2. **Config Persistence** — Settings saved to `electron-store` (encrypted tokens at rest)
3. **CLI Execution** — Main process writes a temp config JSON, spawns the CLI binary with appropriate flags
4. **Log Streaming** — CLI stdout/stderr piped line-by-line via IPC to the renderer's log viewer
5. **Cancellation** — SIGTERM on Unix, `taskkill` on Windows
6. **Run History** — Successful runs are recorded in `electron-store` and displayed in a sidebar list for quick access to past reports

The renderer uses vanilla HTML/CSS/JS with no build step. Security follows Electron best practices: `contextIsolation: true`, `nodeIntegration: false`, all Node.js access via `contextBridge`.

## 📚 Further Reading

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Technical Details](technical-details.md) — protobuf encoding, measure types, concurrency model
- [Key Capabilities](key-capabilities.md) — comprehensive overview of engineering and capabilities
- [Pseudocode Explanation](pseudocode-explanation.md) — every feature documented in pseudocode
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them
- [Desktop App Guide](desktop-app.md) — installation, wizard walkthrough, and building from source
- [Changelog](CHANGELOG.md) — release history and notable changes

<!--
## Change Log
| Date | Section | Change |
|------|---------|--------|
| 2026-03-04 | Commands, Verification | Added issue status history (changelog) verification |
| 2026-02-28 | Project Structure, Commands | Added verify command and verification subsystem |
| 2026-02-19 | Project Structure, Commands, Build | API expansion, pipeline refactor, Node 21 build |
| 2026-02-18 | Output Structure, Reports | Windows ARM64, report generation |
| 2026-02-17 | Commands, Patterns, Concurrency | Migration engine, concurrency tuning |
| 2026-02-16 | All | Initial architecture documentation |
-->
