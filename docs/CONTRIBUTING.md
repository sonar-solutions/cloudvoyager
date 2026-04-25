# Contributing to CloudVoyager
<!-- Last updated: 2026-04-21 -->

This guide documents the architectural patterns and conventions of the CloudVoyager codebase. Contributors must follow these patterns to maintain consistency and prevent regressions.

---

## Golden Rule: Pipeline Isolation

Each supported SonarQube version range gets its own **complete, independent pipeline directory** under `src/pipelines/`. There are no runtime version checks within any pipeline -- each pipeline has its behavior hardcoded for its target version range.

```
src/pipelines/
├── sq-9.9/     # SonarQube 9.9 LTS
├── sq-10.0/    # SonarQube 10.0–10.3
├── sq-10.4/    # SonarQube 10.4–10.8
└── sq-2025/    # SonarQube 2025.1+
```

The **version router** (`src/version-router.js`) detects the SonarQube server version at runtime and dynamically imports the correct pipeline. This means:

- **Never add version-conditional logic inside a pipeline.** If behavior differs between versions, it belongs in a separate pipeline directory.
- **Never import across pipeline boundaries.** Each pipeline is self-contained.
- **Shared, version-independent code** lives in `src/shared/` and may be imported by any pipeline.

---

## Directory Structure

```
src/
├── index.js                    # CLI entry point (Commander-based)
├── version-router.js           # Detects SQ version, loads correct pipeline
├── commands/                   # CLI command handlers (transfer, migrate, sync-metadata, verify)
├── pipelines/                  # Version-specific pipeline implementations
│   ├── sq-9.9/                 # SonarQube 9.9 LTS
│   ├── sq-10.0/                # SonarQube 10.0–10.3
│   ├── sq-10.4/                # SonarQube 10.4–10.8
│   └── sq-2025/                # SonarQube 2025.1+
└── shared/                     # Version-independent shared code
    ├── config/                 # Configuration loading and validation (Ajv-based)
    ├── mapping/                # Organization mapping and CSV tools
    ├── reports/                # Migration report generation (text, markdown, PDF)
    ├── state/                  # State management and persistence
    ├── utils/                  # Utility modules (logger, errors, concurrency, shutdown)
    └── verification/           # Migration verification (read-only comparison)
```

Each pipeline directory (`src/pipelines/sq-{version}/`) contains a complete, self-contained implementation:

```
sq-{version}/
├── transfer-pipeline.js           # Single-project transfer orchestrator
├── migrate-pipeline.js            # Full multi-org migration orchestrator
├── sonarqube/                     # SonarQube integration
│   ├── api-client.js               # HTTP client with pagination, auth, SCM revision
│   ├── models.js                   # Data models and factory functions
│   ├── api/                        # API method modules
│   │   ├── issues-hotspots.js       # Issue and hotspot API methods
│   │   ├── permissions.js           # Permission API methods
│   │   ├── quality.js               # Quality gate and profile API methods
│   │   └── server-config.js         # Server info, settings, webhooks
│   └── extractors/                 # Specialized data extractors (25+ modules)
│       ├── index.js                 # DataExtractor orchestrator
│       ├── issues.js
│       ├── hotspots.js
│       └── ...
├── protobuf/                      # Protobuf encoding
│   ├── builder.js                   # Orchestrates protobuf message building
│   ├── encoder.js                   # Encodes messages using protobufjs
│   ├── build-components.js
│   ├── build-issues.js
│   ├── build-external-issues.js
│   ├── build-measures.js
│   ├── build-duplications.js
│   ├── encode-types.js
│   └── schema/                      # .proto definitions
│       ├── constants.proto
│       └── scanner-report.proto
├── sonarcloud/                    # SonarCloud integration
│   ├── api-client.js               # SonarCloud HTTP client (retry, throttle)
│   ├── uploader.js                 # Report packaging and CE submission
│   ├── enterprise-client.js        # Enterprise API client
│   ├── rule-enrichment.js          # Rule enrichment for Clean Code attributes
│   ├── api/                        # API method modules
│   │   ├── issues.js
│   │   ├── hotspots.js
│   │   ├── permissions.js
│   │   ├── quality-profiles.js
│   │   ├── quality-gates.js
│   │   └── project-config.js
│   └── migrators/                  # Migration modules
│       ├── quality-gates.js
│       ├── quality-profiles.js
│       ├── groups.js
│       ├── permissions.js
│       ├── issue-sync.js
│       ├── hotspot-sync.js
│       ├── project-config.js
│       ├── portfolios.js
│       └── quality-profile-diff.js
└── pipeline/                      # Migration pipeline stages
    ├── extraction.js                # Server-wide data extraction
    ├── org-migration.js             # Per-organization migration
    ├── project-migration.js         # Per-project migration
    └── results.js                   # Result tracking and aggregation
```

New files must go in the appropriate directory. Shared, version-independent code goes in `src/shared/`. Version-specific code goes in the relevant pipeline under `src/pipelines/sq-{version}/`.

---

## Patterns

### 1. Extractor Pattern (`src/pipelines/sq-{version}/sonarqube/extractors/`)

Each extractor is a standalone async function:

```js
export async function extractXxx(client, state = null, branch = null) {
  logger.info('Extracting xxx...');
  const data = await client.getXxx(filters);
  logger.info(`Extracted ${data.length} items`);
  return data.map(item => createXxxData(item));
}
```

**Rules:**
- First parameter is always `client` (SonarQubeClient instance)
- Use model factory functions from `models.js` to normalize data
- Log item counts at info level
- State parameter is optional and used for incremental filtering
- The `DataExtractor` orchestrator in `extractors/index.js` coordinates all extractors

### 2. API Module Pattern (`src/pipelines/sq-{version}/sonarqube/api/`, `src/pipelines/sq-{version}/sonarcloud/api/`)

Stateless functions that wrap a single API endpoint:

```js
export async function getXxx(client, param) {
  logger.info('Fetching xxx');
  const response = await client.get('/api/xxx', { params: { key: param } });
  return response.data.xxx || [];
}
```

**Rules:**
- One function per API endpoint
- Functions receive either `client` (axios instance) or `getPaginated` (bound method)
- Never store state in these modules -- they are pure function libraries
- The `SonarQubeClient` delegates to these via thin wrappers

### 3. Migrator Pattern (`src/pipelines/sq-{version}/sonarcloud/migrators/`)

Transform extracted SonarQube data and apply it to SonarCloud:

```js
export async function migrateXxx(extractedData, scClient, options) {
  // Transform + apply
  return mapping; // Return ID/name mappings for cross-referencing
}
```

**Rules:**
- Named `migrate*`
- Return mappings (Map or object) so downstream code can cross-reference IDs
- Handle partial failures gracefully (log warning, continue)

### 4. Client Pattern (`src/pipelines/sq-{version}/sonarqube/api-client.js`)

Each pipeline has its own `SonarQubeClient` tailored to its version range:

**Rules:**
- Methods delegate to API modules via bound references
- Pagination is handled by `getPaginated(endpoint, params, dataKey)`
- Error handling is centralized in `handleError()` which converts axios errors to custom types
- Version-specific behavior is hardcoded -- no runtime version checks needed

### 5. Error Handling

**Custom error hierarchy** (all extend `CloudVoyagerError` from `src/shared/utils/errors.js`):

| Error Class | When to Use |
|-------------|-------------|
| `ConfigurationError` | Invalid config file or missing required fields |
| `SonarQubeAPIError` | SonarQube API failures (include endpoint in constructor) |
| `SonarCloudAPIError` | SonarCloud API failures (include endpoint in constructor) |
| `AuthenticationError` | 401/403 responses (include service name) |
| `ProtobufEncodingError` | Protobuf encoding failures |
| `StateError` | State file I/O failures |
| `ValidationError` | Schema validation failures (include errors array) |

**When to wrap with try/catch:**
- **Wrap**: Optional/version-dependent endpoints, Enterprise-only features, permission APIs
- **Don't wrap**: Core endpoints where failure should stop execution

### 6. Pagination

All paginated SonarQube APIs use `getPaginated()`:

```js
return await this.getPaginated('/api/xxx/search', { ps: 500 }, 'items');
```

**Rules:**
- Default page size: 500
- Override to `ps: 100` for permission-related APIs (SonarQube limitation)
- Handles both `data.paging.total` (10.x+) and `data.total` (9.x) response formats
- Never implement manual pagination -- always use `getPaginated()`

### 7. Concurrency

Use `mapConcurrent()` from `src/shared/utils/concurrency.js` for parallel I/O:

```js
import { mapConcurrent } from '../../shared/utils/concurrency.js';

const results = await mapConcurrent(items, async (item) => {
  return await fetchItem(item);
}, { concurrency: 10 });
```

**Rules:**
- Source/duplication extraction: concurrency 10
- Hotspot extraction: concurrency 5
- Use `settled: true` when partial failure is acceptable
- Use `createProgressLogger()` for large batches

### 8. Issue Sync Pre-Filter Pattern (`src/shared/utils/issue-sync/`)

Issue sync across all four pipelines uses a **pre-filter optimization** (see [GitHub #90](https://github.com/sonar-solutions/cloudvoyager/issues/90)) modeled after the [`sonar-findings-sync` algorithm](https://github.com/okorach/sonar-tools/blob/0be16b23d1eb9a374fc3cbbcb1c10242df0631a3/sonar/syncer.py#L564).

**Problem:** The naive approach matches and syncs *all* SQ issues against SC issues. For projects with 100K issues, this means ~100K API calls and hours of runtime, even though only ~1-2% of issues typically have manual changes.

**Solution:** Before matching, batch-fetch SQ changelogs and filter to only issues with "manual changes":

```
sqIssues (100K) → fetchSqChangelogs() → hasManualChanges() filter → ~1-2K issues → matchIssues() → syncOneIssue()
```

An issue is considered to have **manual changes** if any of:
1. Its changelog has at least one entry with a non-empty `user` field (human actor, not system)
2. It has comments not prefixed with `[Migrated from SonarQube]` (manual, not auto-generated)
3. It has custom tags (`tags` array is non-empty)

**Shared utilities:**
- `fetchSqChangelogs(sqIssues, sqClient, concurrency)` — batch-fetches changelogs via `mapConcurrent`, returns `Map<issueKey, changelog[]>`
- `hasManualChanges(issue, changelog)` — pure function, returns `boolean`

The pre-fetched changelogs are passed through to `syncIssueStatus` via a `changelogMap` to avoid redundant per-issue changelog API calls.

**Performance test:** `test/utils/issue-sync.test.js` includes regression tests that verify the filter ratio stays within tolerance (<=10% of issues pass through) and that filtering 50K issues completes in <1 second.

**Rules:**
- Always pass `changelogMap` through from orchestrator to per-issue sync functions
- The `preloadedChangelog` parameter in `syncIssueStatus` uses `??` (nullish coalescing) so it falls back to fetching if the caller doesn't provide preloaded data
- The `stats.filtered` counter tracks how many issues were skipped by the pre-filter

---

## Conventions

### Imports

- **ESM only** -- the project uses `"type": "module"`
- Node builtins use `node:` prefix: `import { readFile } from 'node:fs/promises'`
- Local imports must include `.js` extension: `import { Xxx } from './module.js'`
- No CommonJS (`require`)
- Commands use dynamic `import()` to load the correct pipeline at runtime via the version router

### Logging

```js
import logger from '../../shared/utils/logger.js';

logger.info('User-visible progress message');     // Major steps
logger.debug('Technical detail for --verbose');    // API calls, pagination
logger.warn('Non-fatal issue, continuing');        // Skipped features, partial failures
logger.error('Fatal error, stopping');             // Errors that halt execution
```

**Rules:**
- Always include context (project key, count, component name)
- Use `logger.info()` for step boundaries and result counts
- Use `logger.debug()` for per-page and per-item detail
- Never use `console.log` -- always use the logger

### Configuration

- JSON Schema validated with Ajv (`useDefaults: true`)
- Env vars override config values: `SONARQUBE_TOKEN`, `SONARCLOUD_TOKEN`, `SONARQUBE_URL`, `SONARCLOUD_URL`
- Config is loaded once at CLI entry and passed down -- never re-load mid-pipeline
- `additionalProperties: false` on all schema objects
- Config schemas live in `src/shared/config/`

### State Management

- State files track incremental sync progress (last sync time, processed issue keys)
- State is only written after successful upload -- never partially update state
- Use `StateTracker` from `src/shared/state/tracker.js`, not direct file I/O
- Checkpoint journal (`src/shared/state/checkpoint.js`) tracks phase completion for crash recovery
- Advisory lock files (`src/shared/state/lock.js`) prevent concurrent runs

---

## Testing

**Framework:** Ava + Sinon + esmock

```js
import test from 'ava';
import sinon from 'sinon';

test.afterEach(() => sinon.restore());

test('should extract issues', async t => {
  const client = { getIssues: sinon.stub().resolves([{ key: 'issue-1' }]) };
  const result = await extractIssues(client);
  t.is(result.length, 1);
});
```

**Rules:**
- Test files: `test/**/*.test.js` mirroring `src/` structure
- Always `sinon.restore()` in `afterEach`
- Use stubs for API clients -- never make real HTTP calls in tests
- Use `t.is()`, `t.deepEqual()`, `t.true()`, `t.throws()`, `t.throwsAsync()`
- Use temp directories for file-based tests (`os.tmpdir()` + `randomUUID()`)

**Running tests:**
```bash
npm test          # With coverage
npm run test:fast # Without coverage
npm run lint      # ESLint
```

---

## Adding New SonarQube Version Support

When a new SonarQube version introduces API changes:

1. **Research** the API differences (check release notes, deprecation logs)
2. **Create a new pipeline directory** under `src/pipelines/sq-{version}/` by copying the closest existing pipeline as a starting point
3. **Modify the copied pipeline** to reflect the new API behavior -- change only what differs from the source pipeline
4. **Register the new pipeline** in `src/version-router.js` by updating `resolvePipelineId()` to map the new version range to the new directory
5. **Update docs** -- `docs/CHANGELOG.md`, `README.md`, `CLAUDE.md`
6. **Update `package.json`** -- add version to `sonarqubeCompatibility.tested` array
7. **Test** against the new version with `node src/index.js test -c config.json`

Key version differences to watch for:

| Behavior | sq-9.9 | sq-10.0 | sq-10.4 | sq-2025 |
|----------|--------|---------|---------|---------|
| Issue search param | `statuses` | `statuses` | `issueStatuses` | `issueStatuses` |
| Issue statuses | `OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED` | `OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED` | Modern lifecycle | Modern lifecycle |
| metricKeys limit | Batch at 15 | Batch at 15 | Batch at 15 | No batching |
| Clean Code source | SC enrichment map | Native from SQ | Native from SQ | Native from SQ |
| Groups API | Standard | Standard | Standard | Web API V2 fallback |

---

## Checklist Before Submitting

- [ ] `npm run lint` passes with no errors
- [ ] `npm test` passes
- [ ] Pipeline isolation maintained -- no cross-pipeline imports, no runtime version checks within a pipeline
- [ ] Shared code placed in `src/shared/`, version-specific code in the correct pipeline
- [ ] New API endpoints wrapped in try/catch if optional/version-dependent
- [ ] Logger used instead of console.log
- [ ] ESM imports with `.js` extension and `node:` prefix for builtins
- [ ] Documentation updated if user-facing behavior changed
- [ ] CHANGELOG.md updated with a new entry

---

## Regression Test Conventions
<!-- updated: 2026-04-25_10:00:00 -->

- Every bug fix should have a corresponding regression test in `test/regression/assert-{scenario}.js`
- Assertion scripts import from `test/regression/helpers/sqc-client.js` (SQC API client with retry) and `test/regression/helpers/assert-utils.js` (PASS/FAIL output)
- Each assertion script exits 0 (all pass) or 1 (any fail), with structured output: `PASS: [#issue] message` / `FAIL: [#issue] message`
- Enrichment scripts in `test/regression/enrichment/` must exit non-zero on ANY API error and verify their side effects
- The CI workflow runs in the private `sonar-solutions/cloudvoyager-ci` repo (not this public repo) to protect SQ Enterprise license keys
- Meta-tests for helpers use AVA with `test.serial` (since they mock `global.fetch`)
