# 🏗️ Architecture

<!-- Last updated: Apr 21, 2026 -->

<!-- Updated: Apr 21, 2026 -->
## 📁 Project Structure

CloudVoyager uses a **pipeline-per-version** architecture. Each supported SonarQube version range has its own self-contained pipeline, while shared (version-independent) code lives in `src/shared/`.

```
src/
├── index.js                          # CLI entry point (Commander.js, 8 commands)
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
    │   ├── csv-applier.js              # Apply CSV overrides to filter/modify extracted data
    │   └── csv-entity-filters.js       # CSV-based entity filtering (gates, profiles, groups, permissions, templates, portfolios, users)
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
    │   ├── errors.js                   # Custom error classes (11 error classes extending CloudVoyagerError)
    │   ├── concurrency.js              # Concurrency primitives (limiter, mapConcurrent, progress)
    │   ├── system-info.js              # System info detection (CPU, memory) and auto-tune
    │   ├── shutdown.js                 # Graceful SIGINT/SIGTERM shutdown coordinator
    │   ├── progress.js                 # Checkpoint progress display and ETA
    │   ├── prompt.js                   # Interactive user prompts (confirmation dialogs)
    │   ├── version.js                  # SonarQube version parsing and comparison
    │   ├── portfolio-skip.js           # handleMissingEnterpriseKey — graceful portfolio skip when enterprise key absent
    │   ├── search-slicer/             # Date-window slicing for 10K+ issue retrieval (SQ & SC)
    │   │   ├── index.js                # fetchWithSlicing orchestrator
    │   │   ├── helpers/
    │   │   │   ├── bisect-window.js    # Binary-split a date window
    │   │   │   ├── build-windows.js    # Initial window partitioning
    │   │   │   ├── fetch-window.js     # Fetch issues within a single window
    │   │   │   └── merge-results.js    # Deduplicate and merge sliced results
    │   ├── batch-distributor/         # SCM date backdating for accurate issue creation dates
    │   │   ├── index.js                # Re-exports all helpers
    │   │   ├── helpers/
    │   │   │   ├── should-batch.js     # ISSUE_BATCH_SIZE constant (5000); shouldBatch() returns false
    │   │   │   ├── backdate-changesets.js # Per-line date backdating from issue.creationDate
    │   │   │   ├── compute-batch-plan.js # (legacy) Returns batch descriptors with start/end indices
    │   │   │   ├── compute-batch-date.js # (legacy) Computes backdated ISO date per batch
    │   │   │   └── create-batch-extracted-data.js # (legacy) Shallow-clones extracted data with sliced issues
    │   ├── issue-sync/                # Shared issue sync utilities
    │   │   ├── has-manual-changes.js   # Detects human-authored changes on an SQ issue
    │   │   ├── fetch-sq-changelogs.js  # Batch-fetches SQ changelogs concurrently
    │   │   ├── apply-pre-filter.js     # Applies hasManualChanges pre-filter; sets stats.filtered
    │   │   └── wait-for-sc-indexing.js # Retries SC fetch until analysis is indexed (Issue #91)
    │   └── fallback-repos/
    │       └── index.js                # 44 known SonarCloud rule repositories (fallback set)
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
            ├── format-pdf.js           # PDF verification report
            ├── markdown-sections/      # Modularized markdown report sections
            │   ├── detail-sections.js   # Detailed per-check markdown sections
            │   └── project-results.js   # Per-project result markdown formatting
            └── pdf-sections/           # Modularized PDF report sections
                ├── detail-sections.js   # Detailed per-check PDF sections
                └── project-results.js   # Per-project result PDF formatting
```

### Version-Specific Pipeline Structure

Each pipeline under `src/pipelines/sq-{version}/` uses a **folder-based module architecture** where every module over ~30 lines is decomposed into `module-name/index.js` + `module-name/helpers/*.js`. A re-export file at the original path (e.g., `transfer-pipeline.js`) preserves backward-compatible import paths.

```
sq-{version}/
├── transfer-pipeline.js              # Re-export → transfer-pipeline/index.js
├── transfer-pipeline/
│   ├── index.js                       # Single-project transfer orchestrator
│   └── helpers/                       # 15+ helper files (one function each)
│       └── sync-transfer-metadata/    # Post-upload metadata sync (issues + hotspots)
│           ├── index.js                # Orchestrates issue and hotspot metadata sync
│           └── helpers/
│               ├── fetch-and-sync-issues.js    # Fetches SQ issues, syncs to SC
│               └── fetch-and-sync-hotspots.js  # Fetches SQ hotspots, syncs to SC
├── transfer-branch.js                # Re-export → transfer-branch/index.js
├── transfer-branch/
│   ├── index.js                       # Orchestrates per-branch transfer; gates to batched path when issues > 5K
│   └── helpers/                       # build-and-encode-report, upload-report, compute-branch-stats, transfer-branch-batched, ...
├── migrate-pipeline.js               # Re-export → migrate-pipeline/index.js
├── migrate-pipeline/
│   ├── index.js                       # Full multi-org migration orchestrator
│   └── helpers/                       # 10 helper files
│
├── sonarqube/                        # SonarQube integration
│   ├── api-client.js                  # Re-export → api-client/index.js
│   ├── api-client/
│   │   ├── index.js                    # HTTP client (factory function: createSonarQubeClient)
│   │   └── helpers/                    # 12+ helper files (pagination, auth, delegate methods, probe-total, ...)
│   ├── models.js                      # Re-export → models/index.js
│   ├── models/
│   │   ├── index.js
│   │   └── helpers/                    # Factory functions: createIssueData, createMetricData, ...
│   ├── api/
│   │   ├── issues-hotspots.js          # Issue and hotspot API methods (<50 lines, no decomposition)
│   │   ├── permissions.js              # Permission API methods
│   │   ├── quality.js                  # Re-export → quality/index.js (gate + profile API helpers)
│   │   └── server-config.js            # Re-export → server-config/index.js (10 helper files)
│   └── extractors/
│       ├── index.js                    # DataExtractor orchestrator (factory: createDataExtractor)
│       ├── helpers/                     # 20 helper files for extraction phases
│       ├── projects.js                  # Project/branch extraction (<50 lines)
│       ├── issues.js                    # Issue extraction (<50 lines)
│       ├── rules.js                     # Re-export → rules/helpers/ (5 helpers)
│       ├── hotspots.js                  # Re-export → hotspots/helpers/ (2 helpers)
│       ├── hotspots-to-issues.js        # Re-export → hotspots-to-issues/helpers/ (2 helpers)
│       ├── measures.js                  # Re-export → measures/helpers/ (2 helpers)
│       ├── metrics.js                   # Re-export → metrics/helpers/ (3 helpers)
│       ├── sources.js                   # Re-export → sources/helpers/ (1 helper)
│       ├── duplications.js              # Re-export → duplications/helpers/ (2 helpers)
│       ├── changesets.js                # Re-export → changesets/helpers/ (1 helper)
│       ├── new-code-periods.js          # Re-export → new-code-periods/helpers/ (2 helpers)
│       ├── permissions.js               # Re-export → permissions/helpers/ (3 helpers)
│       ├── quality-gates.js             # Re-export → quality-gates/helpers/ (2 helpers)
│       ├── quality-profiles.js          # Re-export → quality-profiles/helpers/ (2 helpers)
│       ├── users.js                     # Re-export → users/helpers/ (2 helpers)
│       └── devops-bindings.js           # Re-export → devops-bindings/helpers/ (3 helpers)
│
├── protobuf/                         # Protobuf encoding
│   ├── builder.js                     # Re-export → builder/index.js (factory: createProtobufBuilder)
│   ├── builder/
│   │   ├── index.js
│   │   └── helpers/                    # 10 helper files
│   ├── encoder.js                     # Re-export → encoder/index.js
│   ├── encoder/
│   │   ├── index.js
│   │   └── helpers/                    # 6 helper files
│   ├── encode-types.js                # Typed encoding helpers (<50 lines)
│   ├── build-components.js            # Re-export → build-components/helpers/ (4 helpers)
│   ├── build-issues.js                # Re-export → build-issues/helpers/ (2 helpers)
│   ├── build-external-issues.js       # Re-export → build-external-issues/helpers/ (11 helpers)
│   ├── build-duplications.js          # Re-export → build-duplications/helpers/ (5 helpers)
│   ├── build-measures.js              # Re-export → build-measures/helpers/ (3 helpers)
│   └── schema/
│       ├── scanner-report.proto
│       └── constants.proto
│
├── sonarcloud/                       # SonarCloud integration
│   ├── api-client.js                  # Re-export → api-client/index.js (factory: createSonarCloudClient)
│   ├── api-client/
│   │   ├── index.js
│   │   └── helpers/                    # 8 helper files
│   ├── uploader.js                    # Re-export → uploader/index.js
│   ├── uploader/
│   │   ├── index.js
│   │   └── helpers/                    # 10 helper files
│   ├── enterprise-client.js           # Re-export → enterprise-client/index.js
│   ├── enterprise-client/
│   │   ├── index.js
│   │   └── helpers/                    # 4 helper files
│   ├── rule-enrichment.js             # Rule enrichment from SonarCloud (sq-9.9 uses this)
│   ├── api/
│   │   ├── hotspots.js                 # Hotspot API methods (<50 lines)
│   │   ├── issues.js                   # Re-export → issues/helpers/ (3 helpers)
│   │   ├── permissions.js              # Re-export → permissions/helpers/ (2 helpers)
│   │   ├── project-config.js           # Re-export → project-config/helpers/ (2 helpers)
│   │   └── quality-profiles.js         # Re-export → quality-profiles/helpers/ (7 helpers)
│   └── migrators/
│       ├── groups.js                   # Group creation (<50 lines)
│       ├── quality-gates.js            # Re-export → quality-gates/helpers/ (6 helpers)
│       ├── quality-profiles.js         # Re-export → quality-profiles/helpers/ (7 helpers)
│       ├── quality-profile-diff.js     # Re-export → quality-profile-diff/helpers/ (3 helpers)
│       ├── permissions.js              # Re-export → permissions/helpers/ (6 helpers)
│       ├── portfolios.js               # Re-export → portfolios/helpers/ (4 helpers)
│       ├── project-config.js           # Re-export → project-config/helpers/ (5 helpers)
│       ├── issue-sync.js               # Re-export → issue-sync/helpers/ (12 helpers)
│       ├── issue-status-mapper.js      # Re-export → issue-status-mapper/helpers/ (4 helpers)
│       └── hotspot-sync.js             # Re-export → hotspot-sync/helpers/ (15 helpers)
│
└── pipeline/                         # Migration pipeline stages
    ├── extraction.js                  # Re-export → extraction/index.js
    ├── extraction/
    │   ├── index.js
    │   └── helpers/                    # 4 helper files
    ├── org-migration.js               # Re-export → org-migration/index.js
    ├── org-migration/
    │   ├── index.js
    │   └── helpers/                    # 10 helper files
    ├── project-migration.js           # Re-export → project-migration/index.js
    ├── project-migration/
    │   ├── index.js
    │   └── helpers/                    # 21 helper files
    └── results.js                     # Re-export → results/index.js
        results/
        ├── index.js
        └── helpers/                    # 5 helper files
```

**Module pattern:** Each decomposed module follows the same structure:
- `module-name.js` — 1-line re-export preserving the original import path
- `module-name/index.js` — orchestrator that imports from `helpers/`
- `module-name/helpers/*.js` — one exported function per file, ≤50 lines each

**404 JS files** across the sq-10.4 pipeline, all ≤50 lines. Classes converted to factory functions (`createSonarQubeClient`, `createSonarCloudClient`, `createProtobufBuilder`, `createDataExtractor`) with thin class wrappers for backward compatibility.

<!-- Updated: 2026-04-25_18:00:00 -->
### Shared Utilities — SCM Date Backdating

The **batch-distributor** (`src/shared/utils/batch-distributor/`) preserves each issue's original SonarQube creation date in SonarCloud by rewriting SCM changeset blame dates in the protobuf report.

The primary function is `backdateChangesets(extractedData)`, which:

1. **Safety-splits** any calendar day with >5K issues into sub-groups with 1-day-spaced synthetic dates
2. **Maps** each issue's `creationDate` to its `textRange` lines (oldest date wins for overlapping lines)
3. **Rebuilds** each file's changeset with one entry per unique date, and `changesetIndexByLine` pointing each line to the correct date

| Function | Purpose |
|----------|---------|
| `backdateChangesets(extractedData)` | Per-line date backdating from `issue.creationDate` — mutates `extractedData.changesets` in place |
| `shouldBatch(extractedData)` | Returns `false` (multi-analysis batching disabled); exports `ISSUE_BATCH_SIZE` constant (5000) |

Legacy helpers (`computeBatchPlan`, `computeBatchDate`, `createBatchExtractedData`) remain in the module but are no longer used by `backdateChangesets`.

**Integration:** All 6 pipeline `transfer-branch` entry points call `backdateChangesets(extractedData)` before the protobuf build step. The function handles all project sizes — no gate or threshold for activation.

<!-- Updated: Mar 25, 2026 -->
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

### Detailed Version Differences

| Behavior | sq-9.9 | sq-10.0 | sq-10.4 | sq-2025 |
|----------|--------|---------|---------|---------|
| Issue search param | `statuses` | `statuses` | `issueStatuses` | `issueStatuses` |
| Issue status values | OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED | OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED,FALSE_POSITIVE,ACCEPTED,FIXED | OPEN,CONFIRMED,FALSE_POSITIVE,ACCEPTED,FIXED | OPEN,CONFIRMED,FALSE_POSITIVE,ACCEPTED,FIXED |
| metricKeys limit | Batch at 15 | Batch at 15 | Batch at 15 | No batching needed |
| Clean Code source | SC enrichment map | Native from SQ | Native from SQ | Native from SQ |
| Groups API | Standard | Standard | Standard | Standard (V2 API fallback) |

<!-- Updated: Mar 25, 2026 -->
## 🔄 Commands and Pipelines

<!-- Updated: Mar 25, 2026 -->
### `transfer` — Single Project

Uses `pipelines/sq-{version}/transfer-pipeline.js` (selected by version-router):

1. **Load config** — validate and apply env var overrides
2. **Initialize state** — load previous state for incremental transfers
3. **Acquire lock file** — prevent concurrent runs on the same project
4. **Initialize checkpoint journal** — load or create checkpoint for pause/resume
5. **Test connections** — verify SonarQube and SonarCloud connectivity
6. **Extract data** — extract project data from SonarQube (issues, sources, measures, rules, hotspots, etc.) — 10+ extraction phases
7. **Build messages** — transform extracted data into protobuf message structures (including external issues + ad-hoc rules for unsupported plugins)
8. **Encode** — encode messages to binary protobuf format
9. **Package** — create ZIP archive (metadata.pb, component-N.pb, issues-N.pb, externalissues-N.pb, adhocrules.pb, measures-N.pb, duplications-N.pb, source-N.txt, activerules.pb, changesets-N.pb)
10. **Upload** — submit scanner report ZIP to SonarCloud CE endpoint
11. **Metadata sync** — sync issue statuses, comments, assignments, and tags from SQ to SC; sync hotspot statuses, comments, and source links (skippable via `skipIssueMetadataSync` / `skipHotspotMetadataSync`)
12. **Release lock** — release the advisory lock file
13. **Update state** — record successful transfer in state file

Interrupted transfers resume from the last completed checkpoint phase, skipping already-finished steps.

<!-- Updated: Mar 25, 2026 -->
### `migrate` — Full Multi-Org Migration

Uses `pipelines/sq-{version}/migrate-pipeline.js` (selected by version-router):

1. **Extract server-wide data** — projects, quality gates, quality profiles, groups, permissions, templates, portfolios, DevOps bindings, server info, webhooks
2. **Generate organization mappings** — map projects to target orgs by DevOps binding, generate 9 CSV types for review
3. **Save server info** — write system, plugins, settings, webhooks, ALM settings as JSON reference files
4. **Initialize migration journal** — load or create journal tracking per-org and per-project progress
5. **For each target organization:**
   - Create groups
   - Set global permissions
   - Create quality gates
   - Restore quality profiles (custom via backup XML, built-in as renamed custom profiles)
   - Compare quality profiles and write diff report (`quality-profiles/quality-profile-diff.json`)
   - Create permission templates
   - For each project (11 steps):
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
6. **Generate reports** — write migration reports (JSON, Markdown, PDF)

On resume, completed organizations and projects are skipped based on the migration journal.

<!-- Updated: Mar 25, 2026 -->
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
5. **Portfolio check** — reference-only verification (always skipped; requires Enterprise API access that is not available). SonarQube portfolios are listed in the report for manual reference but no SonarCloud comparison is performed.
6. **Generate reports** — JSON, Markdown, PDF, and console summary

<!-- Updated: Mar 25, 2026 -->
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
- **Parallel Pipeline Execution** — multiple levels of parallelism throughout the migration pipeline:
  - Branch transfers run concurrently via `mapConcurrent` (bounded by `maxConcurrency`)
  - Organization migrations run concurrently (one task per org)
  - Server-wide extraction steps run via `Promise.all` (quality gates, profiles, groups, permissions, templates, portfolios, server info, webhooks)
  - Org-wide resource migration uses two-batch parallelism: batch 1 (independent: groups, gates, profiles, templates) then batch 2 (dependent: global permissions, profile comparison)
  - Project-level steps run in parallel where possible (issue + hotspot sync concurrent, config steps concurrent, gate/profile/permission assignment concurrent)
- **Shared Throttler Pattern** — SonarCloud API clients within an org share a single POST throttler (`sharedThrottler`) to enforce `minRequestInterval` across all concurrent project migrations, preventing rate limit violations

<!-- Updated: Mar 25, 2026 -->
## ⚡ Concurrency and Performance

CloudVoyager uses a zero-dependency concurrency layer (`src/shared/utils/concurrency.js`) for parallel I/O:

- **`createLimiter(concurrency)`** — p-limit equivalent for bounding concurrent async operations
- **`mapConcurrent(items, fn, opts)`** — parallel map with concurrency limit, `settled` mode (continue on errors), and progress callbacks
- **`resolvePerformanceConfig(rawConfig)`** — merges user config with CPU-aware defaults
- **`createProgressLogger(label, total)`** — progress logging callback for long-running concurrent ops

Extractors and migrators use `mapConcurrent` to parallelize HTTP calls (source file fetching, hotspot detail fetching, issue/hotspot sync). Each version-specific `migrate-pipeline.js` resolves performance config and passes concurrency settings to all operations.

<!-- Updated: Mar 25, 2026 -->
## 📦 Build and Packaging

CloudVoyager uses **esbuild + Node.js SEA** (Single Executable Applications) as the default, stable packaging pipeline. An experimental **Bun compile** pipeline is also available but may silently crash at runtime in some environments.

<!-- Updated: Mar 25, 2026 -->
### Build Process (`scripts/build.js`)

**Default (Node.js SEA):** Two-step — esbuild bundles `src/index.js` into `dist/cli.cjs` (with `.proto` schemas inlined as text), then Node.js SEA packages it into a standalone binary with V8 code cache via postject.

**Experimental (Bun):** Single-step compile — Bun bundles all source files (including `.proto` schemas as text via `--loader .proto:text`) and compiles to a native binary in one command. No intermediate bundle file. Faster builds but less stable at runtime.

<!-- Updated: Mar 25, 2026 -->
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

<!-- Updated: Mar 25, 2026 -->
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

<!-- Updated: Mar 26, 2026 -->
## 🧪 CI Workflows

All workflows trigger **only on push to `main`** (merged PRs). No workflow runs on feature branches or pull requests.

### Unit Tests

A standalone `Unit Tests` workflow (`unit-tests.yml`) runs on every push to `main`. It installs dependencies, then runs `npm test`.

### Regression Tests

A separate `Regression Tests` workflow runs on every push to `main`. It does **not** block the release workflow.

**Pipeline graph (visible in the Actions UI):**

```
              ┌─ lint ──────────────┬─ migrate (17 parallel jobs)      ─┬─ summary
setup ────────┤                     ├─ sync-metadata (4 parallel jobs)  ─┤
              └────────────────────└─ verify (9 parallel jobs)        ─┘
```

- **Setup:** Install dependencies, cache `node_modules`
- **Lint:** ESLint — gates integration tests (syntax errors caught before 30 jobs spin up)
- **Integration Tests:** 30 parallel jobs testing every CLI flag combination via matrix strategy (`fail-fast: false`). Config files generated at runtime from GitHub Secrets.
- **Summary:** Gate job that only passes when all 30 integration tests pass

### SonarCloud Analysis

A standalone `SonarCloud Analysis` workflow (`sonarcloud.yml`) runs SAST and SCA scanning on every push to `main`. It does **not** run unit tests or ingest coverage — those are handled by the separate Unit Tests workflow.

### Auto Version Bump

The `Auto Version Bump` workflow (`version-bump.yml`) triggers when a PR is merged to `main` **and** the PR has a milestone assigned. It automatically bumps the version in `package.json` and `package-lock.json`:

- If the milestone matches the current major.minor (e.g., both `1.2`): bumps the patch version (`1.2.1` → `1.2.2`)
- If the milestone changed (e.g., `1.2` → `1.3`): resets to the new milestone (`1.3.0`)
- Commits and pushes the version bump to `main`, which then triggers the Build and Release workflow

**To use:** Assign a milestone (e.g., `1.2`) to your PR in the GitHub sidebar before merging. The version is derived automatically from the milestone title.

### Build and Release

The `Build and Release` workflow (`release.yml`) builds binaries for 6 platforms and creates a GitHub Release. The release body includes:
- Auto-generated release notes from merged PRs
- A link to the corresponding GitHub milestone (derived from `package.json` version)

### Workflow files

| File | Purpose |
|---|---|
| `unit-tests.yml` | Standalone unit tests (push to main only) |
| `sonarcloud.yml` | SAST/SCA scanning via SonarCloud |
| `version-bump.yml` | Auto-bump version from PR milestone on merge |
| `release.yml` | Orchestrator — install, build, desktop build, release |
| `regression.yml` | Regression orchestrator — triggers, stage sequencing |
| `regression-setup.yml` | Install + cache node_modules |
| `regression-quality.yml` | Lint (ESLint) |
| `regression-unit-tests.yml` | Unit tests with coverage (reusable, called by regression) |
| `regression-migrate.yml` | 17 migrate flag combos (matrix) |
| `regression-sync-metadata.yml` | 4 sync-metadata flag combos (matrix) |
| `regression-verify.yml` | 9 verify flag combos (matrix) |
| `regression-summary.yml` | Final pass/fail gate |

**Composite actions** (`.github/actions/`):
- `restore-deps/` — Setup Node.js 18 + restore cached node_modules
- `generate-config/` — Generate `migrate-config.json` from GitHub Secrets

**Required GitHub Secrets:** `SONARQUBE_URL`, `SONARQUBE_TOKEN`, `SONARCLOUD_URL`, `SONARCLOUD_TOKEN`, `SONARCLOUD_ORG_KEY`, `SONARCLOUD_ENTERPRISE_KEY`, `SONAR_TOKEN`

<!-- Updated: Mar 25, 2026 -->
## 📄 Generated Report Structure

```
scanner-report.zip:
├── metadata.pb              - Analysis metadata with SCM revision ID (single message)
├── activerules.pb           - Language-filtered quality profile rules (length-delimited)
├── adhocrules.pb            - Ad-hoc rule definitions for external issues (length-delimited)
├── context-props.pb         - SCM and CI detection metadata (empty file)
├── component-{ref}.pb       - Component definitions, flat structure (single message each)
├── issues-{ref}.pb          - Code issues with text ranges and flows (length-delimited)
├── externalissues-{ref}.pb  - External issues for unsupported plugins (length-delimited)
├── measures-{ref}.pb        - Metrics and measurements per file component (length-delimited)
├── duplications-{ref}.pb    - Code duplication blocks per file component (length-delimited)
├── changesets-{ref}.pb      - SCM changeset info per file component (single message each)
└── source-{ref}.txt         - Source code files (plain text)
```

Measures are only generated for file components (no project-level `measures-1.pb`). Components use a flat structure where all files are direct children of the project (no directory components).

<!-- Updated: Mar 25, 2026 -->
## 🖥️ Desktop App Architecture

CloudVoyager Desktop is an Electron (v33) application in the `desktop/` directory that wraps the CLI binary with a guided wizard UI.

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
│   │   ├── ipc-handlers.js   # All IPC channel registrations (10 channels)
│   │   └── config-store.js   # electron-store wrapper (encrypted token storage)
│   ├── preload/
│   │   └── preload.js        # contextBridge API exposed to renderer (7 modules)
│   └── renderer/
│       ├── index.html        # Single HTML entry point
│       ├── styles/           # CSS (dark theme)
│       └── js/
│           ├── app.js        # Hash-based screen router (9 screens)
│           ├── screens/      # Wizard screens (welcome, transfer-config, migrate-config, verify-config, sync-metadata-config, connection-test, execution, results, status)
│           └── components/   # Reusable UI (config-form, log-viewer, migration-graph, wizard-nav, sidebar-history, progress-parser, whale-animator)
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

The renderer uses vanilla HTML/CSS/JS with no build step. Security follows Electron best practices: `contextIsolation: true`, `nodeIntegration: false`, all Node.js access via `contextBridge`, CSP headers, path traversal guards, and HTML escaping.

> **New desktop components:** `progress-parser.js` parses CLI log output to compute real-time progress percentages and ETA for all three pipeline types (migrate, transfer, verify). `whale-animator.js` renders a pixel-art whale sprite animation with starfield, cloud parallax, and typewriter phase labels during execution.

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
