# Regression Testing Protocol
<!-- updated: 2026-05-07 -->

A reusable protocol for verifying bug fixes and features against a live SonarQube Server → SonarQube Cloud migration. This protocol is **issue-driven** — you MUST fully understand the GitHub issue before designing any test, and your test plan must be explicitly derived from the issue's symptoms, root cause, and fix.

---

## The Prompt
<!-- <subsection-updated last-updated="2026-05-07T14:00:00Z" updated-by="Claude" /> -->

> After implementing the feature/fix, test it end-to-end to verify regression testing. Follow this protocol exactly. **Do not skip, shortcut, or merge any phase.**

---

## Phase 0 — Fully Understand the Issue (Prerequisite — Do This First)

> **This phase is MANDATORY. Do not proceed to Phase 1 until you can answer every question below in your own words.**

Before writing a single line of test code or running any command, you MUST have a complete mental model of:

### 0.1 — Issue Anatomy
For the GitHub issue you are regression testing, you must be able to answer ALL of:

1. **What is broken?** — The exact symptom. Not vague language — the precise observed behavior (e.g., "SC hotspot review % is 90.3% when SQS shows 100%", not "hotspots are wrong").
2. **What is the expected behavior?** — The correct state after a successful migration.
3. **What is the root cause?** — Why does the bug exist in the code? Which function, which line, which condition, which API response field?
4. **What does the fix actually change?** — Read every line of the diff. Understand which code path is added, removed, or modified. Does it change an API call, a field mapping, a condition, a retry loop?
5. **What systems are affected?** — SQ only, SC only, or both? Does the bug affect the migration output, the SC project after migration, or the SQ source?
6. **What is the blast radius?** — Could the fix break other issue types (regular issues vs hotspots vs vulnerability stats)? Could it affect other migrations (e.g., external issues)?
7. **What evidence would prove the fix works?** — List 3-5 concrete assertions (e.g., "hotspot review % on SC must equal hotspot review % on SQS within 0.5%").

### 0.2 — Derive the Regression Test Plan

From the issue understanding in 0.1, write a **specific regression test plan** BEFORE touching any code. This plan must include:

- **Which SonarQube Server project to use** — pick the project that best reproduces the issue (e.g., Angular Framework for hotspots because it has ~409 hotspots)
- **What test data to create** — do you need to bulk-tag issues, add comments, transition statuses to trigger the pre-filter? How many?
- **What to verify after migration** — specific API queries, specific counts, specific spot-checks
- **What the pass criteria are** — concrete numbers, not vague "looks right"

**Write this plan down explicitly.** If you cannot write a specific, concrete regression test plan from the issue description, you do NOT fully understand the issue — go back to Phase 0.1 and re-read.

### 0.3 — Identify Related Code Paths

Find ALL code paths that touch the same data or API calls as the fix:

1. Run `grep` for the function name(s) involved in the fix
2. Run `grep` for the API endpoint(s) involved
3. Check if the same field/mapping is used elsewhere (e.g., if `securityHotspot` status mapping is fixed, check if `issue` status mapping uses the same code)
4. Check if there are similar patterns nearby that might have the same bug but weren't fixed

> Write down every related file and code path. These are your **regression watchlist**.

---

## Phase 1 — Adversarial Code Review (before running anything)
<!-- <subsection-updated last-updated="2026-05-07T14:00:00Z" updated-by="Claude" /> -->

> Re-read every changed file and every file on your regression watchlist with fresh eyes. For each file, ask:

### Data Integrity
1. **Data flow**: Does the data survive every serialization boundary? List each boundary:
   - Worker thread: `workerData` structured clone — does nested data with arrays survive?
   - JSON: `JSON.stringify` / `JSON.parse` round-trip — does `undefined`, `NaN`, `Infinity`, `Set`, `Map`, circular refs survive?
   - URL encoding: query params, form data — are special characters encoded correctly?
   - API response parsing: does the code handle the actual response schema from the real API, or a cached/stale schema?
2. **Field mapping fidelity**: Is every field from the source (SQ API response) correctly mapped to the destination (SC API request)? Check: field name, field type, null/undefined handling, array vs scalar.
3. **Stat integrity**: Will `Object.assign(stats, mergedStats)` preserve fields set earlier (like `filtered`)? Will counters add up to the expected totals? Trace the full stat lifecycle from worker to final output.

### Error Handling
4. **Every `catch` block**: Does it increment a stat, log, or re-throw? If the catch is empty — it is a bug. List every empty catch you find.
5. **Retry logic**: Does every retry loop have a maximum attempts cap? Does it respect rate limit headers (Retry-After)? Does it distinguish between retriable errors (5xx, timeout) and non-retriable errors (4xx)?
6. **Error propagation**: Can errors from worker threads bubble up to the main thread, or are they silently dropped?

### Concurrency & Thread Safety
7. **Shared state**: Are there any shared objects (counters, arrays, maps) mutated from concurrent async contexts? Even in single-threaded JS, verify there are no torn reads/writes.
8. **Worker thread lifecycle**: Are workers properly joined before the process exits? Are they cleaned up on error?

### API Contract Compliance
9. **HTTP method**: Does the code use GET/POST/PUT/DELETE exactly as the SonarQube Server/SonarQube Cloud API specifies?
10. **Endpoint path**: Is the URL exactly right — no missing/misplaced path segments, no incorrect query params?
11. **Request body/params**: Are field names, types, and encoding exactly correct? Compare character-by-character against the real API docs or actual observed API traces.
12. **Auth**: Are tokens passed correctly (Authorization header vs query param)? Are tokens refreshed if expired?

### Edge Cases
13. **0, 1, N at threshold**: What happens when the input is empty? A single item? Exactly at any concurrency threshold (e.g., 500 — the parallel vs sequential cutoff)?
14. **Missing/null fields**: What happens when an expected field is absent? Does the code use optional chaining? Does it fail silently or throw?
15. **Duplicate processing**: Could an issue be processed twice? Could a tag be applied twice? Could a comment be duplicated on the target?

### Side Effects & Regression Watchlist
16. **Side effects of the fix**: Does the fix inadvertently change behavior for other issue types (vulnerability stats, code smells, hotspots vs regular issues)?
17. **Related code paths**: Did you check every file on your regression watchlist? List them again and confirm each one.

> **Write down every concern.** For each concern, write: "This could cause [specific failure] if [condition]." Then before Phase 3, verify or disprove each concern.

---

## Phase 2 — Environment Assessment
<!-- <subsection-updated last-updated="2026-05-07T14:00:00Z" updated-by="Claude" /> -->

> Before running any test, verify the environment is in a known, clean state.

### 2.1 — Verify SQS Source State

```bash
# List all available projects
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/projects/search" | jq '.components[] | {key: .key, name: .name}'

# Confirm target project exists and get total issue count
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/issues/search?projectKeys=${PROJECT_KEY}&ps=1" | jq '.total'

# Count hotspots specifically
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/hotspots/search?projectKey=${PROJECT_KEY}&ps=1" | jq '.total'

# Sample 5 issues — check fields relevant to your issue
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/issues/search?projectKeys=${PROJECT_KEY}&ps=5" | jq '.issues[] | {key: .key, status: .status, type: .type, tags: .tags, hasComments: .hasComments, assignee: .assignee, updateDate: .updateDate, creationDate: .creationDate}'

# Sample 5 hotspots — check status distribution
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/hotspots/search?projectKey=${PROJECT_KEY}&ps=5" | jq '.hotspots[] | {key: .key, status: .status, vulnerability: .vulnerability, securityCategory: .securityCategory}'
```

### 2.2 — Verify SC Target State

```bash
# Check SC auth is valid
curl -s -u "${SONAR_TOKEN}:" "https://sc-staging.io/api/system/status" | jq '.status'

# Check if SC project already exists (stale data from prior runs pollutes tests)
curl -s -u "${SONAR_TOKEN}:" "https://sc-staging.io/api/projects/search?projects=${PROJECT_KEY}" | jq '.components[] | {key: .key}'

# If it exists — DELETE IT before running. A stale SC project invalidates all results.
# Use: curl -s -X POST -u "${SONAR_TOKEN}:" "https://sc-staging.io/api/projects/delete?project=${PROJECT_KEY}"
```

### 2.3 — Pre-Filter Viability Check

The code has a pre-filter: only issues with `hasManualChanges` (or equivalent) are processed. If your test data doesn't pass this filter, you will get 0 operations and a false-pass.

```bash
# Check how many issues pass the pre-filter (has manual changes / updateDate != creationDate)
# Run a sample and check updateDate vs creationDate
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/issues/search?projectKeys=${PROJECT_KEY}&ps=100" | jq '[.issues[] | select(.updateDate != .creationDate)] | length'

# If count is too low (< threshold for parallel sync, typically 500):
# CREATE TEST DATA — bulk tag, add comments, do transitions via the SQ API.
# Document exactly what you created and how many.
```

### 2.4 — Clean Slate (Mandatory)

Every test run starts from zero. Delete all state between runs:

```bash
# Delete migration output
rm -rf migration-output/

# Delete state files
rm -f .cloudvoyager-state.json .cloudvoyager-state.json.bak

# Delete SC project (if it exists from a prior run)
curl -s -X POST -u "${SONAR_TOKEN}:" "https://sc-staging.io/api/projects/delete?project=${PROJECT_KEY}"

# Verify deletion
curl -s -u "${SONAR_TOKEN}:" "https://sc-staging.io/api/projects/search?projects=${PROJECT_KEY}" | jq '.components | length'
```

### 2.5 — Document Pre-Test State

Before running, write down:
- Total issues on SQS: ___
- Total hotspots on SQS: ___
- Issues passing pre-filter: ___
- Hotspots passing pre-filter: ___
- SC project state (fresh or did you delete it?): ___

---

## Phase 3 — Build and Execute
<!-- <subsection-updated last-updated="2026-05-07T14:00:00Z" updated-by="Claude" /> -->

### 3.1 — Build

```bash
npm run package
```

**Must succeed. If it fails, do not proceed. Fix the build error first.**

### 3.2 — Config Verification

Verify the config file is correct for the operation:

```bash
# For transfer operation:
cat config.json | jq '{sqProject: .sourceProject, scProject: .targetProject, sqUrl: .sourceUrl, scUrl: .targetUrl}'

# For migrate operation:
cat migrate-config.json | jq '{...}'
```

### 3.3 — Execute with Verbose Output

```bash
./dist/bin/cloudvoyager-macos-arm64 transfer -c config.json --verbose 2>&1 | tee /tmp/cloudvoyager-run-$(date +%s).log
```

### 3.4 — Monitor in Real-Time

Watch for ALL of:
- **Feature-specific log lines** — whatever the fix adds (grep the diff for new log statements)
- **Progress indicators** — issue counts, hotspot counts, matched pairs
- **Progress stalls** — no output for >3 minutes (could indicate rate limiting, infinite loop, or deadlock)
- **Error/warn lines** — count them, note the first occurrence
- **Rate limiting indicators** — 429 responses, Retry-After headers, backoff messages
- **The final summary stats line** — copy it exactly

### 3.5 — Capture Run Evidence

Save the full output log. Note the timestamp, the summary stats line, and any errors/warns.

---

## Phase 4 — Analyze Results
<!-- <subsection-updated last-updated="2026-05-07T14:00:00Z" updated-by="Claude" /> -->

### 4.1 — Parse Summary Stats

Parse the summary stats line. For every counter, answer:
- Does it match expectations derived in Phase 0?
- Are there unexpected zeros?
- Do the numbers add up? (matched = tagged + already-tagged + failures)
- Is `api-errors` at an acceptable level (<5%)?

### 4.2 — Query the Target System (SC)

Query the SC API directly — do NOT trust the migration output alone.

**Issue-level checks:**
```bash
# Count issues with metadata-synchronized tag vs total
TOTAL=$(curl -s -u "${SONAR_TOKEN}:" "https://sc-staging.io/api/issues/search?projects=${PROJECT_KEY}&ps=1" | jq '.total')
TAGGED=$(curl -s -u "${SONAR_TOKEN}:" "https://sc-staging.io/api/issues/search?projects=${PROJECT_KEY}&tags=metadata-synchronized&ps=1" | jq '.total')
echo "Total: $TOTAL, Tagged: $TAGGED, Untagged: $((TOTAL - TAGGED))"
```

**Spot-check 5+ issues** — for each, query both SQS and SC and compare:
- Tags
- Comments (count and content)
- Assignee
- Status
- Source link (if applicable)

**Issue-specific verification** — derived from Phase 0.2:

Choose all that apply based on your issue:

| Issue type | What to check | How to check |
|---|---|---|
| **Hotspots** | Review % matches SQS | `api/hotspots/search` on both; count SAFE+REVIEWED vs total |
| **Tags** | Tag count/accuracy | `api/issues/search?tags=...` on both |
| **Comments** | Comment count per issue | Sample 5 issues on both, compare comment arrays |
| **Status transitions** | Status counts match | Count by status on both: OPEN, CONFIRMED, RESOLVED, etc. |
| **Assignees** | Assignee field populated | Sample 5 issues, compare assignee field |
| **External issues** | External key preserved | Check `externalRelation` or `externalKey` fields |
| **Metadata sync** | `metadata-synchronized` tag applied | Count tagged vs total issues |

### 4.3 — Check for Silent Failures

```bash
# api-errors count from summary
# Check error logs
ls migration-output/logs/*/cloudvoyager-transfer.error.log 2>/dev/null && cat migration-output/logs/*/cloudvoyager-transfer.error.log

# Check warn logs for rate limiting or timeout messages
ls migration-output/logs/*/cloudvoyager-transfer.warn.log 2>/dev/null && cat migration-output/logs/*/cloudvoy器-transfer.warn.log
```

### 4.4 — Issue-Specific Metric Comparison (Phase 0 Derived)

Run the specific comparisons you planned in Phase 0.2. For each metric:

1. Query SQS with the exact same parameters the code uses
2. Query SC with the equivalent
3. Calculate the metric (e.g., percentage)
4. Compare — they must match within the tolerance you defined in Phase 0.1

**Write down the actual numbers.** If any discrepancy exceeds tolerance, proceed to Phase 5.

---

## Phase 5 — Investigate Anomalies
<!-- <subsection-updated last-updated="2026-05-07T14:00:00Z" updated-by="Claude" /> -->

> **For every unexpected result, trace the full code path to root cause. Do not guess. Prove.**

### 5.1 — Isolate the Failing Path

Start from the data source:
```bash
# Query the SQ API with the exact same parameters the code uses
# Copy the exact URL, exact params, exact headers
curl -s -u "${SONAR_TOKEN}:" "http://localhost:8998/api/issues/search?projectKeys=${PROJECT_KEY}&..." | jq '.issues[] | ...'
```

Verify the field you expect is actually present in the response. Does the SQ API return the field you think you're reading?

### 5.2 — Check Serialization Boundaries

If data crosses a boundary (worker_threads, JSON):
```bash
# Minimal reproduction: create a Worker, pass the data via workerData, log what arrives
node -e "
const { Worker } = require('worker_threads');
const w = new Worker('./test-worker.js', { workerData: { your: 'data' } });
w.on('message', m => console.log('received:', JSON.stringify(m)));
w.on('error', e => console.error('error:', e));
"
```

### 5.3 — Verify API Calls with curl

Make the EXACT same HTTP request manually:
```bash
# Copy method, URL, headers, body from the code
# Run it with curl and inspect the response
curl -v -X POST -u "${SONAR_TOKEN}:" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "issue=AXkS1&tags=test" \
  "http://localhost:8998/api/issues/set_tags"
```

Does it succeed? What HTTP status? What response body? Compare to what the code expects.

### 5.4 — Check Matching Logic

If an issue was not synced or mismatched:
- Was it matched? Check the matcher: same component (file), same line, same rule key?
- Was it filtered out by the pre-filter?
- Did it fail at the API call stage?

### 5.5 — Root Cause Statement

Before fixing, write a root cause statement:
> "The [specific field] was [wrong/absent] because [specific reason]. Evidence: [API response / log line / code snippet]."

This discipline prevents fixing symptoms instead of causes.

---

## Phase 6 — Fix and Re-test
<!-- <subsection-updated last-updated="2026-05-07T14:00:00Z" updated-by="Claude" /> -->

### 6.1 — Apply Minimal Fix

Apply the minimal change that addresses the root cause. Do not make unrelated changes at the same time.

### 6.2 — Verify Syntax

```bash
node --check <file>   # on every changed file
```

### 6.3 — Rebuild

```bash
npm run package
```

### 6.4 — Clean Slate

**Full clean. Not partial. Not skip.**
```bash
rm -rf migration-output/
rm -f .cloudvoyager-state.json .cloudvoyager-state.json.bak
curl -s -X POST -u "${SONAR_TOKEN}:" "https://sc-staging.io/api/projects/delete?project=${PROJECT_KEY}"
```

### 6.5 — Re-run

Full transfer from scratch. Never assume a partial re-run is sufficient.

### 6.6 — Full Re-analysis

Repeat Phase 4 and Phase 5 completely. A fix can introduce new bugs.

> **Repeat Phase 6 until every stat matches, every spot-check passes, and every issue-specific metric is within tolerance.**

---

## Phase 7 — Declare Clean Pass
<!-- <subsection-updated last-updated="2026-05-07T14:00:00Z" updated-by="Claude" /> -->

A clean pass requires **ALL** of the following — not a subset:

- [ ] Exit code 0 — no crashes
- [ ] 0 `failed` in the summary stats
- [ ] All expected counters are non-zero and within tolerance (>95% of matched pairs for tags/source-links/metadata-sync)
- [ ] `api-errors` is <5% of total operations (rate limiting is acceptable; silent data loss is not)
- [ ] Every issue-specific metric (from Phase 0.2 and Phase 4.4) is within its defined tolerance
- [ ] Spot-check of 5+ SC issues confirms correct tags, comments, source links, status, assignee
- [ ] No unexpected warnings in the warn log
- [ ] Fallback paths verified (e.g., if fix changes parallel path, verify sequential fallback still works on a small project)
- [ ] No regressions in related code paths (Phase 0.3 watchlist items all still work)

---

## Reference: Regression Testing Projects

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

### Small Project (fallback / verify sequential path)

| Property | Value |
|----------|-------|
| SQ project key | (any small project with <500 issues) |
| SQ URL | `http://localhost:8998` |
| SC org | `open-digital-society` |
| SC URL | `https://sc-staging.io` |

### Selecting a Project

Choose based on the issue under test:

1. **Hotspots**: Angular Framework (~409 hotspots)
2. **Manual changes pre-filter**: Angular Framework (has issues with diverse updateDate patterns)
3. **Tags / Comments / Assignees**: Any project where these fields are populated
4. **File matching**: Any project where SQ and SC have overlapping file paths
5. **Sequential fallback**: Small project with <500 issues to trigger `mapConcurrent` path

---

## Reference: Config Files

| Operation | Config file |
|-----------|-------------|
| Transfer | `config.json` |
| Migrate | `migrate-config.json` |
| Delete SC project | `.debugging/delete-all-sonarcloud-projects.sh` |
| Test migration | `.debugging/test-migrate.sh` |

---

## Reference: Creating Test Data

To create manual changes (required for the pre-filter to pass):

```bash
# Bulk-tag issues (creates updateDate != creationDate)
python3 -c "
import urllib.request, urllib.parse, json, base64, concurrent.futures, sys

TOKEN = 'squ_...'
PROJECT_KEY = sys.argv[1] if len(sys.argv) > 1 else 'angular-framework'
auth = base64.b64encode(f'{TOKEN}:'.encode()).decode()
headers = {'Authorization': f'Basic {auth}', 'Content-Type': 'application/x-www-form-urlencoded'}

url = f'http://localhost:8998/api/issues/search?projectKeys={PROJECT_KEY}&ps=500'
req = urllib.request.Request(url, headers=headers)
keys = [i['key'] for i in json.load(urllib.request.urlopen(req))['issues']]

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

Adapt for `do_transition`, `add_comment`, and `assign` using the equivalent SQ API endpoints.

---

## Example: Parallel Issue Sync Test (2026-04-28)

Applied this protocol to verify `worker_threads`-based parallel issue sync.

**Phase 0 findings:** Root cause was empty `catch` blocks silently swallowing SC rate limit errors (429). Fix: added retry with backoff and `apiErrors` counter.

**Phase 0.2 regression plan:** Create 700+ tagged issues on SQS, migrate, verify tag sync rate >95% and api-errors <5%.

**Phase 1 findings:** Identified `Object.assign(stats, mergedStats)` preserves `stats.filtered`. Confirmed `workerData` structured clone handles nested objects.

**Phase 2:** SQ had 38,412 issues with 0 manual changes. Created 700 tagged + 32 confirmed + 20 commented via SQ API. Verified pre-filter would pass ~5,000+ issues.

**Phase 3 (run 1):** Transfer showed 0 comments synced, only 7,293/31,641 tagged. Investigation: empty catch blocks + SC rate limiting.

**Phase 4 (run 1):** apiErrors was 0 — confirmed silent swallow. Tag rate 23%, comment rate 0%.

**Phase 5 fix:** Retries 3→6, jitter backoff, 5xx/transient retry, `apiErrors` counter in all catch blocks.

**Phase 6 (run 2):** Clean pass. 5,119 matched, 5,067 tagged (99%), 5,109 metadata-sync-tagged (99.8%), 5,095 source-linked (99.5%), 34 api-errors (0.7%), 0 failed.

**Iterations:** 2. First run exposed silent failures. Second run clean.
