# Technical Details

## Protobuf Encoding

The scanner report uses two encoding styles:
- **Single message** (no length delimiter): `metadata.pb`, `component-{ref}.pb`, `changesets-{ref}.pb`
- **Length-delimited** (multiple messages): `issues-{ref}.pb`, `measures-{ref}.pb`, `activerules.pb`

protobufjs automatically converts snake_case field names to camelCase in JavaScript:
- `analysis_date` becomes `analysisDate`
- `scm_revision_id` becomes `scmRevisionId`
- `component_ref` becomes `componentRef`

All field names in the codebase use camelCase to match this convention.

## Measure Type Mapping

Measures use typed value fields based on metric type:
- **Integer metrics** (`intValue`): `functions`, `statements`, `classes`, `ncloc`, `comment_lines`, `complexity`, `cognitive_complexity`, `violations`, `sqale_index`
- **String metrics** (`stringValue`): `executable_lines_data`, `ncloc_data`, `alert_status`
- **Float/percentage metrics** (`doubleValue`): `coverage`, `line_coverage`, `branch_coverage`, `duplicated_lines_density`, ratings

## Active Rules

- Active rules are filtered by languages actually used in the project, resulting in ~84% reduction in payload size
- Rule keys are stripped of the repository prefix (e.g., `S7788` not `jsarchitecture:S7788`)
- Quality profile keys are mapped to SonarCloud profile keys (not SonarQube keys)

## Component Structure

Components use a flat structure - all files are direct children of the project component (no directory components). Line counts are derived from actual source file content rather than SonarQube measures API values.

## SCM Revision Tracking

The tool includes `scm_revision_id` (git commit hash) in metadata. SonarCloud uses this to detect and reject duplicate reports, enabling proper analysis history tracking.

## Branch Name Resolution

The tool fetches the main branch name from SonarCloud (via `getMainBranchName()` API) rather than using the SonarQube branch name. This avoids mismatches where SonarQube uses "main" but SonarCloud expects "master" (or vice versa).

## API Pagination

SonarQube client handles pagination automatically via `getPaginated` method with a default page size of 500 items. All paginated results are concatenated into single arrays.

Note: some SonarQube APIs enforce a lower maximum page size of 100 (e.g., permissions, tags, profile permissions, gate permissions). The extractors handle this automatically.

## Rate Limit Handling

The SonarCloud API client supports a configurable two-layer strategy for rate limiting. Customize it via the `rateLimit` section in your config file.

1. **Exponential backoff retry** (`maxRetries`, `baseDelay`) — When a 503 or 429 response is received, the request is retried up to `maxRetries` times with exponentially increasing delays (baseDelay × 2^attempt). If all retries are exhausted, the error is propagated to the caller. Default: `3` retries.

2. **Write request throttling** (`minRequestInterval`) — POST requests are spaced at least `minRequestInterval` ms apart via a request interceptor. This proactively reduces the chance of triggering SonarCloud's rate limits during high-volume operations like issue sync and hotspot sync. Default: `0` (no throttling).

## Issue Sync

The `migrate` command syncs issue metadata after the scanner report is uploaded. For each issue in SonarQube, it:
1. Searches for a matching issue in SonarCloud by rule, component, and text range
2. Transitions the issue status (Open, Confirmed, Accepted/Won't Fix, False Positive)
3. Sets the assignee
4. Copies comments
5. Sets tags

## Hotspot Sync

Similar to issue sync, hotspot metadata is matched and synced:
1. Matches hotspots by rule, component, and text range
2. Transitions status (To Review, Acknowledged, Safe, Fixed)
3. Sets assignee
4. Copies comments

## Organization Mapping

The `migrate` command maps projects to target SonarCloud organizations based on their DevOps platform bindings. Projects with the same ALM binding are grouped together. Mapping CSVs are generated for review before execution (via `--dry-run`).

## Quality Profile Migration

Quality profiles are migrated using SonarQube's backup/restore XML format, which preserves all rule configurations, severity overrides, and parameter values. Profile permissions (user and group access) are migrated separately via the permissions API.

## Quality Gate Migration

Quality gates are created with their full condition definitions (metric, operator, threshold). The SonarQube API uses gate `name` (not `id`) for all operations. Built-in gates are skipped since they already exist in SonarCloud.
