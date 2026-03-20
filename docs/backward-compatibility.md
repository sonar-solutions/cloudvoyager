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

Each pipeline directory contains a complete set of modules (60–66 JS files each):

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

### Summary Table

| Behavior | sq-9.9 | sq-10.0 | sq-10.4 | sq-2025 |
|----------|--------|---------|---------|---------|
| Issue search param | `statuses` (legacy) | `statuses` (legacy) | `issueStatuses` (modern) | `issueStatuses` (modern) |
| metricKeys limit | Batch at 15 | Batch at 15 | Batch at 15 | No batching |
| Clean Code source | SonarCloud enrichment map | Native from SQ | Native from SQ | Native from SQ |
| Rule enrichment | Always called | Not needed | Not needed | Not needed |
| Groups API | `/api/user_groups/search` | Same | Same | Standard (with V2 API fallback) |

### Issue Lifecycle Differences

The issue search API changed significantly across SonarQube versions:

| Pipeline | API Parameter | Valid Status Values |
|----------|--------------|---------------------|
| sq-9.9 | `statuses` | `OPEN`, `CONFIRMED`, `REOPENED`, `RESOLVED`, `CLOSED` |
| sq-10.0 | `statuses` | `OPEN`, `CONFIRMED`, `REOPENED`, `RESOLVED`, `CLOSED`, `FALSE_POSITIVE`, `ACCEPTED`, `FIXED` |
| sq-10.4 | `issueStatuses` | `OPEN`, `CONFIRMED`, `FALSE_POSITIVE`, `ACCEPTED`, `FIXED` |
| sq-2025 | `issueStatuses` | `OPEN`, `CONFIRMED`, `FALSE_POSITIVE`, `ACCEPTED`, `FIXED` |

Key changes:
- **sq-9.9**: Uses the legacy `statuses` parameter with only 5 status values. Does not support `FALSE_POSITIVE`, `ACCEPTED`, or `FIXED` as search parameters.
- **sq-10.0**: Still uses `statuses` but adds support for the new status values (`FALSE_POSITIVE`, `ACCEPTED`, `FIXED`) alongside legacy ones.
- **sq-10.4 and sq-2025**: Switch to the `issueStatuses` parameter. Remove legacy statuses (`REOPENED`, `RESOLVED`, `CLOSED`).

Each pipeline uses the correct parameter directly — no conditional logic required.

### Metric Keys Batching

SonarQube 9.9 through 10.8 enforces a limit of **15 metric keys per request** to the measures API. Pipelines `sq-9.9`, `sq-10.0`, and `sq-10.4` batch metric key requests accordingly.

SonarQube 2025.1+ removed this limit, so the `sq-2025` pipeline sends all metric keys in a single request.

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

The enrichment follows a two-level fallback:

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

### Groups API

| Pipeline | API Used |
|----------|----------|
| sq-9.9 | `/api/user_groups/search` (standard) |
| sq-10.0 | `/api/user_groups/search` (standard) |
| sq-10.4 | `/api/user_groups/search` (standard) |
| sq-2025 | `/api/user_groups/search` (standard, with Web API V2 fallback) |

SonarQube 2025.1+ began deprecating some legacy Web API endpoints. The `sq-2025` pipeline uses the standard groups API but includes fallback to the V2 API (`/api/v2/authorizations/groups`) if the legacy endpoint is unavailable.

### Performance Optimization

- **Transfer pipeline** (`transfer` command): Enrichment map is built once per project transfer (sq-9.9 only)
- **Migrate pipeline** (`migrate` command): Enrichment map is built **once per SonarCloud organization** and reused across all projects in that org (sq-9.9 only)
- **sq-10.0, sq-10.4, sq-2025**: Enrichment fetch is skipped entirely (no extra API calls)

## Common API Constraints (All Versions)

These constraints apply across all four pipelines:

| API | Constraint |
|-----|-----------|
| Quality gate list (`/api/qualitygates/list`) | Returns `name` only, no `id` field |
| Quality gate show (`/api/qualitygates/show`) | Requires `name` param, not `id` |
| Quality profile backup (`/api/qualityprofiles/backup`) | Requires `language` + `qualityProfile` (name), not `profileKey` |
| Quality profile permissions (`/api/qualityprofiles/search_users`) | Requires `language` + `qualityProfile` (name) |
| Permissions groups (`/api/permissions/groups`) | Max page size `ps=100` (not 500) |
| Project tags (`/api/project_tags/search`) | Max page size `ps=100` |
| Profile permissions | Max page size `ps=100` |
| Gate permissions | Max page size `ps=100` |
| Hotspot details | Returns `comment` (singular, a list), not `comments` |
| Built-in quality gates/profiles | Permission APIs return HTTP 400 (expected, handled gracefully) |

## External Issues (All Versions)

All four pipelines support automatic detection and migration of external/plugin issues (e.g., MuleSoft, Checkstyle, PMD):

1. **Auto-detection**: Compares SonarQube rule repositories (`getRuleRepositories()`) against SonarCloud available repositories
2. **External encoding**: Rules not available in SonarCloud are encoded as `ExternalIssue` + `AdHocRule` protobuf messages in the scanner report
3. **Display in SonarCloud**: External rules appear as `external_{engineId}:{ruleId}` (e.g., `external_mulesoft:MS058`). Ad-hoc rules do not appear in SC rules search (expected behavior per SC docs).

**Critical implementation detail**: The `cleanCodeAttribute` field in `AdHocRule` must be encoded as a **protobuf enum (varint)**, NOT a string. Despite the GitHub proto definition showing `optional string`, the real SonarCloud scanner uses enum encoding. SonarCloud's Compute Engine silently ignores external issues if `cleanCodeAttribute` is string-encoded.

Clean Code attribute enum values:

| Attribute | Enum Value |
|-----------|-----------|
| `CONVENTIONAL` | 1 |
| `FORMATTED` | 2 |
| `IDENTIFIABLE` | 3 |
| `CLEAR` | 4 |
| `COMPLETE` | 5 |
| `EFFICIENT` | 6 |
| `LOGICAL` | 7 |
| `DISTINCT` | 8 |
| `FOCUSED` | 9 |
| `MODULAR` | 10 |
| `TESTED` | 11 |
| `LAWFUL` | 12 |
| `RESPECTFUL` | 13 |
| `TRUSTWORTHY` | 14 |

The `impacts` and `defaultImpacts` (Impact message) fields are also required for external issues to be accepted by SonarCloud.

## Feature Support Matrix

All features are supported across all four pipelines:

| Feature | sq-9.9 | sq-10.0 | sq-10.4 | sq-2025 |
|---------|--------|---------|---------|---------|
| Single-project transfer | Yes | Yes | Yes | Yes |
| Multi-org migration | Yes | Yes | Yes | Yes |
| Checkpoint/resume | Yes | Yes | Yes | Yes |
| External issues | Yes | Yes | Yes | Yes |
| Issue metadata sync | Yes | Yes | Yes | Yes |
| Hotspot metadata sync | Yes | Yes | Yes | Yes |
| Quality gates/profiles | Yes | Yes | Yes | Yes |
| Permissions/templates | Yes | Yes | Yes | Yes |
| Portfolios (enterprise) | Yes | Yes | Yes | Yes |
| DevOps bindings | Yes | Yes | Yes | Yes |
| Dry-run + CSV mapping | Yes | Yes | Yes | Yes |
| Verification | Yes | Yes | Yes | Yes |
| Multi-branch support | Yes | Yes | Yes | Yes |
| Report generation | Yes | Yes | Yes | Yes |

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
| 10.0 - 10.3 | sq-10.0 | Full | Native Clean Code taxonomy; legacy `statuses` param with extended values |
| 10.4 - 10.8 | sq-10.4 | Full | Modern `issueStatuses` param; metric batching at 15 |
| 2025.1+ | sq-2025 | Full | Modern `issueStatuses` param; no metric batching; V2 API fallbacks |
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

### External issues not appearing in SonarCloud

If external issues are missing after migration:

1. Verify that `cleanCodeAttribute` is encoded as a protobuf enum (varint), not a string
2. Verify that `impacts` and `defaultImpacts` fields are populated in `AdHocRule` messages
3. Check SonarCloud CE task logs for silent rejection of malformed external issue messages
4. Ad-hoc rules will not appear in the SonarCloud rules search — this is expected behavior
