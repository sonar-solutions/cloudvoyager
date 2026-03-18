# Backward Compatibility: SonarQube Version Support

CloudVoyager supports migrating from **SonarQube 9.9 LTS** through **SonarQube 2025.1** (and newer) to SonarCloud. This document explains how the tool handles the differences between SonarQube versions.

## Background

Different SonarQube versions introduced significant API and taxonomy changes:

**SonarQube 10.0** introduced the **Clean Code taxonomy**:
- **Clean Code Attributes** (e.g., `CONVENTIONAL`, `LOGICAL`, `TRUSTWORTHY`) — classify *why* code is problematic
- **Software Qualities** (`MAINTAINABILITY`, `RELIABILITY`, `SECURITY`) — classify *what* is affected
- **Impact Severities** (`LOW`, `MEDIUM`, `HIGH`, `BLOCKER`) — classify *how severe* the impact is

**SonarQube 10.4** introduced a **new issue lifecycle**:
- Replaced the `statuses` API parameter with `issueStatuses`
- Removed `REOPENED`, `RESOLVED`, and `CLOSED` statuses
- Added `ACCEPTED` (replacing "Won't Fix") and `FIXED` statuses

**SonarQube 2025.1** removed web services deprecated in 8.x/9.x, and continues the migration to Web API V2.

**SonarQube 9.9 LTS** uses the older taxonomy:
- **Issue Types** (`CODE_SMELL`, `BUG`, `VULNERABILITY`, `SECURITY_HOTSPOT`)
- **Severities** (`INFO`, `MINOR`, `MAJOR`, `CRITICAL`, `BLOCKER`)
- Legacy `statuses` parameter with `OPEN`, `CONFIRMED`, `REOPENED`, `RESOLVED`, `CLOSED`

SonarCloud (always the latest version) uses the new Clean Code taxonomy. CloudVoyager bridges these gaps automatically.

## Architecture: Pipeline-Per-Version

Instead of a single codebase with runtime version checks, CloudVoyager uses a **pipeline-per-version** architecture. Each supported SonarQube version range has its own self-contained pipeline under `src/pipelines/`:

```
src/
├── version-router.js              # Detects SQ version, loads correct pipeline
├── pipelines/
│   ├── sq-9.9/                    # SonarQube 9.9 LTS
│   ├── sq-10.0/                   # SonarQube 10.0–10.3
│   ├── sq-10.4/                   # SonarQube 10.4–10.8
│   └── sq-2025/                   # SonarQube 2025.1+
└── shared/                        # Version-independent code (utils, state, config, etc.)
```

Each pipeline directory contains a complete set of modules:

```
sq-{version}/
├── transfer-pipeline.js           # Single-project transfer orchestrator
├── migrate-pipeline.js            # Full multi-org migration orchestrator
├── sonarqube/                     # SonarQube API client, models, extractors
│   ├── api-client.js
│   ├── models.js
│   ├── api/                       # API method modules
│   └── extractors/                # Specialized data extractors
├── protobuf/                      # Protobuf builder, encoder, schema
│   ├── builder.js
│   ├── encoder.js
│   ├── build-*.js
│   └── schema/                    # .proto definitions
├── sonarcloud/                    # SonarCloud API client, uploader, migrators
│   ├── api-client.js
│   ├── uploader.js
│   ├── rule-enrichment.js
│   ├── api/
│   └── migrators/
└── pipeline/                      # Migration pipeline stages
    ├── extraction.js
    ├── org-migration.js
    ├── project-migration.js
    └── results.js
```

**No runtime version checks exist within any pipeline.** Each pipeline has its behavior hardcoded for its target SonarQube version range. This eliminates branching logic and makes each pipeline easier to understand and maintain.

## How Version Routing Works

1. `version-router.js` makes a lightweight `GET /api/system/status` call to detect the SonarQube server version
2. `resolvePipelineId()` maps the parsed version to a pipeline folder:
   - `major >= 2025` → `sq-2025`
   - `major >= 10 && minor >= 4` → `sq-10.4`
   - `major >= 10` → `sq-10.0`
   - Otherwise → `sq-9.9`
3. `detectAndRoute()` dynamically imports `transfer-pipeline.js` and `migrate-pipeline.js` from the selected pipeline
4. Commands (`transfer`, `migrate`, `sync-metadata`) call `detectAndRoute()` to get the correct `transferProject()` or `migrateAll()` function

If version detection fails (e.g., network error), the router falls back to the `sq-9.9` pipeline.

## Version-Specific Differences

| Behavior | sq-9.9 | sq-10.0 | sq-10.4 | sq-2025 |
|----------|--------|---------|---------|---------|
| Issue search param | `statuses` (legacy) | `statuses` (legacy) | `issueStatuses` (modern) | `issueStatuses` (modern) |
| metricKeys limit | Batch at 15 | Batch at 15 | No batching | No batching |
| Clean Code source | SonarCloud enrichment map | Native from SQ | Native from SQ | Native from SQ |
| Rule enrichment | Always called | Not needed | Not needed | Not needed |
| Groups API | `/api/user_groups/search` | Same | Same | Web API V2 with fallback |

### Issue Search Parameters

The issue search API changed in SonarQube 10.4:

| Pipeline | API Parameter | Status Values |
|----------|--------------|---------------|
| sq-9.9, sq-10.0 | `statuses` | `OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED,FALSE_POSITIVE,ACCEPTED,FIXED` |
| sq-10.4, sq-2025 | `issueStatuses` | `OPEN,CONFIRMED,FALSE_POSITIVE,ACCEPTED,FIXED` |

Each pipeline uses the correct parameter directly — no conditional logic required.

### Clean Code Taxonomy Enrichment

The `sq-9.9` pipeline fetches the Clean Code taxonomy from SonarCloud because SonarQube 9.9 does not provide it:

```
SonarQube 9.9.0.65466 does not support Clean Code taxonomy (requires 10.0+). Fetching enrichment from SonarCloud...
Rule enrichment map built: 1,247 rules with Clean Code data
```

The `sq-10.0`, `sq-10.4`, and `sq-2025` pipelines read Clean Code data natively from SonarQube — no enrichment fetch needed.

### Rule Enrichment from SonarCloud (sq-9.9 only)

For SonarQube 9.9, the `rule-enrichment.js` module in the `sq-9.9` pipeline:

1. For each SonarCloud quality profile, queries `/api/rules/search` with `f=cleanCodeAttribute,impacts`
2. Builds a **rule enrichment map** — a lookup table mapping rule keys (e.g., `javascript:S1234`) to their Clean Code attributes and impacts
3. When building the scanner report, rules and issues are enriched with the correct Clean Code data from SonarCloud

This means the migrated data in SonarCloud will have the **exact same** Clean Code classification as if it had been scanned natively.

### Fallback Chain (sq-9.9 only)

The enrichment follows a three-level fallback:

| Priority | Source | When Used |
|----------|--------|-----------|
| 1 | SonarCloud rule enrichment | Rule exists in SC quality profiles |
| 2 | Type-based inference | Rule not in SC (external rules) |

**Type-based inference** (last resort) maps the old taxonomy as follows:

| Old Type | Clean Code Attribute | Software Quality |
|----------|---------------------|-----------------|
| `CODE_SMELL` | `CONVENTIONAL` | `MAINTAINABILITY` |
| `BUG` | `LOGICAL` | `RELIABILITY` |
| `VULNERABILITY` | `TRUSTWORTHY` | `SECURITY` |
| `SECURITY_HOTSPOT` | `TRUSTWORTHY` | `SECURITY` |

| Old Severity | Impact Severity |
|-------------|----------------|
| `INFO` | `LOW` |
| `MINOR` | `LOW` |
| `MAJOR` | `MEDIUM` |
| `CRITICAL` | `HIGH` |
| `BLOCKER` | `BLOCKER` |

### Performance Optimization

- **Transfer pipeline** (`transfer` command): Enrichment map is built once per project transfer (sq-9.9 only)
- **Migrate pipeline** (`migrate` command): Enrichment map is built **once per SonarCloud organization** and reused across all projects in that org (sq-9.9 only)
- **sq-10.0, sq-10.4, sq-2025**: Enrichment fetch is skipped entirely (no extra API calls)

## What Works Identically Across Pipelines

These components are shared across all version-specific pipelines (via `src/shared/`):

- Configuration loading and validation
- State management (checkpoint, lock, tracker, migration journal)
- Source code extraction
- Component/file tree structure
- Measures and metrics (filter-to-available approach)
- Quality gates and quality profiles
- Permissions and groups
- Security hotspot conversion
- Issue metadata sync (statuses, comments, transitions)
- Multi-branch support
- Pagination
- Report generation (markdown, PDF, text)
- Verification pipeline
- Concurrency and performance tuning
- Graceful shutdown handling

## Usage

No special configuration is needed. CloudVoyager detects the SonarQube version automatically and loads the correct pipeline:

```bash
# Works with SQ 9.9, 10.x, 2025.1, or any supported version
node src/index.js transfer -c config.json --verbose
node src/index.js migrate -c config.json
```

Use `--verbose` to see detailed logs about version detection and pipeline selection:

```
SonarQube server version: 9.9.0.65466 → using pipeline: sq-9.9
```

Use the `test` command to verify connectivity and see which pipeline is selected:

```bash
node src/index.js test -c config.json
```

## Supported SonarQube Versions

| Version | Pipeline | Support Level | Notes |
|---------|----------|--------------|-------|
| 9.9 LTS | sq-9.9 | Full | Clean Code enriched from SonarCloud; legacy `statuses` param |
| 10.0 - 10.3 | sq-10.0 | Full | Native Clean Code taxonomy; legacy `statuses` param |
| 10.4 - 10.8 | sq-10.4 | Full | Modern `issueStatuses` param |
| 2025.1+ | sq-2025 | Full | Modern `issueStatuses` param; V2 API fallbacks |
| < 9.9 | sq-9.9 (fallback) | Best effort | APIs may differ; not actively tested |

## Troubleshooting

### "Failed to detect SonarQube version"

If version detection fails, CloudVoyager falls back to the `sq-9.9` pipeline. This is non-fatal — the migration will proceed. Check:

- SonarQube URL is correct and reachable
- SonarQube token has sufficient permissions
- Network connectivity to the SonarQube server

### "Failed to build rule enrichment map"

If the enrichment fetch fails (sq-9.9 pipeline), CloudVoyager falls back to type-based inference. This is non-fatal — the migration will proceed, but Clean Code attributes may be less precise for active rules. Check:

- SonarCloud token has sufficient permissions
- Network connectivity to SonarCloud
- Quality profiles exist in SonarCloud for the relevant languages

### Issues appear with generic Clean Code attributes

If migrated issues show `CONVENTIONAL` instead of more specific attributes (like `LOGICAL` or `TRUSTWORTHY`), it means:

1. The rule wasn't found in the SonarCloud enrichment map
2. Type-based inference was used as fallback

This is expected for external/plugin rules that don't exist in SonarCloud. For native rules, verify that SonarCloud quality profiles are properly configured for the relevant languages.
