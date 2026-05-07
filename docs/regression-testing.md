# Regression Testing Protocol
<!-- updated: 2026-05-07 -->

A reusable protocol for verifying features and fixes against a live SonarQube → SonarCloud migration across **any project**. Designed to be given as a prompt to an AI coding agent (Claude Code, etc.) after implementation is complete.

---

## The Prompt
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

> After implementing the feature/fix, test it end-to-end on **SonarQube project(s)** to verify regression testing. Follow this protocol exactly:

> ### Phase 1 — Adversarial Code Review (before running anything)
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

> Re-read every changed file with fresh eyes. For each file, ask:

> 1. **Data flow**: Does the data survive serialization boundaries? (worker_threads structured clone, JSON.stringify round-trips, URL query parameter encoding, protobuf encoding)
> 2. **Error handling**: Are failures tracked or silently swallowed? Every `catch` block must either increment a stat, log, or re-throw — never empty.
> 3. **Race conditions**: Are shared counters mutated from concurrent async contexts? In single-threaded JS this is safe, but verify each case.
> 4. **API contract match**: Do HTTP calls use the exact method, endpoint, parameter names, and encoding that the original client uses? Compare line-by-line against the existing client implementation.
> 5. **Edge cases**: What happens with 0 items? 1 item? Exactly at the threshold? `null`/`undefined` fields? Empty arrays vs missing fields?
> 6. **Stat integrity**: Will `Object.assign(stats, mergedStats)` preserve fields set earlier (like `filtered`)? Will counters add up to the expected totals?

> Write down every concern. Then verify or disprove each one before proceeding.

> ### Phase 2 — Environment Assessment
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

> Before running the test, check the live state:

> 1. **List SonarQube projects**: `curl` the SQ API to list available projects, identify the target project(s) for regression testing.
> 2. **SonarQube**: Confirm the target project exists, count issues, sample 5 issues to check their fields (status, tags, comments, assignee, updateDate vs creationDate).
> 3. **SonarCloud**: Check if the SC project exists. If it has stale data from a prior run, delete it (`/api/projects/delete`). Verify auth tokens are valid (`/api/system/status`).
> 4. **Pre-filter viability**: Will enough issues pass the `hasManualChanges` pre-filter to trigger the code path under test? If not, create test conditions (bulk-tag issues, add comments, transition statuses via SQ API). Document what you created and how many.
> 5. **Clean slate**: Delete `migration-output/`, `.cloudvoyager-state.json*`, and the SC project(s). Every test run must start from zero.

> ### Phase 3 — Build and Execute
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

> 1. `npm run package` — must succeed. If it fails, fix before proceeding.
> 2. Create or verify the config file (`config.json` for `transfer`, `migrate-config.json` for `migrate`).
> 3. Run the command: `./dist/bin/cloudvoyager-macos-arm64 transfer -c config.json --verbose`
> 4. Monitor the output in real-time. Watch for:
>    - The feature's log lines (e.g., "Parallel issue sync: N pairs across M workers")
>    - Progress stalls (no output for >3 minutes — could indicate rate limiting or hangs)
>    - Error/warn lines
>    - The final summary stats line

> ### Phase 4 — Analyze Results
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

> When the command finishes (exit code 0 or non-zero):

> 1. **Parse the summary stats line.** For every counter:
>    - Does it match expectations? (e.g., if you tagged 700 issues, do ~700 show as tagged?)
>    - Are there unexpected zeros? (0 comments when you added 20 — investigate)
>    - Do the numbers add up? (matched = tagged + already-tagged + tag-failures)
> 2. **Check the target system.** Query the SC API directly:
>    - Count issues with `metadata-synchronized` tag vs total issues
>    - Spot-check 5 issues for correct tags, comments, source links, status, assignee
>    - Search for specific test data you created (e.g., `tags=test-parallel-sync`)
> 3. **Check for silent failures.** If any counter is lower than expected:
>    - Check `api-errors` count (if tracked)
>    - Check the error log: `migration-output/logs/*/cloudvoyager-transfer.error.log`
>    - Check the warn log for rate limiting or timeout messages

> ### Phase 5 — Investigate Anomalies
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

> For every unexpected result, trace the full code path:

> 1. **Start from the data source.** Query the SQ API with the exact same parameters the code uses. Verify the field you expect (e.g., `comments`) is present in the response.
> 2. **Check serialization.** If data crosses a boundary (worker_threads, JSON), write a minimal reproduction: create a Worker, pass the data via workerData, verify it arrives intact.
> 3. **Check the API call.** Make the exact same HTTP request manually with `curl`. Does it succeed? What status code? What response body?
> 4. **Check the matching.** If an issue wasn't synced, verify it was matched: same rule + file + line on both SQ and SC.
> 5. **Identify the root cause.** Don't guess — prove. "The comments field was empty because..." with evidence.

> ### Phase 6 — Fix and Re-test
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

> If any issue was found:

> 1. **Fix the code.** Apply the minimal change that addresses the root cause.
> 2. **Verify syntax**: `node --check <file>` on every changed file.
> 3. **Rebuild**: `npm run package`
> 4. **Clean slate**: Delete SC project, delete `migration-output/`, delete state files.
> 5. **Re-run**: Full transfer from scratch. Do NOT assume a partial re-run is sufficient.
> 6. **Re-analyze**: Repeat Phase 4 and Phase 5. The fix may have introduced new issues.

> **Repeat Phase 6 until every stat matches expectations and spot-checks pass.**

> ### Phase 7 — Declare Clean Pass
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

> A clean pass requires ALL of:

> - [ ] Exit code 0 (no crashes)
> - [ ] 0 `failed` in the summary stats
> - [ ] All expected counters are non-zero and within tolerance (>95% of matched pairs for tags/source-links/metadata-sync)
> - [ ] `api-errors` is <5% of total operations (rate limiting is acceptable; silent data loss is not)
> - [ ] Spot-check of 5+ SC issues confirms correct tags, comments, source links
> - [ ] No unexpected warnings in the warn log
> - [ ] If the feature has a fallback path (e.g., <500 pairs uses mapConcurrent), verify the fallback still works by testing with a small project

---

## Reference: Regression Testing Projects
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

For regression testing, use any SonarQube project. Below are common options:

### Large Project (Angular Framework)

| Property | Value |
|----------|-------|
| SQ project key | `angular-framework` |
| SQ URL | `http://localhost:8998` |
| SC org | `open-digital-society` |
| SC URL | `https://sc-staging.io` |
| SQ issues | ~38,400 |
| SC issues (after transfer) | ~31,600 |
| Hotspots | ~409 |

### Small Project (for fallback verification)

| Property | Value |
|----------|-------|
| SQ project key | (any small project with <500 issues) |
| SQ URL | `http://localhost:8998` |
| SC org | `open-digital-society` |
| SC URL | `https://sc-staging.io` |

### Selecting a Project for Regression Testing

When regression testing an issue, select the project that best reproduces the problem:

1. **Issue involves specific issue states/statuses**: Use a project with diverse issue statuses
2. **Issue involves manual changes**: Use a project with `hasManualChanges` issues, or create them via API
3. **Issue involves comments/tags/assignees**: Use a project where these fields are populated
4. **Issue involves hotspots**: Use a project with known hotspots (like Angular Framework with ~409)
5. **Issue involves file matching**: Use a project where SQ and SC have overlapping file paths

### Listing Available Projects on SonarQube

```bash
# List all projects on SonarQube
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/projects/search" | jq '.components[] | {key: .key, name: .name}'

# Count total issues for a project
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/issues/search?projectKeys=${PROJECT_KEY}&ps=1" | jq '.total'

# Sample issues to check field distribution
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/issues/search?projectKeys=${PROJECT_KEY}&ps=5" | jq '.issues[] | {key: .key, status: .status, tags: .tags, hasComments: .hasComments}'
```

---

## Reference: Config Files

| Config (transfer) | `config.json` |
|-------------------|---------------|
| Config (migrate) | `migrate-config.json` |
| Delete SC projects script | `.debugging/delete-all-sonarcloud-projects.sh` |
| Test migration script | `.debugging/test-migrate.sh` |

---

## Creating Test Data on SonarQube
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

To trigger code paths that require manual changes (pre-filter keeps only issues with human-authored changes):

```bash
# Bulk-tag issues (creates updateDate != creationDate)
python3 -c "
import urllib.request, urllib.parse, json, base64, concurrent.futures, sys

TOKEN = 'squ_...'
PROJECT_KEY = sys.argv[1] if len(sys.argv) > 1 else 'angular-framework'
auth = base64.b64encode(f'{TOKEN}:'.encode()).decode()
headers = {'Authorization': f'Basic {auth}', 'Content-Type': 'application/x-www-form-urlencoded'}

# Fetch issue keys
url = f'http://localhost:8998/api/issues/search?projectKeys={PROJECT_KEY}&ps=500'
req = urllib.request.Request(url, headers=headers)
keys = [i['key'] for i in json.load(urllib.request.urlopen(req))['issues']]

# Tag them
def tag(key):
    params = urllib.parse.urlencode({'issue': key, 'tags': 'test-tag'}).encode()
    req = urllib.request.Request('http://localhost:8998/api/issues/set_tags', data=params, headers=headers, method='POST')
    urllib.request.urlopen(req)
    return 'ok'

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
    results = list(pool.map(tag, keys))
print(f'Tagged: {sum(1 for r in results if r == \"ok\")}/{len(keys)}')
" ${PROJECT_KEY}
```

Adapt similarly for `do_transition` (confirm/reopen), `add_comment`, and `assign`.

---

## Example: Parallel Issue Sync Test (2026-04-28)
<!-- <subsection-updated last-updated="2026-05-07T02:15:00Z" updated-by="Claude" /> -->

Applied this protocol to verify `worker_threads`-based parallel issue sync.

**Phase 1 findings:** No critical bugs in logic. Identified that `Object.assign(stats, mergedStats)` preserves `stats.filtered` because `mergedStats` doesn't have that field. Confirmed `workerData` structured clone handles nested objects with arrays.

**Phase 2 setup:** SQ had 38,412 issues with 0 manual changes. Created 700 tagged + 32 confirmed + 20 commented issues via SQ API. Verified pre-filter would pass ~5,000+ issues (above 500 threshold).

**Phase 3 (run 1):** Transfer completed but showed 0 comments synced, only 7,293/31,641 tagged. Investigation revealed empty `catch` blocks silently swallowed API errors — SC staging rate-limited 100 concurrent requests.

**Phase 4 fix:** Increased retries from 3→6, added jitter on backoff, added 5xx/transient retry, added `apiErrors` counter to all catch blocks.

**Phase 5 (run 2):** Clean pass. 5,119 matched, 5,067 tagged (99%), 5,109 metadata-sync-tagged (99.8%), 5,095 source-linked (99.5%), 34 api-errors (0.7%), 0 failed. Spot-checked SC issues — all correct.

**Iterations:** 2 (first run exposed silent failures, fix applied, second run clean).
