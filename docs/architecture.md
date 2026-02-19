# 🏗️ Architecture

## 📁 Project Structure

```
src/
├── index.js                  # CLI entry point (Commander-based)
├── transfer-pipeline.js      # Single-project transfer (extract → build → encode → upload)
├── migrate-pipeline.js       # Full multi-org migration orchestrator
├── commands/                 # CLI command handlers
│   ├── transfer.js            # Single-project transfer command
│   ├── transfer-all.js        # Transfer all projects command
│   ├── migrate.js             # Full migration command
│   └── sync-metadata.js       # Standalone metadata sync command
├── config/
│   ├── loader.js             # Config loading and validation (Ajv) for transfer commands
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
│   ├── uploader.js           # Report packaging and CE submission
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
│   └── csv-tables.js         # CSV table formatting helpers
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
├── state/
│   ├── storage.js            # File-based state persistence
│   └── tracker.js            # Incremental transfer state tracking
└── utils/
    ├── logger.js             # Winston-based logging
    ├── errors.js             # Custom error classes
    ├── concurrency.js        # Concurrency primitives (limiter, mapConcurrent, progress)
    └── system-info.js        # System info detection (CPU, memory) and auto-tune
```

## 🔄 Commands and Pipelines

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

### `transfer-all` — All Projects to Single Org

Uses `transfer-pipeline.js` in a loop:

1. **Discover projects** — list all SonarQube projects, apply exclusions
2. **Map project keys** — apply prefix or explicit key mappings
3. **Transfer each project** — run the single-project pipeline for each

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

## 🧩 Key Design Patterns

- **Extractor Pattern** — specialized modules for each data type with consistent interface
- **Migrator Pattern** — specialized modules for each SonarCloud migration target
- **Client-Service Pattern** — API clients handle HTTP, services handle business logic
- **Builder Pattern** — ProtobufBuilder constructs complex message structures
- **State Pattern** — StateTracker manages transfer state for incremental sync
- **Error Hierarchy** — custom error classes provide specific error handling
- **Concurrency Pattern** — `mapConcurrent` replaces sequential loops with bounded parallel execution

## ⚡ Concurrency and Performance

CloudVoyager uses a zero-dependency concurrency layer (`src/utils/concurrency.js`) for parallel I/O:

- **`createLimiter(concurrency)`** — p-limit equivalent for bounding concurrent async operations
- **`mapConcurrent(items, fn, opts)`** — parallel map with concurrency limit, `settled` mode (continue on errors), and progress callbacks
- **`resolvePerformanceConfig(rawConfig)`** — merges user config with CPU-aware defaults
- **`createProgressLogger(label, total)`** — progress logging callback for long-running concurrent ops

Extractors and migrators use `mapConcurrent` to parallelize HTTP calls (source file fetching, hotspot detail fetching, issue/hotspot sync). The `migrate-pipeline.js` resolves performance config and passes concurrency settings to all operations.

## 📦 Build and Packaging

CloudVoyager uses esbuild to bundle the ESM source into a single CJS file (with protobuf schemas inlined as text), and Node.js Single Executable Applications (SEA) to create standalone binaries.

### Build Process (`scripts/build.js`)

1. **Bundle CLI** — esbuild bundles `src/index.js` (and all imports, including `.proto` schemas as text) into `dist/cli.cjs`
2. **Package binary** (optional) — generates a Node.js SEA blob, copies the `node` binary, and injects the blob using `postject`

### Output Structure

```
dist/
├── cli.cjs              # Bundled CLI (CJS, self-contained)
├── sea-config.json      # SEA configuration (when --package is used)
├── sea-prep.blob        # SEA blob (when --package is used)
└── bin/                 # Standalone binary (when --package is used)
    └── cloudvoyager-{platform}-{arch}
```

### Build Commands

```bash
npm run build            # Bundle only (dist/cli.cjs)
npm run package          # Bundle + standalone binary for current platform
```

Multi-platform binaries are built via CI (GitHub Actions matrix), since Node.js SEA can only build for the platform it's running on.

All CLI flags (`--concurrency`, `--max-memory`, `--project-concurrency`) work identically whether running via `node src/index.js`, `node dist/cli.cjs`, or the standalone binary.

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
