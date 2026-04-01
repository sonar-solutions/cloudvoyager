# Changelog

All notable changes to CloudVoyager are documented in this file. Entries are ordered with the most recent changes first.

---

<!-- <subsection-updated last-updated="2026-04-02T00:00:00Z" updated-by="Claude" /> -->
## sq-10.4: Multi-Value Setting Support in setProjectSetting (2026-04-02)

`setProjectSetting` in the sq-10.4 SonarCloud project-config helper now handles multi-value settings correctly.

Previously, the function accepted a single `value` string and always used SonarCloud's `value` param. SonarCloud requires multi-value settings (e.g. exclusion lists) to be submitted as repeated `values` params in the query string, which a plain `{ params: { value } }` object cannot express.

### Change

- **Renamed:** `value` parameter → `valueOrValues` to reflect that either a string or an array is accepted.
- **Added:** Array-detection branch that serialises the values via `URLSearchParams` with repeated `values` keys and appends them directly to the endpoint URL.
- **Unchanged:** Single-value path continues to use `{ params: { key, value: valueOrValues, component } }` as before.

**Modified:** `src/pipelines/sq-10.4/sonarcloud/api/project-config/helpers/project-settings-api.js`

---

## sq-2025: Fix multi-value project settings migration (2026-04-02)

Fixed a bug in `migrate-project-settings.js` (sq-2025 pipeline) where multi-value settings (`setting.values`) were incorrectly comma-joined into a single string before being passed to `client.setProjectSetting`. The SonarCloud API expects repeated `values` parameters (an array), not a comma-concatenated string.

- **Fixed:** `setting.values` is now passed as a raw array to `client.setProjectSetting`, allowing the API layer to serialize it correctly as repeated params.
- **Fixed:** Error catch block now logs at `logger.warn` instead of `logger.debug`, ensuring setting failures are visible in non-verbose runs.
- **Refactored:** Removed the merged `const value = ...` expression — the `values` array and scalar `value` paths are now separate `if / else if` branches.

**File changed:** `src/pipelines/sq-2025/sonarcloud/migrators/project-config/helpers/migrate-project-settings.js`

Also fixed the underlying API helper (`set-project-setting.js`) to handle array values via `URLSearchParams` repeated `values` params — this is the SonarCloud API requirement for settings like `sonar.exclusions`.

- **Changed:** `src/pipelines/sq-2025/sonarcloud/api/project-config/helpers/set-project-setting.js` — parameter renamed `value` → `valueOrValues`; when an array is passed, builds the query string with repeated `values` entries via `URLSearchParams`; scalar values continue to use the existing `{ params: { value } }` path.

---

<!-- <subsection-updated last-updated="2026-04-02T00:00:00Z" updated-by="Claude" /> -->
## sq-10.0: Fix multi-value project settings migration (2026-04-02)

Fixed a bug in `migrate-project-settings.js` (sq-10.0 pipeline) where multi-value settings (`setting.values`) were incorrectly comma-joined into a single string before being passed to `client.setProjectSetting`. The SonarCloud API expects repeated `values` parameters (an array), not a comma-concatenated string.

- **Fixed:** `setting.values` is now passed as a raw array to `client.setProjectSetting`, allowing the API layer to serialize it correctly as repeated params.
- **Fixed:** Error catch block now logs at `logger.warn` instead of `logger.debug`, ensuring setting failures are visible in non-verbose runs.
- **Refactored:** Removed the merged `const value = ...` expression — the `values` array and scalar `value` paths are now separate `if / else if` branches.

**File changed:** `src/pipelines/sq-10.0/sonarcloud/migrators/project-config/helpers/migrate-project-settings.js`

---

<!-- <subsection-updated last-updated="2026-04-02T00:00:00Z" updated-by="Claude" /> -->
## sq-9.9: Multi-Value Project Settings Support (2026-04-02)

Updated `setProjectSetting` in `src/pipelines/sq-9.9/sonarcloud/api/project-config/helpers/project-settings.js` to handle both single-value and multi-value settings.

Previously the function accepted only a single `value` string and called `/api/settings/set` with a `value` param. It now accepts either a string or an array:

- **Single value** — behaves as before: `{ params: { key, value, component } }`
- **Array of values** — builds `URLSearchParams` with repeated `values` entries (SonarCloud API requirement for multi-value settings) and appends them to the URL: `/api/settings/set?key=...&component=...&values=...&values=...`

- **Modified:** `src/pipelines/sq-9.9/sonarcloud/api/project-config/helpers/project-settings.js` — `setProjectSetting` now accepts `valueOrValues` (string or string[]) and branches on `Array.isArray`.

---

<!-- <subsection-updated last-updated="2026-04-02T00:00:00Z" updated-by="Claude" /> -->
## Test Fix: migrateProjectSettings multi-value assertion updated (2026-04-02)

Updated the unit test for `migrateProjectSettings` to reflect the corrected behavior where multi-value settings pass the array directly instead of joining values into a comma-separated string.

- **Changed:** `test/sonarcloud/migrators/migrators.test.js` — renamed test `'migrateProjectSettings joins values array'` to `'migrateProjectSettings passes values array directly for multi-value settings'`; changed assertion from `t.is(..., '**/*.test.js,**/*.spec.js')` to `t.deepEqual(..., ['**/*.test.js', '**/*.spec.js'])`

---

<!-- <subsection-updated last-updated="2026-04-02T00:00:00Z" updated-by="Claude" /> -->
## sq-2025: Quality Profile Rules Comparison and Project Issues Delta Reports (2026-04-02)

Added two new migration reports to the sq-2025 migrate pipeline: a **Quality Profile Rules Comparison Report** and a **Project Issues Delta Report**.

### Quality Profile Rules Comparison Report (`rules-comparison-report.md`)

Compares active rules between SonarQube quality profiles and their migrated SonarCloud counterparts, highlighting per-language discrepancies so teams can anticipate issue count changes before go-live.

- **Missing from SonarCloud** — Rules active in SonarQube that do not exist on SonarCloud (issues that will disappear post-migration)
- **Added in SonarCloud** — Rules present on SonarCloud but not in SonarQube (new issues that will appear post-migration)

New/modified files:
- **Added:** `src/shared/reports/format-rules-comparison/index.js` — Orchestrator: renders full markdown diff report
- **Added:** `src/shared/reports/format-rules-comparison/helpers/format-profile-section.js` — Formats one language/profile comparison section
- **Added:** `src/shared/reports/format-rules-comparison.js` — Re-export barrel
- **Modified:** `src/pipelines/sq-2025/migrate-pipeline/helpers/migrate-org-wide-batch2.js` — Attaches diff data to `results.rulesComparisonData`

### Project Issues Delta Report (`issues-delta-report.md`)

Per-project comparison of actual issues on SonarQube versus SonarCloud post-migration. Shows per-rule breakdown of which issues disappeared or appeared, enabling operators to confirm migration fidelity at the issue level.

New files:
- **Added:** `src/pipelines/sq-2025/sonarcloud/reports/issues-delta/helpers/diff-project-issues.js` — Diffs SQ vs SC issue sets for one project
- **Added:** `src/pipelines/sq-2025/sonarcloud/reports/issues-delta/helpers/build-rule-breakdown.js` — Groups disappeared/appeared issues by rule key
- **Added:** `src/pipelines/sq-2025/sonarcloud/reports/issues-delta/helpers/gather-project-delta.js` — Fetches and diffs issues for a single project
- **Added:** `src/pipelines/sq-2025/sonarcloud/reports/issues-delta/helpers/gather-all-delta.js` — Runs `gatherProjectDelta` across all projects
- **Added:** `src/pipelines/sq-2025/sonarcloud/reports/issues-delta/index.js` — Re-exports `gatherAllDelta`
- **Added:** `src/pipelines/sq-2025/migrate-pipeline/helpers/gather-issues-delta.js` — Calls `gatherAllDelta` from the migrate pipeline
- **Added:** `src/shared/reports/format-issues-delta/index.js` — Orchestrator: renders full markdown delta report
- **Added:** `src/shared/reports/format-issues-delta/helpers/` — Helper files for delta report formatting
- **Added:** `src/shared/reports/format-issues-delta.js` — Re-export barrel

Modified files:
- **Modified:** `create-empty-results.js` — Added `rulesComparisonData` and `issuesDeltaData` fields to the results object
- **Modified:** `run-org-migrations.js` — Stores `ctx.projectKeyMap` for downstream report use
- **Modified:** `migrate-pipeline/index.js` — Calls `gatherIssuesDelta` before writing reports
- **Modified:** `write-text-reports.js` — Writes the two new markdown report files

---

<!-- <subsection-updated last-updated="2026-04-01T00:00:00Z" updated-by="Claude" /> -->
## sq-2025: Expose mergedProjectKeyMap on ctx after org core migrations (2026-04-01)

After the `for (const r of orgCoreResults)` loop that builds `mergedProjectKeyMap` in `run-org-migrations.js`, the merged map is now assigned to `ctx.projectKeyMap`. This makes the fully-resolved project-key map available to downstream callers (e.g. `migrateEnterprisePortfolios`) via the shared `ctx` object.

- **Changed:** `src/pipelines/sq-2025/migrate-pipeline/helpers/apply-csv-and-migrate/helpers/run-org-migrations.js` — added `ctx.projectKeyMap = mergedProjectKeyMap;` after the org-core results loop.

---

<!-- <subsection-updated last-updated="2026-04-01T00:00:00Z" updated-by="Claude" /> -->
## sq-2025: Add build-rule-breakdown helper (2026-04-01)

Added a new helper to the sq-2025 pipeline's issues-delta reports subsystem.

- **Added:** `src/pipelines/sq-2025/sonarcloud/reports/issues-delta/helpers/build-rule-breakdown.js` — groups disappeared/appeared issues by rule key, returning `{ [ruleKey]: { disappeared: number, appeared: number } }`. Used to summarise which rules account for deltas between SonarQube and SonarCloud issue sets.

---

<!-- <subsection-updated last-updated="2026-04-01T00:00:00Z" updated-by="Claude" /> -->
## sq-2025: Add issues-delta report index (2026-04-01)

Added a new barrel export file for the `issues-delta` report module in the sq-2025 pipeline.

- **Added:** `src/pipelines/sq-2025/sonarcloud/reports/issues-delta/index.js` — re-exports `gatherAllDelta` from its helpers subfolder, following the standard folder-centric module pattern.

---

<!-- <subsection-updated last-updated="2026-04-01T00:00:00Z" updated-by="Claude" /> -->
## Desktop Migration Graph: Bug Fixes (2026-04-01)

Fixed four bugs in the desktop migration graph visualization component that caused incorrect node positioning, missing edges, blocked node activation, and inconsistent progress parsing.

All changes are in `desktop/src/renderer/js/components/migration-graph*.js`.

### Bug Fixes

- **Fixed:** Portfolios node overlapping with per-project Issues/Hotspots nodes in the migrate graph — moved the Portfolios node X position from `+560` to `+720` to eliminate the visual collision.
- **Fixed:** Missing base edge from `projects → portfolios` in the migrate graph definition — the edge was absent, causing the graph to render portfolios as disconnected from the projects node.
- **Fixed:** Portfolios node activation blocked by per-project config fanout edges — the dependency check was incorrectly counting project-specific child edges as unresolved dependencies. The check now excludes project nodes so the Portfolios node activates correctly when its real dependencies are met.
- **Fixed:** Inconsistent issue/hotspot sync completion patterns in the fallback log parser — `_tryParseProjectSubPhase` and `_parseSyncMetadataLine` now match the prefixed parser patterns used elsewhere, resolving cases where sync completion was silently missed in fallback mode.

---

<!-- Updated: Mar 28, 2026 -->
## Search Slicer: Fix 10K Limit on Large Projects (2026-03-28)

Fixed two bugs that caused transfers to fail for projects with more than 10,000 issues.

### Bug 1 — `10001th result asked` (Elasticsearch limit hit during date-range probe)

- **Root cause:** `slice-by-creation-date.js` called `findDateRange()` to determine the oldest/newest issue before building date windows. `findDateRange` used `getPaginatedFn` with `ps=1`, causing the paginator to loop page-by-page through all issues. On projects with >10K issues it reached page 10,001, which Elasticsearch rejects.
- **Fixed:** Removed `find-date-range.js` and the probing step entirely. `sliceByCreationDate` now uses a fixed epoch (`2006-01-01` → now) to build 12 equal-width time windows, requiring zero API calls to determine the date range.
- **Fixed:** Added an unsplittable-window guard in `fetchWindow` — if bisection reaches a same-millisecond boundary (e.g. mass-import scenarios where all issues share one timestamp), the window is fetched directly rather than looping forever.
- **Refactored:** Extracted `splitMidpoint` to `split-midpoint.js` and `buildDateWindows` to `build-date-windows.js` to keep all files under 50 lines.
- **Deleted:** `find-date-range.js` (contained the bug; no longer needed).

### Bug 2 — `Date cannot be parsed as either a date or date+time` (wrong datetime format)

- **Root cause:** JavaScript's `Date.toISOString()` produces `2007-09-08T21:21:02.125Z` (includes milliseconds). SonarQube's `createdAfter`/`createdBefore` API parameters reject this format and require `2007-09-08T21:21:02+0000`.
- **Fixed:** Added `format-sonarqube-date.js` helper that strips milliseconds and replaces `Z` with `+0000`. All date-window boundaries and midpoints now use this formatter.

### Bug 3 — Desktop app config validation failure (`/transfer must NOT have additional properties`)

- **Root cause:** The desktop transfer wizard set `transfer.skipIssueMetadataSync` and `transfer.skipHotspotMetadataSync` in the config, but these weren't declared in `transfer-options-schema.js`. The schema's `additionalProperties: false` rejected them.
- **Fixed:** Added both properties to the transfer options schema.

---

## Transfer Command: Metadata Sync (2026-03-27)

The `transfer` command now includes a **Phase 2: Metadata Sync** that runs automatically after the scanner report upload completes.

- **Added:** Issue metadata sync — replays full status history from SQ changelog, copies comments with attribution, adds `metadata-synchronized` tag, syncs assignments, and adds a `[SonarQube Source]` comment linking back to the original SQ issue URL.
- **Added:** Hotspot metadata sync — syncs hotspot statuses, comments, and source links.
- **Added:** `skipIssueMetadataSync` and `skipHotspotMetadataSync` options in transfer config to opt out.
- **Impact:** All 4 pipeline versions (sq-9.9, sq-10.0, sq-10.4, sq-2025) now include metadata sync. Previously, the `transfer` command only uploaded the scanner report, leaving all issues in default "Open" status with no comments, tags, or assignments.

---

## External Issue Prefix Fix (2026-03-27)

Fixed a critical bug where **all external linter issues** (Ruff, Pylint, ESLint, Checkstyle, etc.) were silently dropped during migration from SonarQube 2025+.

- **Root cause:** SonarQube 2025+ returns external linter rules with an `external_` prefix (e.g., `external_ruff:D200`). SonarCloud's `/api/rules/repositories` includes `external_ruff` as a known repo, causing `isExternalIssue()` to misclassify these as native issues. SC then dropped them because no native rule `external_ruff:D200` exists.
- **Fixed:** `isExternalIssue()` now detects the `external_` prefix and always treats such rules as external — across all 4 pipeline versions (sq-9.9, sq-10.0, sq-10.4, sq-2025).
- **Fixed:** External issue builders now strip the `external_` prefix from the engineId via a new shared `stripExternalPrefix()` utility, preventing a double `external_external_ruff:D200` prefix in SonarCloud.
- **Fixed:** sq-2025 issue model now preserves `externalRuleEngine` from SQ API responses.
- **Impact:** Affected up to 36 external linter types. Tested with `okorach-oss_sonar-tools` project (1,101 Ruff+Pylint issues previously dropped, now migrated correctly).

---

## CI Workflow Restructure (2026-03-26)

Restructured GitHub Actions workflows to simplify CI and automate versioning.

### Workflow Trigger Cleanup

All workflows now trigger **only on push to `main`**. Removed all `pull_request` triggers to prevent redundant runs on feature branches.

- **Changed:** `sonarcloud.yml` — removed `pull_request` trigger
- **Changed:** `unit-tests.yml` — removed `pull_request` trigger

### Separate Unit Tests Workflow

Unit tests are now a standalone workflow, decoupled from both SonarCloud scanning and regression tests.

- **New:** `.github/workflows/unit-tests.yml` — standalone unit test workflow triggered on push to `main`
- **Changed:** `.github/workflows/sonarcloud.yml` — removed test coverage step; now only runs SAST/SCA scanning
- **Changed:** `.github/workflows/regression.yml` — removed `unit-tests` job from regression pipeline
- **Changed:** `sonar-project.properties` — removed `sonar.tests`, `sonar.test.inclusions`, `sonar.javascript.lcov.reportPaths`, and `sonar.coverage.exclusions`

### Auto Version Bump from PR Milestone

Version bumping is now fully automated based on the milestone assigned to merged PRs.

- **New:** `.github/workflows/version-bump.yml` — on PR merge, reads the milestone title and bumps `package.json` + `package-lock.json` (patch increment if same milestone, reset to `.0` if new milestone)
- **Changed:** `.github/workflows/gh-release.yml` — milestone link now uses the correct GitHub milestone integer ID (queried via API) instead of the version string
- **Changed:** `package.json` — version bumped from `1.1.2` to `1.2.0` for milestone 1.2

---

## Bug Fix Audit (2026-03-26)

A comprehensive codebase audit identified 83 issues. The following 10 high/medium severity bugs were fixed across 26 files.

- **Fixed:** Org-level verification was comparing SonarCloud to itself (passing `scClient` as both args to `runOrgChecks`). Now correctly constructs a `SonarQubeClient` for the SQ side.
- **Fixed:** Missing `await` on `syncIssueAssignment()` in sq-10.0 pipeline caused silent error swallowing and stats race conditions.
- **Fixed:** `ACCEPTED` status mapped to invalid `'accept'` transition in sq-9.9 and sq-10.0 pipelines (SonarCloud only supports `wontfix`). Now matches sq-10.4/sq-2025 correct mapping.
- **Fixed:** `ShutdownCoordinator` created but never passed to `handleMigrateAction` and `handleSyncMetadataAction`, preventing graceful cleanup on SIGINT.
- **Fixed:** `build-match-key.js` used `||` instead of `??` for line numbers, treating `line: 0` (file-level issues) as falsy. Fixed in sq-9.9, sq-10.4, and sq-2025.
- **Fixed:** `findDateRange` in search slicer had no null check — empty API results caused `NaN` timestamps and silent data loss.
- **Fixed:** CSV injection vulnerability in `escapeCsv()` — values starting with `=`, `+`, `-`, `@` are now prefixed with a single quote inside double quotes.
- **Fixed:** XSS via `innerHTML` in Desktop app — `err.message` in connection-test and status screens, and `screen` variable in app.js, are now escaped with `ConfigForm.escapeHtml()`.
- **Fixed:** `createLimiter()` silently deadlocked when `concurrency` was 0, NaN, or negative. Now throws an error for invalid values.
- **Fixed:** Desktop config cross-contamination — verify-config and sync-metadata-config screens were saving to `migrateConfig`, overwriting migrate settings. Each now uses its own config key (`verifyConfig`, `syncMetadataConfig`) with backward-compatible fallback.

---

## Milestone 1.2 Fixes (2026-03-26)

The following four fixes were applied as part of the v1.2 milestone.

### Search Slicing for 10K+ Issues (#53)

SonarQube's `/api/issues/search` endpoint caps results at 10,000. Projects exceeding this limit now use date-window slicing to retrieve all issues.

- **New:** `src/shared/utils/search-slicer/` (5 files) — partitions the creation-date range into narrowing windows until each window returns fewer than 10K results
- **New:** `probe-total.js` added to each pipeline's `api-client/helpers/` (sq-9.9, sq-10.0, sq-10.4, sq-2025) — probes the total issue count for a query
- **Modified:** `issues-hotspots.js` in all 4 pipelines now calls `fetchWithSlicing` when the total exceeds the 10K ceiling

### Third-Party Issue Migration Fix (#56)

Fixed silent loss of external (third-party) issues when the SonarCloud rule-repositories API was unreachable.

- **New:** `src/shared/utils/fallback-repos/index.js` — built-in set of 43 known SonarCloud rule repositories used as a fallback
- **Fixed:** `isExternalIssue()` falls back to `FALLBACK_SONARCLOUD_REPOS` when the live repo set is empty; handles rules without colons and empty repo prefixes
- **Fixed:** `getRuleRepositories()` retries the API call up to 3 times with exponential backoff (1 s, 2 s, 3 s) and returns the fallback set if all retries fail

*(See the existing v1.1.9 entry below for per-file details.)*

### SonarCloud Public Scanning (#66)

Added automatic SAST/SCA scanning of the CloudVoyager repository via SonarCloud.

- **New:** `.github/workflows/sonarcloud.yml` — triggers on push to `main` and on pull requests
- **New:** `sonar-project.properties` — SonarCloud project configuration (org, project key, sources, exclusions)
- **Requires:** `SONAR_TOKEN` secret configured in the GitHub repository

### Release Milestone References (#75)

GitHub releases now include the corresponding milestone link in the release body.

- **Modified:** `.github/workflows/gh-release.yml` — extracts the version tag, derives the milestone name, and appends a milestone link to the auto-generated release notes

### Desktop UI — Collapsible Config Sections

The migrate-config wizard now groups optional settings into collapsible sections that start collapsed by default, reducing visual clutter for new users.

- **Changed:** "Choose What to Migrate" section is now collapsed by default (collapsible with shield icon)
- **Changed:** "More Settings (Advanced)" section is now collapsed by default (collapsible with gear icon)

---

## [1.1.10] - 2026-03-26

### Bug Fix — Test Compatibility for Factory-Pattern Class Wrappers

Fixed 134 hook failures and 47 test failures caused by the refactored class wrappers (`SonarQubeClient`, `SonarCloudClient`, `ProtobufBuilder`, `ProtobufEncoder`, `EnterpriseClient`, `ReportUploader`) not being compatible with sinon prototype stubbing.

#### Root Cause
The major refactor (v1.1.7) converted monolithic classes into factory functions with thin class wrappers using `Object.assign(this, instance)`. This broke sinon's `sinon.stub(Class.prototype, 'method')` pattern because:
1. Methods existed as instance properties (from `Object.assign`), not on the prototype
2. Sinon requires methods to exist on the prototype before stubbing
3. Instance properties from `Object.assign` shadowed prototype stubs

#### Fix
- Added prototype method placeholders to all class wrappers so sinon can stub them
- Changed constructors to detect sinon stubs (via `isSinonProxy` flag) and skip overwriting them
- Added missing `handleError` method to `SonarQubeClient` factory
- Added missing `_findTaskFromActivity` method to `ReportUploader` class and factory
- Fixed `buildSubmitForm` to use `metadata.branchType` instead of hardcoded `'LONG'`
- Made `handleError` reference `instance.baseURL` dynamically instead of closure capture

#### Files Changed
- `src/pipelines/sq-10.4/sonarqube/api-client/index.js`
- `src/pipelines/sq-10.4/sonarqube/api-client/helpers/create-sonarqube-client.js`
- `src/pipelines/sq-10.4/sonarcloud/api-client/index.js`
- `src/pipelines/sq-10.4/protobuf/builder/index.js`
- `src/pipelines/sq-10.4/protobuf/encoder/index.js`
- `src/pipelines/sq-10.4/sonarcloud/enterprise-client/index.js`
- `src/pipelines/sq-10.4/sonarcloud/uploader/index.js`
- `src/pipelines/sq-10.4/sonarcloud/uploader/helpers/create-report-uploader.js`
- `src/pipelines/sq-10.4/sonarcloud/uploader/helpers/build-submit-form.js`

---

## [1.1.9] - 2026-03-26

### Bug Fix — Third-Party Issue Migration (#56)

Fixed a bug where external (third-party) issues were silently dropped during migration when the SonarCloud `/api/rules/repositories` endpoint was unreachable or returned an error.

#### Root Cause
When `sonarCloudRepos` was empty (due to API failure), three layers of code conspired to skip all external issues:
1. `isExternalIssue()` returned `false` for every issue when the repo set was empty
2. `buildExternalIssues()` short-circuited with an early return when the repo set was empty
3. `getRuleRepositories()` returned an empty `Set` on any API error with no retry

#### Fix (applied across all 4 pipelines: sq-9.9, sq-10.0, sq-10.4, sq-2025)
- **`isExternalIssue`** — Falls back to `FALLBACK_SONARCLOUD_REPOS` (a built-in set of known SonarCloud rule repos) when the live repo set is empty. Also adds guards for rules without colons and empty repo prefixes.
- **`buildExternalIssues`** — Removes the early-return that skipped processing; now logs a warning and continues with fallback data.
- **`getRuleRepositories`** — Retries the API call up to 3 times with exponential backoff (1s, 2s, 3s). If all retries fail, returns `FALLBACK_SONARCLOUD_REPOS` instead of an empty set.

#### Files Changed
- `src/pipelines/sq-{9.9,10.0,10.4,2025}/protobuf/build-external-issues/helpers/is-external-issue.js`
- `src/pipelines/sq-9.9/protobuf/build-external-issues/helpers/build-external-issues-core.js`
- `src/pipelines/sq-10.0/protobuf/build-external-issues/index.js`
- `src/pipelines/sq-10.4/protobuf/build-external-issues/helpers/build-external-issues.js`
- `src/pipelines/sq-2025/protobuf/build-external-issues/helpers/build-external-issues-core.js`
- `src/pipelines/sq-9.9/sonarcloud/api-client/helpers/query-methods-extended.js`
- `src/pipelines/sq-10.0/sonarcloud/api-client/helpers/permission-query-methods.js`
- `src/pipelines/sq-10.4/sonarcloud/api-client/helpers/extended-query-methods.js`
- `src/pipelines/sq-2025/sonarcloud/api-client/helpers/query-methods-4.js`

---

## [1.1.8] - 2026-03-25

### Bug Fix — Broken Relative Import Paths After Folder Refactoring

Fixed 366 broken relative import paths across 325 files in `src/pipelines/`, `src/commands/`, and `src/version-router/`. After the folder-based module decomposition (v1.1.7), helper files nested inside new subfolder structures had incorrect `../` counts in their relative paths to `src/shared/` and to sibling pipeline modules.

#### Root Cause
Files moved one level deeper (e.g., from `module.js` into `module/helpers/fn.js`) still used the old `../` count, causing imports to resolve to `src/pipelines/shared/` instead of `src/shared/`.

#### Scope
- **358 shared/ imports** fixed across `src/pipelines/sq-9.9/`, `sq-10.0/`, `sq-10.4/`, and `sq-2025/`
- **8 intra-pipeline imports** fixed (transfer-pipeline, rule-helpers, quality-profiles, find-task-from-activity)
- **1,652 files** verified — all relative imports now resolve correctly
- CLI verified working via `node src/index.js --help`

---

## [1.1.7] - 2026-03-25

### Code Architecture Refactoring — Folder-Based Module Decomposition

Refactored all 55+ files exceeding 50 lines in `src/pipelines/sq-10.4/` into a folder-based module architecture. Every large file is now decomposed into `module-name/index.js` + `module-name/helpers/*.js`, with a 1-line re-export file at the original path preserving all existing import paths.

#### Architecture Pattern
- **Module pattern:** `big-file.js` → `big-file.js` (re-export) + `big-file/index.js` (orchestrator) + `big-file/helpers/*.js` (one function per file)
- **Factory functions over classes:** `SonarQubeClient` → `createSonarQubeClient()`, `SonarCloudClient` → `createSonarCloudClient()`, `ProtobufBuilder` → `createProtobufBuilder()`, `DataExtractor` → `createDataExtractor()`. Thin class wrappers preserved for backward compatibility.
- **All files ≤50 lines** — down from 55+ files exceeding the limit (largest was 641 lines)
- **Zero public API changes** — all import paths remain the same via re-export files

#### Key Metrics
- **Before:** 73 JS files, 9,317 total lines, 55+ files over 50 lines
- **After:** 404 JS files, 8,656 total lines, 0 files over 50 lines
- **Dead code removed:** `checkpoint-extractor.js`, `ce-submitter.js`, `report-packager.js`, `project-core-migrator.js`, `project-metadata-sync.js`, `project-config-migrator.js`

#### Largest Files Decomposed
| Original File | Lines Before → After | Helper Files |
|---|---|---|
| `sonarqube/extractors/index.js` | 641 → 42 | 20 helpers |
| `transfer-pipeline.js` | 478 → 2 | 15 helpers |
| `pipeline/project-migration.js` | 453 → 6 | 21 helpers |
| `sonarcloud/uploader.js` | 381 → 2 | 10 helpers |
| `sonarcloud/api-client.js` | 360 → 1 | 8 helpers (+ 4 delegate files) |
| `sonarcloud/migrators/issue-sync.js` | 308 → 1 | 12 helpers |
| `migrate-pipeline.js` | 307 → 1 | 10 helpers |
| `pipeline/org-migration.js` | 304 → 6 | 10 helpers |
| `sonarcloud/migrators/hotspot-sync.js` | 293 → 1 | 15 helpers |
| `sonarqube/api-client.js` | 259 → 1 | 12 helpers |
| `protobuf/build-external-issues.js` | 257 → 1 | 11 helpers |
| `protobuf/builder.js` | 227 → 1 | 10 helpers |

---

## [1.1.6] - 2026-03-25

### Regression Testing Suite

Added a comprehensive GitHub Actions regression testing workflow that runs all CLI feature/flag combinations in parallel.

- **30 parallel integration test jobs** covering all `migrate`, `sync-metadata`, and `verify` flag combinations
- **4-stage pipeline graph** visible in the Actions UI: setup → quality → integration tests → summary
- **Completely separate** from the release workflow — does not block asset builds
- **Matrix strategy** with `fail-fast: false` so one failure doesn't cancel other tests
- **Config generation from secrets** — `migrate-config.json` built at runtime from GitHub Secrets
- **Composite actions** for shared steps (dependency restore, config generation)
- Triggers automatically on push to `main` and on pull requests

---

## [1.1.5] - 2026-03-25

### Desktop App — SonarCloud Organization Validation

- **config-form.js** — Added `validateOrgs()` method that enforces at least one SonarCloud organization is present and all required fields (org key, token) are filled before allowing the user to proceed.
- **migrate-config.js** — Org step Next button now calls `ConfigForm.validateOrgs()` before advancing.
- **sync-metadata-config.js** — Org step Next button now calls `ConfigForm.validateOrgs()` before advancing.
- **verify-config.js** — Org step Next button now calls `ConfigForm.validateOrgs()` before advancing.
- Shows a toast notification when no organizations have been added.

---

## [1.1.4] - 2026-03-25

### Pipeline Modularization and New Components

Refactored project migration into modular components and added new capabilities across all 4 pipeline versions (sq-9.9, sq-10.0, sq-10.4, sq-2025).

#### Pipeline Decomposition
- **project-config-migrator.js** — Extracted project config migration into its own module (settings, tags, links, new code periods, DevOps binding, quality gate/profile assignment, permissions). Uses journal-guarded steps for pause/resume.
- **project-core-migrator.js** — Extracted core project migration (scanner report upload + project config) as Phase 1 of project migration. Returns context needed for Phase 2.
- **project-metadata-sync.js** — Extracted issue + hotspot metadata sync as Phase 2 of project migration. Runs issue and hotspot sync in parallel.
- **transfer-branch.js** — Extracted single-branch build→encode→upload pipeline into its own module, used by both transfer and migrate commands.

#### Report Packaging and CE Submission
- **report-packager.js** — Extracted scanner report ZIP creation into its own module. Handles all protobuf file types (metadata, components, issues, external issues, ad-hoc rules, measures, duplications, changesets, sources, active rules, context-props).
- **ce-submitter.js** — Extracted CE submission with robust retry mechanism: submit → timeout fallback to `/api/ce/activity` polling (5 checks) → re-submit → poll again → fail with descriptive error.

#### Issue Status Mapping
- **issue-status-mapper.js** — Extracted issue status transition mapping from changelog diffs. Maps SonarQube status changes (CONFIRMED, REOPENED, RESOLVED, CLOSED, ACCEPTED, FALSE-POSITIVE, WONTFIX) to SonarCloud transitions. Handles SQ 10.4+ where WONTFIX/FALSE-POSITIVE appear as direct status values.

#### Checkpoint-Aware Extraction
- **checkpoint-extractor.js** — Extracted checkpoint-aware data extraction with journal + cache support. Implements 13-phase extraction pipeline (project metadata, metrics, components, source files, rules, issues, hotspots, measures, sources, duplications, changesets, symbols, syntax highlighting) with per-phase caching and resume capability. Also supports branch-specific extraction.

#### CSV Entity Filtering
- **csv-entity-filters.js** — New shared module for filtering extracted entities using dry-run CSV overrides. Supports filtering quality gates, quality profiles, groups, global permissions, permission templates, portfolios, and user mappings by Include column.

#### Verification Report Modularization
- **markdown-sections/** and **pdf-sections/** — Modularized verification report generation into separate section modules (detail-sections.js, project-results.js) for both Markdown and PDF formats.

#### Desktop App Enhancements
- **progress-parser.js** — New component that parses CLI log output in real-time to compute progress percentages and ETA for all three pipeline types (migrate, transfer, verify). Tracks per-project sub-phases and displays remaining time estimates.
- **whale-animator.js** — New component rendering a pixel-art whale sprite animation with starfield, cloud parallax, and typewriter phase labels during execution. Supports dark/light themes.

#### Files Added (per pipeline × 4 versions)
- `src/pipelines/sq-{version}/pipeline/project-config-migrator.js`
- `src/pipelines/sq-{version}/pipeline/project-core-migrator.js`
- `src/pipelines/sq-{version}/pipeline/project-metadata-sync.js`
- `src/pipelines/sq-{version}/sonarcloud/ce-submitter.js`
- `src/pipelines/sq-{version}/sonarcloud/migrators/issue-status-mapper.js`
- `src/pipelines/sq-{version}/sonarcloud/report-packager.js`
- `src/pipelines/sq-{version}/sonarqube/extractors/checkpoint-extractor.js`
- `src/pipelines/sq-{version}/transfer-branch.js`

#### Files Added (shared)
- `src/shared/mapping/csv-entity-filters.js`
- `src/shared/verification/reports/markdown-sections/detail-sections.js`
- `src/shared/verification/reports/markdown-sections/project-results.js`
- `src/shared/verification/reports/pdf-sections/detail-sections.js`
- `src/shared/verification/reports/pdf-sections/project-results.js`

#### Files Added (desktop)
- `desktop/src/renderer/js/components/progress-parser.js`
- `desktop/src/renderer/js/components/whale-animator.js`

---

## [Documentation] - 2026-03-20

### Updated
- **docs/architecture.md** — Updated folder structure, pipeline layout, version differences table, data flow diagrams, desktop app architecture, build system details
- **docs/technical-details.md** — Updated protobuf encoding details, report ZIP structure, external issues documentation, state management, concurrency, error hierarchy
- **docs/configuration.md** — Updated CLI flags, config schemas, auto-tune defaults, environment variables, npm scripts
- **docs/desktop-app.md** — Updated Electron architecture, IPC channels, renderer components, security features, build targets
- **docs/backward-compatibility.md** — Completed version differences documentation across all 4 pipelines (sq-9.9, sq-10.0, sq-10.4, sq-2025)
- **docs/local-development.md** — Updated build pipeline, CI/CD details, platform targets, added Node.js v22+ SEA warning
- **docs/troubleshooting.md** — Updated error classes, API gotchas, checkpoint/resume issues
- **docs/verification.md** — Updated verification checks, output formats, CLI flags
- **docs/scenario-single-project.md** — Updated transfer workflow, CLI flags, checkpoint/resume details
- **docs/scenario-single-org.md** — Updated single-org migration workflow, dry-run, CSV mapping
- **docs/scenario-multi-org.md** — Updated multi-org migration, enterprise portfolios, project key resolution
- **docs/dry-run-csv-reference.md** — Updated 9 CSV types documentation
- **docs/key-capabilities.md** — Updated capability descriptions with verified codebase details
- **docs/pseudocode-explanation.md** — Updated pipeline pseudocode with verified extraction phases and migration steps

### Context
Full codebase review performed across all 322 source files (4 version-specific pipelines, shared modules, desktop app, build system, tests) to ensure documentation accuracy.

---

## [1.1.3] - 2026-03-20

### Pipeline-Per-Version Architecture Refactor

Refactored the entire codebase from a flat structure with a single `VersionAwareSonarQubeClient` to a **pipeline-per-version** architecture. Each supported SonarQube version range now has its own fully independent pipeline directory containing all version-specific code.

#### Architecture Change
- Moved all version-specific code from flat `src/` directories into `src/pipelines/sq-{version}/` directories (sq-9.9, sq-10.0, sq-10.4, sq-2025)
- Moved all version-independent shared code into `src/shared/` (config, mapping, reports, state, utils, verification)
- Added `src/version-router.js` to detect SonarQube version and dynamically load the correct pipeline
- Removed `VersionAwareSonarQubeClient` — each pipeline now has its own `SonarQubeClient` with version-specific behavior hardcoded
- No runtime version checks exist within any pipeline — all version differences are resolved by the pipeline selection

#### Benefits
- **Zero cross-version regressions** — changes to one pipeline cannot affect another
- **Easier maintenance** — each pipeline is self-contained and independently testable
- **Clear version boundaries** — no hidden runtime branching or fallback chains
- **Simpler debugging** — all version-specific behavior is in one directory

#### Pipeline Differences
| Behavior | sq-9.9 | sq-10.0 | sq-10.4 | sq-2025 |
|----------|--------|---------|---------|---------|
| Issue search param | `statuses` | `statuses` | `issueStatuses` | `issueStatuses` |
| MetricKeys limit | Batched (15) | Batched (15) | Batched (15) | No batching |
| Clean Code source | SC enrichment map | Native from SQ | Native from SQ | Native from SQ |
| Groups API | Standard | Standard | Standard | Web API V2 fallback |

#### Files Restructured
- **Moved:** `src/sonarqube/` → `src/pipelines/sq-{version}/sonarqube/` (per-version)
- **Moved:** `src/sonarcloud/` → `src/pipelines/sq-{version}/sonarcloud/` (per-version)
- **Moved:** `src/protobuf/` → `src/pipelines/sq-{version}/protobuf/` (per-version)
- **Moved:** `src/pipeline/` → `src/pipelines/sq-{version}/pipeline/` (per-version)
- **Moved:** `src/transfer-pipeline.js` → `src/pipelines/sq-{version}/transfer-pipeline.js` (per-version)
- **Moved:** `src/migrate-pipeline.js` → `src/pipelines/sq-{version}/migrate-pipeline.js` (per-version)
- **Moved:** `src/config/` → `src/shared/config/`
- **Moved:** `src/mapping/` → `src/shared/mapping/`
- **Moved:** `src/reports/` → `src/shared/reports/`
- **Moved:** `src/state/` → `src/shared/state/`
- **Moved:** `src/utils/` → `src/shared/utils/`
- **Moved:** `src/verification/` → `src/shared/verification/`
- **Added:** `src/version-router.js`
- **Removed:** `src/sonarqube/version-aware-client.js`

#### Documentation
- Updated CONTRIBUTING.md with new architecture patterns and directory structure
- Updated docs/key-capabilities.md with correct file paths
- Updated docs/technical-details.md with correct file paths
- Updated all documentation timestamps

---

## [1.1.2] - 2026-03-15

### Cross-Compile Support and macOS x64 Desktop App

#### Cross-Platform SEA Binary Building
- Added `--target=<platform>` flag to `scripts/build.js` for cross-compiling Node.js SEA binaries (e.g., building a macOS x64 binary from an ARM64 Mac)
- When cross-compiling, the build script downloads the correct Node.js binary for the target architecture from nodejs.org and injects the SEA blob into it
- Supported targets: `macos-x64`, `macos-arm64`, `linux-x64`, `linux-arm64`

#### CI/CD Fix: macOS x64 Binary
- Fixed `build-sea-macos-x64` GitHub Actions job — previously used `macos-13` (unavailable) then `macos-15` (ARM64, producing wrong architecture binary)
- Now runs on `macos-latest` (ARM64) with `--target=macos-x64` for cross-compilation

#### macOS x64 Desktop App
- Added `build:mac-x64` npm script to the desktop app for building macOS Intel `.dmg` installers
- Added `build-desktop-macos-x64` job to GitHub Actions workflow
- Platform count increases from 5 to 6 for the desktop app

#### Files Modified
- **Modified:** `scripts/build.js` — added `--target` flag, `downloadNodeBinary()` function, cross-compile logic in `seaPackage()`
- **Modified:** `.github/workflows/build.yml` — `build-sea-macos-x64` uses `macos-latest` with cross-compile
- **Modified:** `.github/workflows/build-desktop.yml` — added `build-desktop-macos-x64` job
- **Modified:** `desktop/package.json` — added `build:mac-x64` script

---

## [1.1.1] - 2026-03-12

### Bug Fix: SonarCloud Issue Sync Failure (FALSE_POSITIVE Status Parameter)

Projects were being marked as **partial** because the "Sync issues" step failed for every project with:
> `Value of parameter 'statuses' (FALSE_POSITIVE) must be one of: [OPEN, CONFIRMED, REOPENED, RESOLVED, CLOSED]`

The SonarCloud `/api/issues/search` endpoint was being called with `FALSE_POSITIVE`, `ACCEPTED`, and `FIXED` appended to the `statuses` parameter. SonarCloud does not accept these values — `FALSE_POSITIVE` and `WONTFIX` are *resolutions* in SonarCloud (issues appear as `RESOLVED` with a `resolution` field), while `ACCEPTED` and `FIXED` are SonarQube 10.4+ statuses that SonarCloud's API does not support. The fix restricts the SonarCloud issue search to `OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED` only, which correctly captures all issues including false positives.

#### Files Modified
- **Fixed:** `src/sonarcloud/api/issues.js` — removed invalid SonarCloud statuses from `ALL_STATUSES` constant

#### Documentation Fixes
- **Fixed:** `docs/key-capabilities.md` — issue transition mapping had `FALSE-POSITIVE → wontfix` (incorrect); corrected to `FALSE-POSITIVE → falsepositive`; added missing `REOPENED → reopen`, `OPEN → unconfirm`, and `CLOSED → resolve` transitions
- **Fixed:** `docs/troubleshooting.md` — example migration report outputs were missing the `Assign quality profiles` step between `Assign quality gate` and `Project permissions`

---

## [1.1.0] - 2026-03-10

---

### 2026-03-10 — Incremental Migrations with Pause/Resume

#### New Feature: Checkpoint Journal System
- Added a **write-ahead checkpoint journal** that tracks phase-by-phase progress for both `transfer` and `migrate` commands, enabling true pause/resume across all migration workflows
- Interrupted migrations (CTRL+C, crashes, network failures) can now be resumed from the exact point of interruption — no re-processing of completed work
- The journal stores a session fingerprint (SonarQube version, URL, project key) and validates it on resume, warning on version mismatches

#### Graceful Shutdown (SIGINT/SIGTERM)
- First CTRL+C: finishes the current atomic operation, saves progress to the journal, releases the lock, and exits cleanly
- Second CTRL+C: forces immediate exit
- Cleanup handlers are registered for saving state, releasing locks, and flushing logs

#### Concurrent Run Prevention
- Advisory lock file (`<stateFile>.lock`) prevents two instances from running on the same state file simultaneously
- Stale lock detection: auto-releases locks from dead processes (PID check) or locks older than 6 hours
- Different-hostname locks require `--force-unlock` for NFS safety

#### Extraction Caching
- Extraction results are cached to disk as gzipped JSON files, so resumed runs skip already-completed extraction phases
- Cache files auto-purge after 7 days (configurable via `transfer.checkpoint.cacheMaxAgeDays`)
- Corrupt cache files are handled gracefully (phase re-executes)

#### Upload Deduplication
- Before re-uploading after a crash, checks `/api/ce/activity` for existing CE tasks from the current session
- Prevents duplicate CE tasks — the most dangerous edge case in crash-during-upload scenarios

#### Migration Journal (Multi-Project)
- Per-organization and per-project completion tracking for the `migrate` command
- On resume: completed orgs and projects are skipped, in-progress projects resume from their last completed step
- Output directory is preserved on resume (no longer wiped)

#### Atomic State Writes
- State files now use write-to-temp, `fsync`, then atomic rename — prevents corruption on crash
- Backup rotation: current state is copied to `.backup` before each save
- Safe load with fallback: tries main file, then `.backup`, then returns null
- Disk space pre-check (10MB minimum) before writing

#### New CLI Flags
- `--force-restart` — Discard checkpoint/migration journal and start from scratch (`transfer`, `migrate`)
- `--force-fresh-extract` — Discard extraction caches and re-extract everything (`transfer`)
- `--force-unlock` — Force release a stale lock file from a previous run (`transfer`, `migrate`)
- `--show-progress` — Display checkpoint progress table and exit (`transfer`)

#### New Config Options
- `transfer.checkpoint.enabled` — Enable/disable checkpoint journal (default: `true`)
- `transfer.checkpoint.cacheExtractions` — Enable/disable extraction caching (default: `true`)
- `transfer.checkpoint.cacheMaxAgeDays` — Max age of cache files in days (default: `7`)
- `transfer.checkpoint.strictResume` — Fail on SonarQube version mismatch when resuming (default: `false`)

#### Enhanced Commands
- `status` command now shows checkpoint journal progress (phases, branches, completion %) when a journal exists
- `reset` command now clears checkpoint journals, lock files, and extraction caches in addition to state files

#### Files Added
- **New:** `src/state/lock.js` — Advisory lock file with PID-based stale detection
- **New:** `src/utils/shutdown.js` — Graceful SIGINT/SIGTERM coordination
- **New:** `src/state/checkpoint.js` — Phase-level checkpoint journal
- **New:** `src/state/extraction-cache.js` — Gzipped disk cache for extraction results
- **New:** `src/state/migration-journal.js` — Multi-project migration progress tracking
- **New:** `src/utils/progress.js` — Progress display for checkpoint and migration journals

#### Files Modified
- **Modified:** `src/state/storage.js` — Atomic save with backup rotation and disk space checks
- **Modified:** `src/state/tracker.js` — Lock file integration and per-branch save
- **Modified:** `src/utils/errors.js` — Added `GracefulShutdownError`, `LockError`, `StaleResumeError`
- **Modified:** `src/sonarqube/extractors/index.js` — Checkpoint-aware extraction with journal + cache
- **Modified:** `src/sonarcloud/uploader.js` — Upload deduplication via CE activity check
- **Modified:** `src/transfer-pipeline.js` — Full journal/lock/shutdown integration
- **Modified:** `src/migrate-pipeline.js` — Migration journal and conditional output-dir preservation
- **Modified:** `src/pipeline/project-migration.js` — Per-step checkpoints in migration journal
- **Modified:** `src/config/schema.js` — Added `transfer.checkpoint` config block
- **Modified:** `src/commands/transfer.js` — New CLI flags, shutdown coordinator
- **Modified:** `src/commands/migrate.js` — New CLI flags, shutdown coordinator
- **Modified:** `src/index.js` — Enhanced `status` and `reset` commands

---

### 2026-03-10 — User Mapping CSV for Issue Assignment

#### New Feature: User Mapping
- Added `user-mappings.csv` to the dry-run CSV workflow, enabling SonarQube-to-SonarCloud user login mapping
- During `--dry-run`, CloudVoyager now collects all unique issue assignees across all projects using lightweight facet queries and enriches them with display names and emails from the SonarQube user API
- Users can fill in the `SonarCloud Login` column to map SQ logins to SC logins, or set `Include=no` to skip assignment for specific users (e.g., service accounts)
- During the actual migration, the user mapping CSV is automatically loaded and applied to issue assignments

#### Issue Assignment Improvements
- Issue assignment now supports three modes per user: mapped (SQ login → SC login), excluded (skip assignment), or passthrough (original behavior)
- Added `assignmentMapped` and `assignmentSkipped` counters to issue sync statistics
- Failed assignment reports now include both the original SQ assignee and the target SC assignee when a mapping was used
- Updated Markdown, text, and PDF report formatters with a "Target Assignee" column in the failed assignments table

#### Files Added/Modified
- **New:** `src/sonarqube/extractors/users.js` — `extractUniqueAssignees()` (facet-based) and `enrichAssigneeDetails()` (user API)
- **Modified:** `src/mapping/csv-tables.js`, `csv-generator.js`, `csv-applier.js` — generate, read, and apply user mappings
- **Modified:** `src/migrate-pipeline.js` — collect assignees during dry-run, pass `userMappings` through `ctx`
- **Modified:** `src/pipeline/project-migration.js` — forward `userMappings` to `syncIssues()`
- **Modified:** `src/sonarcloud/migrators/issue-sync.js` — apply user mapping before assignment
- **Modified:** `src/reports/format-markdown.js`, `format-text.js`, `pdf-sections.js` — show mapped assignee in failure reports

#### Documentation
- Updated dry-run CSV reference with `user-mappings.csv` schema, examples, and edit scenarios
- Updated key capabilities, troubleshooting, changelog, and README

---

### 2026-03-09 — SonarQube 9.9 & 2025.1 Backward Compatibility

#### New: Version-Aware SonarQube Client
- Added `VersionAwareSonarQubeClient` subclass (`src/sonarqube/version-aware-client.js`) that auto-detects the SonarQube server version and adapts API calls accordingly
- All backward-compatibility logic is **isolated** in the subclass — the base `SonarQubeClient` and all API modules remain untouched
- Version is detected once on connection and cached for the lifetime of the client

#### Version-Aware Issue Fetching
- **SonarQube < 10.4**: Uses legacy `statuses` parameter with combined pre-10.4 and 10.4+ status values
- **SonarQube >= 10.4 / 2025.1**: Uses modern `issueStatuses` parameter, avoiding deprecation warnings and future breakage
- Falls back to legacy behavior when version is unknown (safe default)

#### Defensive API Wrappers
- `getGroups()` wrapped with try/catch for `/api/user_groups/search` endpoint being migrated to Web API V2

#### Version Utilities
- Added `isAtLeast(version, major, minor)` to `src/utils/version.js` for generic version comparisons
- Works with both old numbering (9.9, 10.4) and the new 2025.x year-based scheme

#### Pipeline Simplification
- `transfer-pipeline.js` and `pipeline/org-migration.js` now use the client's cached version instead of inline `getServerVersion()` + `parseSonarQubeVersion()` calls

#### Documentation
- Created `CONTRIBUTING.md` with comprehensive guide to all codebase patterns and conventions (extractor, API module, migrator, client, isolation, error handling, pagination, concurrency, testing)
- Updated `docs/backward-compatibility.md` with version-aware client architecture, issue status parameter differences, and expanded version support table
- Added SonarQube version compatibility section to `README.md` with support matrix
- Added `sonarqubeCompatibility` metadata and version keywords to `package.json`
- Updated documentation table in `README.md` with backward compatibility and contributing links

---

### 2026-03-04 — Issue Status History Verification

#### Enhancement: `verify` Command
- Added **status history (changelog) verification** to the issue metadata checker
- Fetches changelogs from both SonarQube and SonarCloud via `/api/issues/changelog`
- Extracts status transitions from each changelog and compares them in order
- Flags issues where SQ transitions are missing from SC as `statusHistoryMismatches`
- Issues with no status changes (never transitioned) are skipped
- Added `getIssueChangelog` to the SonarCloud API client
- Updated Markdown, PDF, and console reports to include status history mismatch details
- Updated verification documentation with new check description and pass/fail criteria

---

### 2026-02-28 — Migration Verification Command

#### New Feature: `verify` Command
- Added a `verify` command that exhaustively compares SonarQube and SonarCloud data to confirm migration completeness
- Performs read-only checks — no data is modified in either SonarQube or SonarCloud
- Reuses the existing migration config file (no new config schema needed)
- Supports the same `--only` component filtering as the `migrate` command

#### Verification Checks
- **Per-project:** Issue matching (status, assignments, comments, tags), hotspot matching (status, comments), branch parity, measures comparison, quality gate/profile assignments, project settings, tags, links, new code periods, DevOps bindings, project permissions
- **Org-wide:** Quality gates (existence + conditions), quality profiles (existence + rule counts), groups, global permissions, permission templates
- **Unsyncable detection:** Reports issue type changes, issue severity changes, and hotspot assignments as warnings (expected differences that cannot be synced via API)

#### Verification Reports
- Generates reports in 3 formats: **JSON**, **Markdown**, and **PDF** to the `--output-dir` directory (default: `./verification-output`)
- Console summary with per-project pass/fail breakdown and unsyncable warnings
- Markdown report includes collapsible detail sections for status, assignment, comment, and tag mismatches

#### npm Scripts
- Added `verify`, `verify:auto-tune`, and 8 selective `verify:only-*` npm scripts

#### Documentation
- Updated architecture, key capabilities, configuration, local development, scenario guides, troubleshooting, and README to document the verify command
- Updated hidden HTML timestamps across all modified files

---

### 2026-02-25 — Transfer-All Deprecation, Further Reading, Server-Wide Data Caching

#### Deprecated
- Removed `transfer-all` command, config schema, example config, scenario docs, and all references — replaced by the more capable `migrate` command
- Removed `examples/transfer-all-config.example.json` and `docs/scenario-transfer-all.md`

#### Documentation
- Added "Further Reading" sections with cross-links to all documentation files for easier navigation
- Fixed configuration reference to reflect two (not three) configuration formats
- Updated hidden HTML timestamps across modified documentation files

#### Server-Wide Data Caching
- Implemented server-wide data caching in the migration pipeline for improved extraction performance

---

### 2026-02-20 — Enterprise Portfolio API, Configuration Updates

#### Enterprise Portfolio API (V2)
- Migrated portfolio management to SonarCloud's V2 Enterprise API for creating and managing portfolios
- Added `src/sonarcloud/enterprise-client.js` for V2 API interactions

#### Configuration
- Added optional `sonarcloud.enterprise` configuration block in migrate config schema (`enterprise.key` required for portfolio migration)
- Added `bun` as a dev dependency for experimental build pipeline

#### Documentation
- Added section-level timestamps to all documentation files tracking when each feature was last updated
- Created `docs/CHANGELOG.md` as dedicated changelog file

---

### 2026-02-19 — Unit Tests, Local Dev Guide, Build Optimizations, and SEA Binary Fixes

#### Build Optimizations
- Updated esbuild target from Node 18 to Node 21 for modern syntax and fewer polyfill transforms
- Enabled minification and tree shaking in esbuild bundle for smaller binary size
- Enabled V8 code cache (`useCodeCache`) in SEA configuration for faster startup by pre-compiling JS to bytecode at build time

#### SEA Binary Fix
- Fixed `ensureHeapSize` respawn logic to correctly detect SEA binaries where `process.argv[0]` and `process.argv[1]` are duplicated, preventing extra argument passing to child processes

#### Refactored
- Simplified protobuf schema imports in encoder.js by removing redundant path resolution

#### New API Endpoints and Reporting
- Added new API endpoints and enhanced reporting features for migration workflows
- Enhanced documentation and reports for migration process, including new transfer scenarios and improved output paths

#### Testing
- Added unit tests for SonarQube models, state management, transfer pipeline, concurrency utilities, error handling, and logging

#### Documentation
- Added local development guide for building and running CloudVoyager from source with step-by-step instructions

---

### 2026-02-18 — Reporting, Quality Profile Diffs, and Stability Fixes

#### Migration Report Generation
- Added comprehensive migration report output in multiple formats: **PDF**, **JSON**, **Markdown**, and **plain text**
- Reports include executive summaries, per-project breakdowns, and performance timing analysis
- Enables stakeholders to review migration outcomes at a glance

#### Quality Profile Diff Reports
- Added side-by-side comparison of active rules per language between SonarQube and SonarCloud
- Identifies rule discrepancies after profile migration, so teams can verify policy parity before go-live

#### New Code Period Migration
- Migrates "new code" period definitions (used for quality gate evaluations) to SonarCloud via the settings API
- Supports all SonarQube new code period types with automatic mapping to SonarCloud equivalents

#### Auto-Tune Performance
- Added `--auto-tune` flag that detects available CPU cores and RAM to automatically configure concurrency and memory limits
- Replaces previously separate high-memory and fast migration scripts with a single unified option
- Automatic process respawn with increased heap size when memory limits are configured

#### CLI Enhancements
- Added `--wait` flag to block until SonarCloud finishes analyzing the uploaded report, useful for CI/CD pipelines
- Branch name is now resolved from SonarCloud (not SonarQube) to avoid mismatches in multi-branch setups

#### SonarCloud Integration Improvements
- Added project key availability check to detect naming conflicts before migration begins
- Improved duplicate report prevention via SCM revision tracking

#### Encoding and Architecture Improvements
- Simplified protobuf encoding pipeline by removing worker threads — encoding now runs in-process for greater reliability
- Protobuf schemas are inlined into the bundled binary, eliminating external file dependencies
- Improved quality gate migration with modular condition and permission handling
- Improved permission template migration with clearer error handling

#### Documentation Updates
- Expanded README with reverse-engineering approach explanation, Quick Start guide, and detailed download instructions
- Added Windows ARM64 to the list of supported binary platforms

#### Bug Fixes
- Fixed macOS version in CI/CD build matrix (updated from macOS 13 to macOS 15)
- Fixed incorrect file paths for organization mapping CSV and quality profile diff outputs in reports

---

### 2026-02-17 — Full Migration Pipeline, Metadata Sync, and Concurrency

#### Full Migration Pipeline (`migrate` command)
- **Issue metadata sync** — migrates issue statuses, assignments, comments, and tags from SonarQube to SonarCloud
- **Hotspot metadata sync** — migrates security hotspot statuses and review comments
- **Permissions migration** — transfers global permissions, project-level permissions, and permission templates
- **Portfolio migration** — recreates portfolios in SonarCloud while preserving project associations
- **Project settings migration** — migrates tags, links, DevOps bindings, and project-level configuration
- **Quality gates migration** — transfers gate definitions, conditions, project assignments, and access permissions
- **Quality profiles migration** — uses backup/restore to transfer profiles via XML; built-in profiles are migrated as custom copies with inheritance chains and permissions preserved
- Added 12 new data extractors covering DevOps bindings, groups, hotspots, new code periods, permissions, portfolios, project links, project settings, project tags, quality gates, quality profiles, and server info (plugins + webhooks)

#### Standalone Metadata Sync (`sync-metadata` command)
- Added a dedicated command for syncing issue and hotspot metadata independently of the main migration
- Designed to be safely retryable — can be re-run without duplicating data
- Generates detailed migration reports with per-organization and per-project summaries

#### Rate Limiting
- Added configurable rate limiting for SonarCloud API write requests with exponential backoff on 503/429 responses
- Prevents API throttling during large-scale migrations

#### Concurrency and Performance Tuning
- Introduced configurable per-operation concurrency limits (source extraction, hotspot extraction, issue sync, hotspot sync, project migration)
- Custom zero-dependency concurrency layer for parallel task execution with configurable limits
- Performance configuration can be passed to all migration and transfer functions

#### Documentation and Configuration
- Added comprehensive configuration documentation with examples for migration and bulk transfer scenarios
- Updated architecture documentation to reflect new migration pipeline components
- Added LICENSE file for open-source compliance
- Created scenario-based migration guides:
  - **Single project** — migrate one specific project
  - **Single organization** — migrate all projects to one SonarCloud organization
- Removed outdated usage guide (content consolidated into scenario documents)

---

### 2026-02-16 — Core Transfer Engine, CLI, Build System, and Initial Documentation

#### Data Extraction Engine
- Built the core extraction engine that pulls all relevant data from SonarQube via its REST API:
  - Project metadata, branches, and quality gate associations
  - Issues with full pagination support and incremental sync capability
  - Measures and metrics at both project and component level
  - Source code files with configurable extraction limits
  - SCM blame/changeset data for accurate authorship tracking
  - Active rules from quality profiles, filtered to languages in use
  - Symbol references and syntax highlighting data
- Supports incremental transfers — tracks previously synced data to avoid reprocessing on subsequent runs

#### CLI Interface
- Commander-based CLI with four core commands:
  - `transfer` — extract from SonarQube, build protobuf report, upload to SonarCloud
  - `validate` — validate configuration file before running
  - `status` — view current sync state and transfer history
  - `reset` — clear sync state to force a full re-transfer
- Supports `--verbose` flag for detailed debug output
- Tokens can be provided via environment variables (`SONARQUBE_TOKEN`, `SONARCLOUD_TOKEN`) to avoid storing secrets in config files

#### Protobuf Report Builder
- Transforms extracted SonarQube data into protobuf-encoded scanner reports matching SonarCloud's internal Compute Engine format
- Uses a flat component structure (no directory hierarchy) with line counts derived from source files
- Maintains component reference mapping to preserve relationships between files, issues, and measures

#### Configuration System
- JSON-based configuration with schema validation
- Supports SonarQube source settings, SonarCloud target settings, and transfer options (mode, batch size, state file)
- Environment variable overrides for sensitive tokens

#### State Management
- File-based state persistence tracks last sync timestamp, processed issues, completed branches, and sync history
- Enables incremental transfers — only new or changed data is processed on subsequent runs
- State is only updated after a successful upload, ensuring consistency

#### Build and Release
- Standalone binary packaging via esbuild with Node.js Single Executable Applications
- Pre-built binaries for **6 platforms**: macOS (ARM64, x64), Linux (ARM64, x64), Windows (x64, ARM64)
- Automated CI/CD via GitHub Actions for building, testing, and releasing multi-platform binaries
- Protobuf schemas bundled inline — no external file dependencies at runtime

#### Code Quality
- Refactored all imports to use the `node:` prefix convention
- Refactored data models from classes to factory functions for simplicity
- General codebase cleanup for readability and maintainability

#### Documentation
- Added initial documentation suite:
  - Architecture overview
  - Configuration reference
  - Technical details
  - Troubleshooting guide
- Updated README with download instructions and migration constraints
- Added compliance scan script for internal code quality checks

---

## 📚 Further Reading

- [Key Capabilities](key-capabilities.md) — comprehensive overview of engineering and capabilities
- [Architecture](architecture.md) — project structure, data flow, report format
- [Configuration Reference](configuration.md) — all config options, environment variables, npm scripts
- [Full Migration — Single Org](scenario-single-org.md) — step-by-step migration guide
- [Troubleshooting](troubleshooting.md) — common errors and how to fix them
