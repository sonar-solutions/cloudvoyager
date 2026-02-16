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
