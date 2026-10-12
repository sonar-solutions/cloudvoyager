# Issue #90 — Improve Sync Algorithm

## Goal

Improve the parallelization efficiency of the SonarQube → SonarCloud issue metadata sync. Eliminate logic errors and algorithmic inefficiencies that waste API calls, cause silent data loss, or corrupt progress tracking.

---

## Bugs to Fix

### 🔴 Bug 1 — Race Condition in `mapConcurrent` (Critical)

**File:** `src/shared/utils/concurrency/helpers/map-concurrent.js`

**Problem:** `nextIndex++` is a read-then-increment. If a worker yields at the `await fn(...)` before the increment is committed to memory, another worker reads the same index and both process the same item — while another item is permanently skipped.

```javascript
// BROKEN — race between read of nextIndex and write
const index = nextIndex++;
```

**Fix:** Use an atomic fetch-and-increment via `Atomics` on a `SharedArrayBuffer`, or a locked queue approach:

```javascript
// Option A: Atomics (no shared state needed beyond the counter)
const index = Atomics.add(sab, 0, 1) - 1;
if (index >= items.length) break;

// Option B: Simple mutex lock (more portable)
const mutex = new Int32Array(sab);
while (true) {
  const old = Atomics.load(mutex, 0);
  if (old >= items.length) break;
  if (Atomics.compareExchange(mutex, 0, old, old + 1) === old) {
    // we won the slot
    const index = old;
    ...
  }
}
```

**Verification:** Unit test with a delay in `fn` that causes yielding — assert no index is processed twice and all indices 0..n-1 are covered exactly once.

---

### 🔴 Bug 2 — Out-of-Order Progress in Worker Threads (Critical)

**File:** `src/shared/utils/concurrency/helpers/parallel-issue-sync.js:216`

**Problem:** Workers report `completed` counts from their own local counter (0→50→100...). Messages can arrive out of order. If B's `50` arrives after A's `60`, the delta `50 - 60 = −10` causes `totalCompleted` to decrease mid-sync.

```javascript
// BROKEN — _lastReported is per-worker, but message ordering is not guaranteed
totalCompleted += msg.completed - (worker._lastReported || 0);
worker._lastReported = msg.completed;
```

**Fix:** Each worker should report `completed` as a running total from its own perspective, and main thread tracks the delta correctly. Use `worker._lastReported` which already exists, but ensure delta is always positive:

```javascript
const delta = msg.completed - (worker._lastReported || 0);
if (delta > 0) totalCompleted += delta;
worker._lastReported = msg.completed;
```

Or better: workers report `completed` as a delta since last message (e.g., always `50` for the progress message), and main thread accumulates:

```javascript
totalCompleted += msg.completed; // msg.completed is a delta (50 per progress tick)
```

Change worker to always report the increment amount, not the running total.

---

### 🟡 Bug 3 — Worker Path Skips Changelog Replay (Medium)

**File:** `src/shared/utils/concurrency/helpers/parallel-issue-sync.js`

**Problem:** The `parallelSyncIssues` worker thread path (triggered at 500+ matched pairs) uses `getFallbackTransition` — a single transition from current SQ status. The regular `syncIssues` path uses `extractTransitionsFromChangelog` + `mapChangelogDiffToTransition` to replay the full ordered changelog. Large projects get less accurate transitions.

**Fix:** Pass the `changelogMap` (already computed in `applyManualChangesPreFilter`) to `parallelSyncIssues` and use it to drive ordered changelog replay instead of single fallback transition. The worker code string needs to be updated to accept and use `changelogMap`.

**Note:** Requires threading `changelogMap` through `syncIssues` → `parallelSyncIssues` → worker. The `workerData` object in `new Worker(...)` call can carry the serialized `changelogMap`.

---

### 🟡 Bug 4 — Unbounded Changelog Prefetch Before Filter (Medium)

**File:** `src/shared/utils/issue-sync/apply-pre-filter.js:17`

**Problem:** `fetchSqChangelogs` makes API calls for **all** SQ issues before `hasManualChanges` pre-filter is applied. For a project with 10,000 auto-generated issues, all 10,000 changelog API calls are made only to filter down to 100 with manual changes.

**Fix:** Implement a **filter-then-fetch** strategy:
1. First pass: filter SQ issues by cheap fields (`updateDate !== creationDate` or `hasAssignee` or `hasCustomTags`)
2. Only for issues passing the cheap filter, batch-fetch changelogs
3. Apply `hasHumanChangelog` filter on fetched changelogs

```javascript
// Phase 1: cheap pre-filter (no API calls)
const cheapFiltered = sqIssues.filter(i =>
  wasUpdatedAfterCreation(i) || hasAssignee(i) || hasCustomTags(i)
);

// Phase 2: changelog fetch only for candidates
const changelogMap = await fetchSqChangelogs(cheapFiltered, sqClient, concurrency);

// Phase 3: full filter with changelog data
const issuesToSync = cheapFiltered.filter(issue =>
  hasManualChanges(issue, changelogMap.get(issue.key) ?? [])
);
```

This dramatically reduces changelog API calls for projects with many auto-generated issues.

---

### 🟡 Bug 5 — One-to-One Match Silently Drops Duplicates (Medium)

**File:** `src/pipelines/sq-2025/sonarcloud/migrators/issue-sync/helpers/match-issues.js:23`

**Problem:** If two SQ issues share the same `ruleKey|filePath|line` key, only the first is matched. The second is silently dropped with no warning.

```javascript
const scIssue = candidates.shift(); // second SQ issue with same key → lost
```

**Fix:** If `candidates.length > 1`, log a warning and match the additional SQ issues to the same SC issue (one SC issue can receive updates from multiple SQ issues if they share a key, which is valid for multi-line code blocks or rules that fire per-element).

If that behavior is not desired, log an **error** and record the dropped issues in stats.

---

### 🟡 Bug 6 — Date String Equality Check (Low)

**File:** `src/shared/utils/issue-sync/has-manual-changes.js:49`

**Problem:** `issue.updateDate !== issue.creationDate` does string comparison. Dates may be in different formats (ISO with/without timezone, Unix timestamps). Also, issues created and modified in the same second are incorrectly excluded.

```javascript
return issue.updateDate !== issue.creationDate;
```

**Fix:** Parse dates to a common numeric form (Unix ms) before comparison:

```javascript
function wasUpdatedAfterCreation(issue) {
  if (!issue.updateDate || !issue.creationDate) return false;
  const created = new Date(issue.updateDate).getTime();
  const updated = new Date(issue.creationDate).getTime();
  if (isNaN(created) || isNaN(updated)) return false; // fallback: be conservative
  return updated > created;
}
```

---

## Bonus Optimization — Collapse Comment API Calls

**Problem:** Each issue makes up to 2 separate `add_comment` calls (SQ comments + source link).

**Fix:** Merge the SQ comments and source link into a single `add_comment` call per issue, reducing calls from 5→4 per issue.

```javascript
// Before: two separate calls
await client.addComment(scIssue.key, sqCommentText);
await client.addComment(scIssue.key, sourceLinkText);

// After: one combined call
const combinedText = sqCommentsText + '\n\n---\n' + sourceLinkText;
await client.addComment(scIssue.key, combinedText);
```

Apply to both `syncOneIssue` (mapConcurrent path) and the worker thread `WORKER_CODE` string.

---

## Feature — Multi-Token SC API Pooling

**Status:** ✅ Implemented

**Goal:** Allow users to provide multiple SonarCloud API tokens to distribute API request load across N tokens, increasing effective concurrency and providing more headroom against SC rate limits.

### How It Works

SonarCloud's rate limit scope is undocumented — it may be per-token, per-IP, or per-organization. Providing multiple tokens acts as a hedge: if limits are per-token, N tokens give N× the request budget. Even if limits are per-organization, multiple tokens still help by distributing burst load.

### Config Schema

Organizations can now specify `tokens` (array) in addition to `token` (singular):

```json
{
  "organizations": [
    {
      "key": "my-org",
      "tokens": ["token_1", "token_2", "token_3"],
      "url": "https://sonarcloud.io"
    }
  ]
}
```

If both `token` and `tokens` are provided, `tokens` takes precedence.

### Environment Variable Support

```bash
# JSON array format
export SONARCLOUD_TOKENS='["token_1","token_2","token_3"]'

# or comma-separated
export SONARCLOUD_TOKENS='token_1,token_2,token_3'

# single token still works
export SONARCLOUD_TOKEN='my_single_token'
```

### Files Changed

| File | Change |
|------|--------|
| `src/shared/utils/token-pool/index.js` | **NEW** — `TokenPool` class for round-robin token distribution |
| `src/shared/config/schema-migrate/helpers/migrate-sonarcloud-schema.js` | Added `tokens: string[]` to org schema |
| `src/pipelines/sq-2025/sonarcloud/api-client/helpers/create-axios-client/index.js` | Token rotation interceptor — random selection per request |
| `src/pipelines/sq-2025/sonarcloud/api-client/helpers/create-sonarcloud-client.js` | Accepts `tokens` or `token`, exposes `.tokens` on client |
| `src/shared/config/loader/helpers/apply-environment-overrides.js` | Added `SONARCLOUD_TOKENS` env var support with JSON/CSV parsing |
| `src/pipelines/sq-2025/pipeline/project-migration/helpers/migrate-one-project-core/index.js` | Passes `org.tokens` to `SonarCloudClient` |
| `src/pipelines/sq-2025/pipeline/project-core-migrator/helpers/migrate-one-project-core.js` | Passes `org.tokens` to `SonarCloudClient` |
| `src/pipelines/sq-2025/pipeline/org-migration/helpers/migrate-one-org-core/index.js` | Passes `org.tokens` to `SonarCloudClient` |
| `src/shared/verification/verify-pipeline/helpers/verify-single-project.js` | Passes `org.tokens` to `SonarCloudClient` (2 sites) |
| `src/shared/verification/verify-pipeline/helpers/verify-organization.js` | Passes `org.tokens` to `SonarCloudClient` |

### Token Rotation Strategy

Random selection per request (not round-robin) — chosen to minimize the risk of two consecutive requests hitting the same token and triggering a burst limit. With N tokens and random selection, the probability of hitting the same token twice in a row is `1/N`.

### Limitations

- **SonarCloud rate limit scope is undocumented** — multi-token helps if limit is per-token or per-IP; it may not help if limit is per-organization
- **Retry logic** (in `attach-retry-interceptor`) operates per-request, so retries for 429s will also rotate tokens
- The `parallelSyncIssues` worker thread path (500+ issues) uses inline `https`/`http` with its own hardcoded token rotation logic — not yet updated to use the pool

---

## Implementation Order

1. **Bug 4** (filter-then-fetch) — reduces API call volume immediately with no algorithmic risk
2. **Bug 6** (date parsing) — simple, isolated fix
3. **Bug 5** (duplicate match warning) — simple, isolated fix
4. **Bug 1** (mapConcurrent race) — critical, needs unit test
5. **Bug 2** (progress ordering) — critical, isolated fix
6. **Bug 3** (changelog replay in workers) — moderate complexity, touches worker code string
7. **Bonus** (collapse comment calls) — nice-to-have optimization
8. **Multi-token** (worker thread path) — update `parallelSyncIssues` to also rotate tokens across its worker threads
