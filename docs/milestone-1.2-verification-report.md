# Milestone 1.2 — Verification Report

**Branch:** `contributors/joshuaquek`
**Date:** 2026-03-26
**Reference:** [Open Issues — Milestone 1.2](https://github.com/sonar-solutions/cloudvoyager/issues?q=is%3Aissue%20state%3Aopen%20milestone%3A1.2)

---

## Summary

| Issue | Title | Status |
|-------|-------|--------|
| [#53](https://github.com/sonar-solutions/cloudvoyager/issues/53) | CloudVoyager can't handle projects with more than 10K issues | RESOLVED |
| [#56](https://github.com/sonar-solutions/cloudvoyager/issues/56) | Third party issues not consistently migrated | RESOLVED |
| [#66](https://github.com/sonar-solutions/cloudvoyager/issues/66) | Add SonarCloud public scanning | RESOLVED |
| [#75](https://github.com/sonar-solutions/cloudvoyager/issues/75) | Modify GitHub workflow YAML to reference milestones | RESOLVED |

---

## Issue #53 — 10K+ Issues Search Slicing

**Problem:** SonarQube's `/api/issues/search` endpoint has a hard 10,000-result limit. Projects exceeding this silently lost data during migration.

**Solution:** Implemented a date-window search-slicing algorithm that automatically activates when results hit the 10K limit.

### Files Created

| File | Purpose |
|------|---------|
| `src/shared/utils/search-slicer/index.js` | Entry point — `fetchWithSlicing()` probes total, delegates to slicing if >= 10K |
| `src/shared/utils/search-slicer/helpers/slice-by-creation-date.js` | Builds 12 date windows, fetches each, deduplicates |
| `src/shared/utils/search-slicer/helpers/find-date-range.js` | Probes oldest/newest creation dates via `CREATION_DATE` sort |
| `src/shared/utils/search-slicer/helpers/fetch-window.js` | Fetches a date window; recursively bisects if still >= 10K |
| `src/shared/utils/search-slicer/helpers/deduplicate-results.js` | Removes duplicates by `key` or `id` at window boundaries |
| `src/pipelines/sq-9.9/sonarqube/api-client/helpers/probe-total.js` | Lightweight `ps=1` probe to get total count |
| `src/pipelines/sq-10.0/sonarqube/api-client/helpers/probe-total.js` | (identical) |
| `src/pipelines/sq-10.4/sonarqube/api-client/helpers/probe-total.js` | (identical) |
| `src/pipelines/sq-2025/sonarqube/api-client/helpers/probe-total.js` | (identical) |

### Files Modified

| File | Change |
|------|--------|
| `src/pipelines/sq-{9.9,10.0,10.4,2025}/sonarqube/api-client/helpers/bind-delegate-methods.js` (or equivalent) | Added `probeTotal` import and `probeFn` wrapper; pass as first arg to `getIssues`, `getIssuesWithComments`, `getHotspots` |
| `src/pipelines/sq-{9.9,10.0,10.4,2025}/sonarqube/api/issues-hotspots.js` | Added `fetchWithSlicing` import; updated all 3 function signatures to accept `probeTotal`; replaced `getPaginated()` calls with `fetchWithSlicing()` |
| `src/pipelines/sq-2025/sonarqube/api-client/helpers/issue-methods.js` | Additional delegation file unique to sq-2025; also wired with `fetchWithSlicing` |

### Verification

| Check | Result |
|-------|--------|
| Search slicer utility complete (5 files) | PASS |
| `probe-total.js` exists in all 4 pipelines | PASS |
| `fetchWithSlicing` wired into `getIssues` in all 4 pipelines | PASS |
| `fetchWithSlicing` wired into `getIssuesWithComments` in all 4 pipelines | PASS |
| `fetchWithSlicing` wired into `getHotspots` in all 4 pipelines | PASS |
| `probeTotal` delegated through api-client in all 4 pipelines | PASS |
| End-to-end flow: extractor → delegation → slicer → date windows → bisection → dedup | PASS |

---

## Issue #56 — Third-Party Issue Migration Bug

**Problem:** When `getRuleRepositories()` failed to fetch the SonarCloud rules API, it returned an empty Set. This caused `isExternalIssue()` to return `false` for ALL issues, silently dropping third-party analyzer issues (ruff, pylint, Trivy, etc.) during migration.

**Solution:** Added a fallback set of 43 known SonarCloud rule repositories, retry logic with exponential backoff on `getRuleRepositories()`, and edge-case guards in `isExternalIssue()`.

### Files Created

| File | Purpose |
|------|---------|
| `src/shared/utils/fallback-repos/index.js` | Exports `FALLBACK_SONARCLOUD_REPOS` — Set of 43 known built-in SonarCloud rule repository keys |

### Files Modified

| File | Change |
|------|--------|
| `src/pipelines/sq-{9.9,10.0,10.4,2025}/protobuf/build-external-issues/helpers/is-external-issue.js` | Added `FALLBACK_SONARCLOUD_REPOS` import; added no-colon guard; uses fallback when `sonarCloudRepos` is empty; added empty-repo guard |
| `src/pipelines/sq-9.9/.../build-external-issues-core.js` | Removed early-return when repos empty; replaced with warning log |
| `src/pipelines/sq-10.0/.../build-external-issues/index.js` | (same change) |
| `src/pipelines/sq-10.4/.../build-external-issues/helpers/build-external-issues.js` | (same change) |
| `src/pipelines/sq-2025/.../build-external-issues-core.js` | (same change) |
| `src/pipelines/sq-9.9/.../query-methods-extended.js` | Added retry (3 attempts, exponential backoff) + fallback to `FALLBACK_SONARCLOUD_REPOS` |
| `src/pipelines/sq-10.0/.../permission-query-methods.js` | (same change) |
| `src/pipelines/sq-10.4/.../extended-query-methods.js` | (same change, object-method style) |
| `src/pipelines/sq-2025/.../query-methods-4.js` | (same change) |

### Verification

| Check | Result |
|-------|--------|
| Fallback repos file exports Set with 43 known repos | PASS |
| `isExternalIssue()` imports `FALLBACK_SONARCLOUD_REPOS` — all 4 pipelines | PASS |
| `isExternalIssue()` has no-colon guard — all 4 pipelines | PASS |
| `isExternalIssue()` uses fallback when repos empty — all 4 pipelines | PASS |
| `isExternalIssue()` has empty-repo guard — all 4 pipelines | PASS |
| `buildExternalIssues()` early-return removed — all 4 pipelines | PASS |
| `getRuleRepositories()` has 3-retry loop — all 4 pipelines | PASS |
| `getRuleRepositories()` has exponential backoff (1s, 2s, 3s) — all 4 pipelines | PASS |
| `getRuleRepositories()` falls back to `FALLBACK_SONARCLOUD_REPOS` — all 4 pipelines | PASS |

---

## Issue #66 — SonarCloud Public Scanning

**Problem:** No automated SAST, unit test coverage, or SCA scanning was configured for the repository.

**Solution:** Added a standalone GitHub Actions workflow that runs SonarCloud analysis on every push to `main` and on pull requests.

### Files Created

| File | Purpose |
|------|---------|
| `.github/workflows/sonarcloud.yml` | Fully automatic SonarCloud scanning workflow |
| `sonar-project.properties` | SonarCloud project configuration |

### Verification

| Check | Result |
|-------|--------|
| `sonarcloud.yml` exists | PASS |
| Triggers on push to `main` | PASS |
| Triggers on pull_request to `main` | PASS |
| Does NOT have `workflow_dispatch` (fully automatic) | PASS |
| Checks out code with `fetch-depth: 0` | PASS |
| Sets up Node.js 20 | PASS |
| Restores `node_modules` from cache | PASS |
| Runs `npm test` for coverage | PASS |
| Uses `SonarSource/sonarqube-scan-action@v5` | PASS |
| Uses `SONAR_TOKEN` secret | PASS |
| Does NOT use `actions/upload-artifact` or `actions/download-artifact` | PASS |
| `sonar-project.properties` has correct project key and org | PASS |
| `sonar-project.properties` has correct source/test paths | PASS |
| `sonar-project.properties` has coverage report path (`coverage/lcov.info`) | PASS |
| `sonar-project.properties` has appropriate exclusions | PASS |

### Note

Requires the `SONAR_TOKEN` secret to be configured in the GitHub repository settings before the workflow will succeed.

---

## Issue #75 — Release Milestone References

**Problem:** GitHub Releases did not reference the milestone (1.2, 1.3, etc.), making it hard to associate a release with its planned scope.

**Solution:** Modified the `gh-release.yml` workflow to extract the version from `package.json`, derive the milestone, and include it in the release description with a clickable link.

### Files Modified

| File | Change |
|------|--------|
| `.github/workflows/gh-release.yml` | Added checkout step, milestone extraction step, and `body:` parameter with milestone link |

### Verification

| Check | Result |
|-------|--------|
| Checkout step (`actions/checkout@v4`) added | PASS |
| Milestone extraction reads version from `package.json` | PASS |
| Milestone derived as `major.minor` (e.g., `1.2` from `1.2.0`) | PASS |
| Both `version` and `milestone` output to `$GITHUB_OUTPUT` | PASS |
| Release body includes milestone number | PASS |
| Release body includes clickable link to GitHub milestone page | PASS |
| Release body includes full version string | PASS |
| `generate_release_notes: true` preserved (auto-generated notes append after body) | PASS |

---

## Overall Result

**All 4 milestone 1.2 issues are fully resolved.**

| Issue | Checks | Passed | Failed |
|-------|--------|--------|--------|
| #53 — 10K+ Search Slicing | 7 | 7 | 0 |
| #56 — Third-Party Issue Fix | 9 | 9 | 0 |
| #66 — SonarCloud Scanning | 15 | 15 | 0 |
| #75 — Release Milestones | 8 | 8 | 0 |
| **Total** | **39** | **39** | **0** |
