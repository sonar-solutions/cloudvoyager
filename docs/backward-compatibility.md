# Backward Compatibility: SonarQube 9.9 Support

CloudVoyager supports migrating from **SonarQube 9.9** (and other pre-10.x versions) to SonarCloud. This document explains how the tool handles the differences between SonarQube versions.

## Background

SonarQube 10.0 introduced the **Clean Code taxonomy**:
- **Clean Code Attributes** (e.g., `CONVENTIONAL`, `LOGICAL`, `TRUSTWORTHY`) — classify *why* code is problematic
- **Software Qualities** (`MAINTAINABILITY`, `RELIABILITY`, `SECURITY`) — classify *what* is affected
- **Impact Severities** (`LOW`, `MEDIUM`, `HIGH`, `BLOCKER`) — classify *how severe* the impact is

SonarQube 9.9 uses the older taxonomy:
- **Issue Types** (`CODE_SMELL`, `BUG`, `VULNERABILITY`, `SECURITY_HOTSPOT`)
- **Severities** (`INFO`, `MINOR`, `MAJOR`, `CRITICAL`, `BLOCKER`)

SonarCloud (always the latest version) uses the new Clean Code taxonomy. CloudVoyager bridges this gap automatically.

## How It Works

### Automatic Version Detection

When a transfer or migration starts, CloudVoyager detects the SonarQube server version via `/api/system/status`. If the version is below 10.0, it activates backward compatibility mode:

```
SonarQube server version: 9.9.0.65466
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

## Usage

No special configuration is needed. CloudVoyager detects the SonarQube version automatically and handles the differences transparently:

```bash
# Works with SQ 9.9, 10.x, or any supported version
node src/index.js transfer -c config.json --verbose
node src/index.js migrate -c config.json
```

Use `--verbose` to see detailed logs about version detection and rule enrichment.

## Supported SonarQube Versions

| Version | Support Level | Notes |
|---------|--------------|-------|
| 9.9 LTS | Full | Clean Code enriched from SonarCloud |
| 10.0 - 10.x | Full | Native Clean Code taxonomy |
| < 9.9 | Best effort | APIs may differ; not actively tested |

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
