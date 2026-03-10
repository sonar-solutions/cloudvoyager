# 🔬 Technical Details

<!-- Last updated: Mar 4, 2026 at 12:00:00 PM -->

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📡 Protobuf Encoding

The scanner report uses two encoding styles:
- **Single message** (no length delimiter): `metadata.pb`, `component-{ref}.pb`, `changesets-{ref}.pb`
- **Length-delimited** (multiple messages): `issues-{ref}.pb`, `measures-{ref}.pb`, `activerules.pb`

protobufjs automatically converts snake_case field names to camelCase in JavaScript:
- `analysis_date` becomes `analysisDate`
- `scm_revision_id` becomes `scmRevisionId`
- `component_ref` becomes `componentRef`

All field names in the codebase use camelCase to match this convention.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📏 Measure Type Mapping

Measures use typed value fields based on metric type:
- **Integer metrics** (`intValue`): `functions`, `statements`, `classes`, `ncloc`, `comment_lines`, `complexity`, `cognitive_complexity`, `violations`, `sqale_index`
- **String metrics** (`stringValue`): `executable_lines_data`, `ncloc_data`, `alert_status`
- **Float/percentage metrics** (`doubleValue`): `coverage`, `line_coverage`, `branch_coverage`, `duplicated_lines_density`, ratings

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📋 Active Rules

- Active rules are filtered by languages actually used in the project, resulting in ~84% reduction in payload size
- Rule keys are stripped of the repository prefix (e.g., `S7788` not `jsarchitecture:S7788`)
- Quality profile keys are mapped to SonarCloud profile keys (not SonarQube keys)

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🧱 Component Structure

Components use a flat structure - all files are direct children of the project component (no directory components). Line counts are derived from actual source file content rather than SonarQube measures API values.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔖 SCM Revision Tracking

The tool includes `scm_revision_id` (git commit hash) in metadata. SonarCloud uses this to detect and reject duplicate reports, enabling proper analysis history tracking.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🌿 Branch Sync

By default, every branch discovered in SonarQube is transferred to SonarCloud (main branch first, then non-main branches). Each branch produces its own scanner report with branch-specific issues, measures, sources, and SCM data.

**Branch name resolution:** The main branch name is fetched from SonarCloud (via `getMainBranchName()` API) rather than using the SonarQube branch name. This avoids mismatches where SonarQube uses "main" but SonarCloud expects "master" (or vice versa). Non-main branches use their original SonarQube branch name and reference the main branch for new-code comparison.

**Incremental mode:** Completed branches are tracked in the state file. On subsequent runs, already-synced branches are skipped automatically. Use `reset` to re-transfer all branches.

**Configuration:** Set `transfer.syncAllBranches` to `false` to only sync the main branch. Use `transfer.excludeBranches` to skip specific branch names (e.g., `["feature/old", "release/v1"]`).

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 📄 API Pagination

SonarQube client handles pagination automatically via `getPaginated` method with a default page size of 500 items. All paginated results are concatenated into single arrays.

Note: some SonarQube APIs enforce a lower maximum page size of 100 (e.g., permissions, tags, profile permissions, gate permissions). The extractors handle this automatically.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🚦 Rate Limit Handling

The SonarCloud API client supports a configurable two-layer strategy for rate limiting. Customize it via the `rateLimit` section in your config file.

1. **Exponential backoff retry** (`maxRetries`, `baseDelay`) — When a 503 or 429 response is received, the request is retried up to `maxRetries` times with exponentially increasing delays (baseDelay × 2^attempt). If all retries are exhausted, the error is propagated to the caller. Default: `3` retries.

2. **Write request throttling** (`minRequestInterval`) — POST requests are spaced at least `minRequestInterval` ms apart via a request interceptor. This proactively reduces the chance of triggering SonarCloud's rate limits during high-volume operations like issue sync and hotspot sync. Default: `0` (no throttling).

<!-- Updated: Mar 4, 2026 at 12:00:00 PM -->
## 🔄 Issue Sync

The `migrate` command syncs issue metadata after the scanner report is uploaded. For each issue in SonarQube, it:
1. Searches for a matching issue in SonarCloud by rule, component, and text range
2. Fetches the SonarQube issue changelog and replays all status transitions in order (Open → Confirmed → False Positive, etc.)
3. Sets the assignee
4. Copies comments
5. Sets tags

The `verify` command validates this by fetching changelogs from both sides (`/api/issues/changelog`) and comparing the transition sequences.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔥 Hotspot Sync

Similar to issue sync, hotspot metadata is matched and synced:
1. Matches hotspots by rule, component, and text range
2. Transitions status (To Review, Acknowledged, Safe, Fixed)
3. Copies comments

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🔑 Project Key Resolution

SonarCloud requires globally unique project keys across all organizations. When migrating projects, the tool uses the following strategy:

1. **Try the original SonarQube project key** — check if it's available globally on SonarCloud via `/api/components/show`
2. **If available** — use the original key as-is, so the SonarCloud project key matches SonarQube
3. **If taken by another organization** — fall back to `{org}_{key}` (e.g., `my-org_my-project`) and log a warning
4. **If already owned by the target organization** — use the original key (the project was likely created in a previous migration run)

Key conflicts are reported in the migration summary and in the `reports/migration-report.txt` / `reports/migration-report.json` output files.

<!-- Updated: 2026-02-20 -->
## 🗺️ Organization Mapping

The `migrate` command maps projects to target SonarCloud organizations based on their DevOps platform bindings. Projects with the same ALM binding are grouped together. Mapping CSVs are generated for review before execution (via `--dry-run`).

<!-- Updated: 2026-02-20 -->
## 🔍 Dry-Run & Editable CSV Workflow

The `--dry-run` flag generates 8 exhaustive CSV files covering projects, organizations, groups, quality profiles, quality gates, portfolios, permission templates, and global permissions. Each CSV includes an `Include` column (defaulting to `yes`) that users can edit to filter what gets migrated.

**Pipeline integration:**
1. `migrate --dry-run` extracts data from SonarQube, generates CSVs, then stops
2. User reviews/edits CSVs (set `Include=no` to exclude resources from migration)
3. `migrate` (without `--dry-run`) detects existing CSVs, reads them into memory **before** wiping the output directory, re-extracts from SonarQube, then applies CSV overrides via `applyCsvOverrides()` which returns filtered copies using `structuredClone`

Quality gate CSVs use a flat one-row-per-gate pattern — users can include or exclude entire gates, but conditions are always migrated as-is from SonarQube. Portfolio and permission template CSVs use a parent/child pattern for their member/permission rows.

See [dry-run-csv-reference.md](dry-run-csv-reference.md) for full CSV schema documentation.

<!-- Updated: 2026-02-20 -->
## 📋 Quality Profile Migration

Quality profiles are migrated using SonarQube's backup/restore XML format, which preserves all rule configurations, severity overrides, and parameter values. Profile permissions (user and group access) are migrated separately via the permissions API.

Both **custom and built-in** profiles are migrated. Built-in profiles (e.g., "Sonar way") cannot be overwritten on SonarCloud, so they are restored as custom profiles with a "(SonarQube Migrated)" suffix (e.g., "Sonar way (SonarQube Migrated)"). These migrated profiles are automatically assigned to each project to ensure the same rules are active as in SonarQube.

To skip quality profile migration entirely and use each language's existing default SonarCloud profile, pass `--skip-quality-profile-sync`.

After profile migration, a **quality profile diff report** (`quality-profiles/quality-profile-diff.json`) is written to the output directory. This report compares active rules per language between SonarQube and SonarCloud, listing:
- **Missing rules** — rules active in SonarQube but not available in SonarCloud (may cause fewer issues)
- **Added rules** — rules available in SonarCloud but not in SonarQube (may create new issues)

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 🚧 Quality Gate Migration

Quality gates are created with their full condition definitions (metric, operator, threshold). The SonarQube API uses gate `name` (not `id`) for all operations. Built-in gates are skipped since they already exist in SonarCloud.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## ⚡ Concurrency Model

CloudVoyager uses a custom concurrency layer (`src/utils/concurrency.js`) with zero external dependencies. Key primitives:

- **`createLimiter(n)`** — bounds concurrent async operations to `n` at a time (p-limit equivalent)
- **`mapConcurrent(items, fn, { concurrency, settled, onProgress })`** — parallel map over items with bounded concurrency. In `settled` mode, errors are collected rather than aborting, allowing operations to continue despite individual failures

All extractors and migrators use `mapConcurrent` instead of sequential `for...of` loops. Concurrency limits are configurable per operation type (source extraction, hotspot extraction, issue sync, hotspot sync, project migration).

Performance config is resolved at startup by `resolvePerformanceConfig()`, which merges user config with defaults and detects available CPU cores via `os.availableParallelism()` (with `os.cpus().length` as a fallback on older Node.js versions). When `autoTune` is enabled, the function also reads total system RAM via `os.totalmem()` and computes optimal values: memory is set to 75% of total RAM (capped at 16GB), and concurrency settings are scaled from CPU core count (e.g., `sourceExtraction = cores * 2`, `issueSync = cores`, `hotspotSync = min(cores/2, 5)`). Explicit config values always override auto-tuned defaults.

<!-- Updated: Feb 20, 2026 at 04:02:35 PM -->
## 💾 Memory Management

When `maxMemoryMB` is set (via config or `--max-memory` flag), the tool automatically re-spawns itself with `NODE_OPTIONS="--max-old-space-size=<value>"` if the current heap limit is insufficient. This is transparent to the user — output streams seamlessly through the respawned process.

<!-- Updated: Mar 10, 2026 -->
## 🔄 Checkpoint Journal and Pause/Resume

CloudVoyager uses a write-ahead checkpoint journal to track progress at every major phase. If a transfer or migration is interrupted (CTRL+C, crash, network failure), re-running the same command resumes from the last completed checkpoint.

### Journal Structure

Each transfer creates a checkpoint journal file alongside the state file:

- **Phase tracking**: Each extraction phase (project metadata, metrics, components, rules, issues, hotspots, measures, sources, etc.) is tracked individually
- **Branch tracking**: Per-branch completion status with CE task IDs for upload deduplication
- **Session fingerprint**: SonarQube version, URL, and project key are recorded to detect environment changes between runs

### Atomic State Persistence

State files use a write-to-temp-then-rename pattern for crash safety:
1. Write to `<file>.tmp`
2. `fsync` to ensure data hits disk
3. Rename to final path (atomic on POSIX)
4. Backup rotation: previous state copied to `<file>.backup` before each save

If the main state file is corrupted, the system falls back to the `.backup` file automatically.

### Extraction Caching

Completed extraction phases are cached as gzipped JSON in `<outputDir>/cache/extractions/<projectKey>/`. On resume, cached phases are loaded from disk instead of re-fetching from SonarQube. Cache files include integrity metadata and auto-purge after 7 days (configurable via `transfer.checkpoint.cacheMaxAgeDays`).

### Upload Deduplication

Before re-uploading after a crash, the uploader queries `/api/ce/activity` for recent tasks on the project. If a task was submitted after the session start and is still SUCCESS/IN_PROGRESS/PENDING, the upload is skipped to prevent duplicate CE tasks.

### Lock Files

Advisory lock files (`<stateFile>.lock`) prevent concurrent runs. Lock metadata includes PID, hostname, and timestamp. Stale locks (dead PID or >6 hours old) are auto-released. Cross-machine locks (NFS) require manual `--force-unlock`.

## 📚 Further Reading

- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Architecture](architecture.md) — project structure, data flow, report format
- [Key Capabilities](key-capabilities.md) — comprehensive overview of engineering and capabilities
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them
- [Dry-Run CSV Reference](dry-run-csv-reference.md) — CSV schema documentation for the dry-run workflow
- [Changelog](CHANGELOG.md) — release history and notable changes

<!--
## Change Log
| Date | Section | Change |
|------|---------|--------|
| 2026-02-19 | Issue Sync | API expansion with modular endpoints |
| 2026-02-18 | Protobuf, SCM, Branch, Profiles, Memory | Encoding refactor, diff reports, auto-tune |
| 2026-02-17 | Rate Limit, Hotspot, Keys, Mapping, Gates, Concurrency | Migration engine features |
| 2026-02-16 | Measures, Rules, Components, Pagination | Core transfer engine |
-->
