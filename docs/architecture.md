# 🏗️ Architecture

<!-- Last updated: Mar 4, 2026 at 12:00:00 PM -->

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📁 Project Structure

```
src/
├── index.js                  # CLI entry point (Commander-based)
├── transfer-pipeline.js      # Single-project transfer (extract → build → encode → upload)
├── migrate-pipeline.js       # Full multi-org migration orchestrator
├── commands/                 # CLI command handlers
│   ├── transfer.js            # Single-project transfer command
│   ├── migrate.js             # Full migration command
│   ├── sync-metadata.js       # Standalone metadata sync command
│   └── verify.js              # Migration verification command
├── config/
│   ├── loader.js             # Config loading and validation (Ajv + ajv-formats) for transfer commands
│   ├── loader-migrate.js     # Config loading for migrate/sync-metadata commands
│   ├── schema.js             # JSON schema for transfer config
│   ├── schema-migrate.js     # JSON schema for migration config
│   └── schema-shared.js      # Shared schema definitions (performance, rateLimit)
├── sonarqube/
│   ├── api-client.js         # HTTP client with pagination, auth, SCM revision
│   ├── models.js             # Data models (with language support)
│   ├── api/                  # API method modules (extracted from api-client)
│   │   ├── issues-hotspots.js # Issue and hotspot API methods
│   │   ├── permissions.js     # Permission API methods
│   │   ├── quality.js         # Quality gate and profile API methods
│   │   └── server-config.js   # Server info, settings, webhooks API methods
│   └── extractors/           # Specialized data extractors
│       ├── index.js           # DataExtractor orchestrator
│       ├── projects.js        # Project metadata, branches, quality gates
│       ├── issues.js          # Issues with pagination
│       ├── hotspots.js        # Security hotspots with status and comments
│       ├── metrics.js         # Metric definitions
│       ├── measures.js        # Project and component measures
│       ├── sources.js         # Source code files (with language info)
│       ├── rules.js           # Active rules extraction
│       ├── rule-helpers.js    # Shared rule extraction helpers
│       ├── changesets.js      # SCM changeset data per file
│       ├── symbols.js         # Symbol references
│       ├── syntax-highlighting.js  # Syntax highlighting data
│       ├── quality-gates.js   # Quality gate definitions, conditions, permissions
│       ├── quality-profiles.js # Quality profile definitions, backup XML, permissions
│       ├── groups.js          # User group definitions
│       ├── permissions.js     # Global, project, and template permissions
│       ├── portfolios.js      # Portfolio definitions and membership
│       ├── project-settings.js # Non-inherited project-level settings
│       ├── project-tags.js    # Custom project tags
│       ├── project-links.js   # External project links
│       ├── new-code-periods.js # New code period definitions (per project/branch)
│       ├── devops-bindings.js # ALM/DevOps settings and project bindings
│       ├── server-info.js     # Server version, plugins, settings
│       └── webhooks.js        # Server and project-level webhooks
├── protobuf/
│   ├── builder.js            # Orchestrates protobuf message building
│   ├── build-components.js   # Builds component protobuf messages
│   ├── build-issues.js       # Builds issue protobuf messages
│   ├── build-measures.js     # Builds measure protobuf messages
│   ├── encoder.js            # Encodes messages using protobufjs
│   ├── encode-types.js       # Typed encoding helpers (int, double, string measures)
│   └── schema/               # Protocol buffer definitions (.proto files)
│       ├── scanner-report.proto
│       └── constants.proto
├── sonarcloud/
│   ├── api-client.js         # SonarCloud HTTP client (retry, throttle, quality profiles)
│   ├── uploader.js           # Report packaging (adm-zip, form-data) and CE submission
│   ├── api/                  # API method modules (extracted from api-client)
│   │   ├── hotspots.js        # Hotspot API methods
│   │   ├── issues.js          # Issue API methods
│   │   ├── permissions.js     # Permission API methods
│   │   ├── project-config.js  # Project config API methods
│   │   ├── quality-gates.js   # Quality gate API methods
│   │   └── quality-profiles.js # Quality profile API methods
│   └── migrators/            # SonarCloud migration modules
│       ├── quality-gates.js   # Create gates, assign to projects
│       ├── quality-profiles.js # Restore profiles via backup XML (including built-in as custom)
│       ├── quality-profile-diff.js # Compare SQ vs SC active rules per language
│       ├── groups.js          # Create user groups
│       ├── permissions.js     # Global, project, and template permissions
│       ├── portfolios.js      # Create portfolios, assign projects
│       ├── project-config.js  # Settings, tags, links, new code periods, DevOps bindings
│       ├── issue-sync.js      # Sync issue statuses, assignments, comments, tags
│       └── hotspot-sync.js    # Sync hotspot statuses and comments
├── pipeline/                 # Migration pipeline stages (used by migrate-pipeline.js)
│   ├── extraction.js          # Server-wide data extraction orchestration
│   ├── org-migration.js       # Per-organization migration logic
│   ├── project-migration.js   # Per-project migration logic
│   └── results.js             # Migration result tracking and aggregation
├── mapping/
│   ├── org-mapper.js         # Map projects to target orgs (by DevOps binding)
│   ├── csv-generator.js      # Generate mapping CSVs for review
│   ├── csv-tables.js         # CSV table formatting helpers
│   ├── csv-reader.js         # Parse CSV files from dry-run output
│   └── csv-applier.js        # Apply CSV overrides to filter/modify extracted data
├── reports/                  # Migration report generation
│   ├── index.js               # Report generation orchestrator
│   ├── shared.js              # Shared report utilities
│   ├── format-text.js         # Plain text report formatter
│   ├── format-markdown.js     # Markdown report formatter
│   ├── format-markdown-executive.js # Executive summary markdown formatter
│   ├── format-performance.js  # Performance report formatter
│   ├── format-pdf.js          # PDF report formatter
│   ├── format-pdf-executive.js # Executive summary PDF formatter
│   ├── format-pdf-performance.js # Performance report PDF formatter
│   ├── pdf-helpers.js         # Shared PDF generation helpers
│   ├── pdf-sections.js        # PDF report section builders
│   ├── pdf-exec-sections.js   # Executive summary PDF section builders
│   ├── pdf-perf-sections.js   # Performance report PDF section builders
│   └── perf-tables.js         # Performance data table formatters
├── verification/
│   ├── verify-pipeline.js   # Verification orchestrator (read-only comparison)
│   ├── checkers/            # Per-check verification modules
│   │   ├── issues.js         # Issue matching and status/status history/assignment/comment/tag verification
│   │   ├── hotspots.js       # Hotspot matching and status/comment verification
│   │   ├── branches.js       # Branch parity verification
│   │   ├── measures.js       # Metrics comparison
│   │   ├── quality-gates.js  # Quality gate existence, conditions, and assignment
│   │   ├── quality-profiles.js # Quality profile existence, rules, and assignment
│   │   ├── groups.js         # User group existence
│   │   ├── permissions.js    # Global, project, and template permissions
│   │   ├── project-config.js # Settings, tags, links, new code periods, DevOps bindings
│   │   └── portfolios.js     # Portfolio verification (reference)
│   └── reports/             # Verification report generation
│       ├── index.js          # Report orchestrator (JSON + MD + PDF + console)
│       ├── format-markdown.js # Markdown verification report
│       └── format-pdf.js     # PDF verification report
├── state/
│   ├── storage.js            # File-based state persistence
│   └── tracker.js            # Incremental transfer state tracking
└── utils/
    ├── logger.js             # Winston-based logging
    ├── errors.js             # Custom error classes
    ├── concurrency.js        # Concurrency primitives (limiter, mapConcurrent, progress)
    └── system-info.js        # System info detection (CPU, memory) and auto-tune
```

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔄 Commands and Pipelines

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### `transfer` — Single Project

Uses `transfer-pipeline.js`:

1. **Load config** — validate and apply env var overrides
2. **Initialize state** — load previous state for incremental transfers
3. **Test connections** — verify SonarQube and SonarCloud connectivity
4. **Extract data** — extract project data from SonarQube (issues, sources, measures, etc.)
5. **Build messages** — transform extracted data into protobuf message structures
6. **Encode** — encode messages to binary protobuf format
7. **Upload** — submit encoded report to SonarCloud CE endpoint
8. **Update state** — record successful transfer in state file

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### `migrate` — Full Multi-Org Migration

Uses `migrate-pipeline.js`:

1. **Extract server-wide data** — projects, quality gates, quality profiles, groups, permissions, templates, portfolios, DevOps bindings, server info, webhooks
2. **Generate organization mappings** — map projects to target orgs by DevOps binding, generate CSV files for review
3. **Save server info** — write system, plugins, settings, webhooks, ALM settings as JSON reference files
4. **For each target organization:**
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

<!-- Updated: Mar 4, 2026 at 12:00:00 PM -->
### `verify` — Migration Verification

Uses `verify-pipeline.js`:

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

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🧩 Key Design Patterns

- **Extractor Pattern** — specialized modules for each data type with consistent interface
- **Migrator Pattern** — specialized modules for each SonarCloud migration target
- **Client-Service Pattern** — API clients handle HTTP, services handle business logic
- **Builder Pattern** — ProtobufBuilder constructs complex message structures
- **State Pattern** — StateTracker manages transfer state for incremental sync
- **Error Hierarchy** — custom error classes provide specific error handling
- **Concurrency Pattern** — `mapConcurrent` replaces sequential loops with bounded parallel execution

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## ⚡ Concurrency and Performance

CloudVoyager uses a zero-dependency concurrency layer (`src/utils/concurrency.js`) for parallel I/O:

- **`createLimiter(concurrency)`** — p-limit equivalent for bounding concurrent async operations
- **`mapConcurrent(items, fn, opts)`** — parallel map with concurrency limit, `settled` mode (continue on errors), and progress callbacks
- **`resolvePerformanceConfig(rawConfig)`** — merges user config with CPU-aware defaults
- **`createProgressLogger(label, total)`** — progress logging callback for long-running concurrent ops

Extractors and migrators use `mapConcurrent` to parallelize HTTP calls (source file fetching, hotspot detail fetching, issue/hotspot sync). The `migrate-pipeline.js` resolves performance config and passes concurrency settings to all operations.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📦 Build and Packaging

CloudVoyager uses **esbuild + Node.js SEA** (Single Executable Applications) as the default, stable packaging pipeline. An experimental **Bun compile** pipeline is also available but may silently crash at runtime in some environments.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Build Process (`scripts/build.js`)

**Default (Node.js SEA):** Two-step — esbuild bundles `src/index.js` into `dist/cli.cjs` (with `.proto` schemas inlined as text), then Node.js SEA packages it into a standalone binary with V8 code cache via postject.

**Experimental (Bun):** Single-step compile — Bun bundles all source files (including `.proto` schemas as text via `--loader .proto:text`) and compiles to a native binary in one command. No intermediate bundle file. Faster builds but less stable at runtime.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
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

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
### Build Commands

```bash
npm run build            # Bundle only via esbuild (dist/cli.cjs)
npm run package          # Node.js SEA binary for current platform (default)
npm run package:bun      # Bun compile for current platform (experimental)
npm run package:bun:cross # Bun cross-compile 5 platforms (experimental)
```

CI uses 6 parallel jobs — one per platform — each building a Node.js SEA binary natively on its target runner.

All CLI flags (`--concurrency`, `--max-memory`, `--project-concurrency`) work identically whether running via `node src/index.js`, `node dist/cli.cjs`, or the standalone binary.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
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

## 📚 Further Reading

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Technical Details](technical-details.md) — protobuf encoding, measure types, concurrency model
- [Key Capabilities](key-capabilities.md) — comprehensive overview of engineering and capabilities
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them
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
