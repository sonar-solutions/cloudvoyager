import test from 'ava';
import sinon from 'sinon';
import { searchIssues } from '../../src/pipelines/sq-10.4/sonarcloud/api/issues/helpers/search-issues.js';

// -------- Helpers --------

function createMockClient(responses) {
  const calls = [];
  return {
    calls,
    get: sinon.stub().callsFake(async (endpoint, opts) => {
      calls.push({ endpoint, params: opts?.params });
      const handler = responses.shift();
      if (typeof handler === 'function') return handler(opts?.params);
      return handler;
    }),
  };
}

function pagingResponse(issues, total) {
  return { data: { issues, paging: { total } } };
}

test.afterEach(() => sinon.restore());

// ============================================================================
// Sub-10K: standard pagination (no slicing)
// ============================================================================

test('returns all issues when total < 10K (single page)', async t => {
  const issues = [{ key: 'I1' }, { key: 'I2' }];
  const client = createMockClient([
    pagingResponse(issues, 2),   // probe (ps=1)
    pagingResponse(issues, 2),   // paginated fetch
  ]);

  const result = await searchIssues(client, 'org', 'proj');
  t.is(result.length, 2);
  t.deepEqual(result.map(i => i.key), ['I1', 'I2']);
});

test('paginates multiple pages when total < 10K', async t => {
  const page1 = Array.from({ length: 500 }, (_, i) => ({ key: `I${i}` }));
  const page2 = [{ key: 'I500' }];

  const client = createMockClient([
    pagingResponse([], 501),       // probe
    pagingResponse(page1, 501),    // page 1
    pagingResponse(page2, 501),    // page 2
  ]);

  const result = await searchIssues(client, 'org', 'proj');
  t.is(result.length, 501);
});

test('passes organization, statuses, and filters to the API', async t => {
  const client = createMockClient([
    pagingResponse([], 0),   // probe
    pagingResponse([], 0),   // paginated fetch
  ]);

  await searchIssues(client, 'my-org', 'my-proj', { types: 'BUG' });

  const probeParams = client.calls[0].params;
  t.is(probeParams.componentKeys, 'my-proj');
  t.is(probeParams.organization, 'my-org');
  t.truthy(probeParams.statuses);
  t.is(probeParams.types, 'BUG');
  t.is(probeParams.ps, 1);
  t.is(probeParams.p, 1);
});

test('returns empty array when project has no issues', async t => {
  const client = createMockClient([
    pagingResponse([], 0),
    pagingResponse([], 0),
  ]);

  const result = await searchIssues(client, 'org', 'proj');
  t.deepEqual(result, []);
});

// ============================================================================
// Over-10K: date-window slicing activates
// ============================================================================

test('activates slicing when total >= 10K', async t => {
  const client = createMockClient([]);

  // The probe call returns 15000 total, triggering sliceByCreationDate.
  // sliceByCreationDate builds 12 windows and probes each one.
  // We need to respond to: 1 initial probe + 12 window probes + 12 window fetches.
  const issuesPerWindow = 100;
  const windowIssues = Array.from({ length: issuesPerWindow }, (_, i) => ({ key: `W-${i}-${Math.random()}` }));

  client.get = sinon.stub().callsFake(async (_endpoint, opts) => {
    const params = opts?.params || {};

    if (params.ps === 1 && params.p === 1) {
      // Probe call: if it has createdAfter, it's a window probe
      if (params.createdAfter) {
        return pagingResponse([], issuesPerWindow);
      }
      // Initial probe — return >10K to trigger slicing
      return pagingResponse([], 15000);
    }

    // Paginated fetch for a window
    return pagingResponse(windowIssues, issuesPerWindow);
  });

  const result = await searchIssues(client, 'org', 'proj');

  // Should have fetched issues across multiple windows
  t.true(result.length > 0);

  // Verify date-window params were used (createdAfter/createdBefore)
  const windowCalls = client.get.getCalls().filter(
    c => c.args[1]?.params?.createdAfter,
  );
  t.true(windowCalls.length > 0, 'should have made calls with createdAfter date windows');
});

test('slicing deduplicates overlapping window results', async t => {
  const client = createMockClient([]);

  // Use a fixed set of keys so overlapping windows produce duplicates
  const sharedIssues = Array.from({ length: 50 }, (_, i) => ({ key: `DUP-${i}` }));

  client.get = sinon.stub().callsFake(async (_endpoint, opts) => {
    const params = opts?.params || {};
    if (params.ps === 1 && params.p === 1) {
      if (params.createdAfter) return pagingResponse([], 50);
      return pagingResponse([], 15000);
    }
    // Every window returns the same 50 issues
    return pagingResponse(sharedIssues, 50);
  });

  const result = await searchIssues(client, 'org', 'proj');

  // deduplicateResults should collapse duplicates down to 50 unique keys
  t.is(result.length, 50);
  const uniqueKeys = new Set(result.map(i => i.key));
  t.is(uniqueKeys.size, 50);
});
