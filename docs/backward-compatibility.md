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

## How It Works

### Version-Aware Client

CloudVoyager uses a `VersionAwareSonarQubeClient` (defined in `src/sonarqube/version-aware-client.js`) that extends the base `SonarQubeClient` without modifying it. All backward-compatibility logic is isolated in this subclass.

### Automatic Version Detection

When a connection test or transfer starts, CloudVoyager detects the SonarQube server version via `/api/system/status` and logs which compatibility mode is active:

```
SonarQube server version: 9.9.0.65466 (legacy 9.x — pre-Clean Code taxonomy)
SonarQube server version: 10.4.1.88267 (modern 10.4+ issue statuses)
SonarQube server version: 2025.1.0.12345 (modern 10.4+ issue statuses)
```

The version is detected once and cached for the lifetime of the client — no redundant API calls.

The detected version is also stored in the checkpoint journal's session fingerprint. On resume, the journal validates that the SonarQube version hasn't changed — a mismatch triggers a warning (or blocks the resume if `transfer.checkpoint.strictResume` is enabled).

### Version-Aware Issue Fetching

The issue search API changed in SonarQube 10.4:

| SQ Version | API Parameter | Status Values |
|------------|--------------|---------------|
| < 10.4 | `statuses` | `OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED,FALSE_POSITIVE,ACCEPTED,FIXED` |
| >= 10.4 | `issueStatuses` | `OPEN,CONFIRMED,FALSE_POSITIVE,ACCEPTED,FIXED` |

CloudVoyager automatically uses the correct parameter based on the detected version. This avoids deprecation warnings on newer SonarQube versions and prevents future breakage when the old `statuses` parameter is removed.

If the version has not been detected (e.g., connection test was skipped), the client defaults to the legacy `statuses` parameter — so existing behavior is preserved.

### Defensive API Wrappers

Some SonarQube API endpoints are being migrated to the Web API V2 in newer versions (2025.x+). CloudVoyager wraps these calls with try/catch guards so the migration continues even if an endpoint is unavailable:

- `/api/user_groups/search` — wrapped with fallback to empty array

### Clean Code Taxonomy Enrichment

For SonarQube < 10.0, CloudVoyager fetches the Clean Code taxonomy directly from SonarCloud:

```
SonarQube 9.9.0.65466 does not support Clean Code taxonomy (requires 10.0+). Fetching enrichment from SonarCloud...
Rule enrichment map built: 1,247 rules with Clean Code data
```

### Rule Enrichment from SonarCloud

For SonarQube < 10.0, CloudVoyager fetches the Clean Code taxonomy directly from SonarCloud's rule database:

1. For each SonarCloud quality profile, it queries `/api/rules/search` with `f=cleanCodeAttribute,impacts`
2. This builds a **rule enrichment map** — a lookup table mapping rule keys (e.g., `javascript:S1234`) to their Clean Code attributes and impacts
3. When building the scanner report, rules and issues are enriched with the correct Clean Code data from SonarCloud

This means the migrated data in SonarCloud will have the **exact same** Clean Code classification as if it had been scanned natively.

### Fallback Chain

The enrichment follows a three-level fallback:

| Priority | Source | When Used |
|----------|--------|-----------|
| 1 | SonarQube issue/rule data | SQ 10.x+ (has native Clean Code fields) |
| 2 | SonarCloud rule enrichment | SQ 9.9 + rule exists in SC |
| 3 | Type-based inference | SQ 9.9 + rule not in SC (external rules) |

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

- **Transfer pipeline** (`transfer` command): Enrichment map is built once per project transfer
- **Migrate pipeline** (`migrate` command): Enrichment map is built **once per SonarCloud organization** and reused across all projects in that org
- **SQ 10.x+**: Enrichment fetch is skipped entirely (no extra API calls)

## What Works Identically Across Versions

These components work the same regardless of SonarQube version:

- Source code extraction
- Component/file tree structure
- Measures and metrics (filter-to-available approach)
- Quality gates and quality profiles
- Permissions and groups
- Security hotspot conversion
- Issue metadata sync (statuses, comments, transitions)
- Multi-branch support
- Pagination (handles both `paging.total` and legacy `total` response formats)
- Checkpoint journal and pause/resume (version-independent state tracking)

## Usage

No special configuration is needed. CloudVoyager detects the SonarQube version automatically and handles the differences transparently:

```bash
# Works with SQ 9.9, 10.x, 2025.1, or any supported version
node src/index.js transfer -c config.json --verbose
node src/index.js migrate -c config.json
```

Use `--verbose` to see detailed logs about version detection and rule enrichment.

Use the `test` command to verify connectivity and see which compatibility mode is detected:

```bash
node src/index.js test -c config.json
# Output includes: SonarQube server version: 9.9.0.65466 (legacy 9.x — pre-Clean Code taxonomy)
```

## Supported SonarQube Versions

| Version | Support Level | Notes |
|---------|--------------|-------|
| 9.9 LTS | Full | Clean Code enriched from SonarCloud; legacy `statuses` param |
| 10.0 - 10.3 | Full | Native Clean Code taxonomy; legacy `statuses` param |
| 10.4 - 10.8 | Full | Modern `issueStatuses` param |
| 2025.1+ | Full | Modern `issueStatuses` param; V2 API fallbacks |
| < 9.9 | Best effort | APIs may differ; not actively tested |

## Architecture: Isolation

All version-specific logic is isolated in `src/sonarqube/version-aware-client.js`, a subclass of the base `SonarQubeClient`. The original client and all API modules remain untouched.

```
SonarQubeClient (src/sonarqube/api-client.js)        — base client, unmodified
  └─ VersionAwareSonarQubeClient (version-aware-client.js) — overrides version-sensitive methods
       ├─ detectVersion()          — detect + cache server version
       ├─ getIssues()              — version-aware status param
       ├─ getIssuesWithComments()  — version-aware status param
       ├─ getGroups()              — defensive try/catch wrapper
       └─ testConnection()         — auto-detect version on connect
```

Version utilities live in `src/utils/version.js`:
- `parseSonarQubeVersion(str)` — parse version string to `{ major, minor, patch, raw }`
- `hasCleanCodeTaxonomy(version)` — true for SQ >= 10.0
- `isAtLeast(version, major, minor)` — generic version comparison

## Troubleshooting

### "Failed to build rule enrichment map"

If the enrichment fetch fails, CloudVoyager falls back to type-based inference. This is non-fatal — the migration will proceed, but Clean Code attributes may be less precise for active rules. Check:

- SonarCloud token has sufficient permissions
- Network connectivity to SonarCloud
- Quality profiles exist in SonarCloud for the relevant languages

### Issues appear with generic Clean Code attributes

If migrated issues show `CONVENTIONAL` instead of more specific attributes (like `LOGICAL` or `TRUSTWORTHY`), it means:

1. The rule wasn't found in the SonarCloud enrichment map
2. Type-based inference was used as fallback

This is expected for external/plugin rules that don't exist in SonarCloud. For native rules, verify that SonarCloud quality profiles are properly configured for the relevant languages.
