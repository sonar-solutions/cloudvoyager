# Design Review: Matrix-Based Regression Testing for All Fixed Issues
<!-- updated: 2026-04-25_10:00:00 -->

> **Implementation Status: SHIPPED (Phase 1)** — PR [#127](https://github.com/sonar-solutions/cloudvoyager/pull/127). 22 files, 1,309 lines. 5 scenarios x 4 SQ versions. Sensitive CI moved to private repo `sonar-solutions/cloudvoyager-ci`.

**Document reviewed:** `joshua.quek-main-design-20260422-184500.md`
**Review date:** 2026-04-22
**Review pass:** 2nd (post-fix of 13 issues from 1st review)
**Quality score:** 7/10

## Summary
<!-- updated: 2026-04-22_19:00:00 -->

9 issues found across 4 of 5 dimensions. No blockers, but fixes needed before implementation to prevent surprises. Scope dimension passed cleanly.

## Issues by Dimension
<!-- updated: 2026-04-22_19:00:00 -->

### Completeness (3 issues)

| ID | Issue | Suggested Fix |
|----|-------|---------------|
| 1.1 | No matrix entry exercises the standalone `transfer` command | Add `transfer-single-project` matrix entry |
| 1.2 | `malformed-project-data` has no defined expected behavior for "graceful handling" | Specify per-case: skip with warning, fail with error class, or partial success |
| 1.3 | `issue-sync-first-migration` assertion is unmeasurable ("triggers correctly") | Define as: SQC API returns >0 issues within N seconds post-sync |

### Consistency (2 issues)

| ID | Issue | Suggested Fix |
|----|-------|---------------|
| 2.1 | Matrix table has 18 entries but success criteria says 16 | Update success criteria to 18 |
| 2.2 | Trigger is push-to-main only, but success criteria claims pre-merge PR gating | Either add PR trigger or reword to "post-merge detection" |

### Clarity (2 issues)

| ID | Issue | Suggested Fix |
|----|-------|---------------|
| 3.1 | `kill-and-continue` uses `timeout 60s` but claims "after first project completes" -- these are different conditions | Specify actual mechanism (log-line monitor or accept timeout as proxy) |
| 3.2 | Cleanup "deletes and recreates" doesn't specify API calls or whether recreation is implicit | Clarify: DELETE endpoint + implicit recreation via scanner report upload |

### Scope

PASS -- no YAGNI violations.

### Feasibility (2 issues)

| ID | Issue | Suggested Fix |
|----|-------|---------------|
| 5.1 | `cv-test-malformed` requires Unicode keys and empty names that SonarQube API rejects | Specify DB-level seeding or descope to API-achievable scenarios only |
| 5.2 | `max-parallel: 8` may still exceed SQC rate limits with no cross-job throttling | Lower to 4, add staggered startup delays, or use separate SQC orgs |
