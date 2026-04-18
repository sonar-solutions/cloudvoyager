import test from 'ava';
import sinon from 'sinon';
import { waitForScIndexing } from '../../src/shared/utils/issue-sync/wait-for-sc-indexing.js';

test.afterEach(() => sinon.restore());

const FAST = { initialDelayMs: 1, maxDelayMs: 1 };

// ============================================================================
// Early exit
// ============================================================================

test('returns [] immediately when sqCount is 0', async t => {
  const fetchFn = sinon.stub().resolves([{ key: 'x' }]);
  const result = await waitForScIndexing(fetchFn, 0);
  t.deepEqual(result, []);
  t.is(fetchFn.callCount, 0);
});

// ============================================================================
// Items available on first retry attempt
// ============================================================================

test('returns items on first attempt without delay', async t => {
  const items = [{ key: 'i1' }, { key: 'i2' }];
  const fetchFn = sinon.stub().resolves(items);

  const result = await waitForScIndexing(fetchFn, 5, {
    label: 'issues', projectKey: 'proj', maxRetries: 3, ...FAST,
  });

  t.deepEqual(result, items);
  t.is(fetchFn.callCount, 1);
});

// ============================================================================
// Items appear after several retries
// ============================================================================

test('retries until items appear and returns them', async t => {
  const items = [{ key: 'i1' }];
  const fetchFn = sinon.stub()
    .onFirstCall().resolves([])
    .onSecondCall().resolves([])
    .onThirdCall().resolves(items);

  const result = await waitForScIndexing(fetchFn, 10, {
    label: 'issues', projectKey: 'proj', maxRetries: 5, ...FAST,
  });

  t.deepEqual(result, items);
  t.is(fetchFn.callCount, 3);
});

// ============================================================================
// Exhausted retries
// ============================================================================

test('returns [] after exhausting all retries', async t => {
  const fetchFn = sinon.stub().resolves([]);

  const result = await waitForScIndexing(fetchFn, 100, {
    label: 'hotspots', projectKey: 'proj', maxRetries: 3, ...FAST,
  });

  t.deepEqual(result, []);
  t.is(fetchFn.callCount, 3);
});

// ============================================================================
// Backoff increases delay between retries
// ============================================================================

test('applies exponential backoff between retries', async t => {
  const callTimestamps = [];
  const fetchFn = sinon.stub().callsFake(async () => {
    callTimestamps.push(Date.now());
    return [];
  });

  await waitForScIndexing(fetchFn, 10, {
    maxRetries: 4, initialDelayMs: 30, maxDelayMs: 200,
  });

  t.is(fetchFn.callCount, 4);
  const gap1 = callTimestamps[1] - callTimestamps[0];
  const gap2 = callTimestamps[2] - callTimestamps[1];
  const gap3 = callTimestamps[3] - callTimestamps[2];
  t.true(gap2 >= gap1 * 0.8, `Expected gap2 (${gap2}ms) >= ~gap1 (${gap1}ms)`);
  t.true(gap3 >= gap2 * 0.8, `Expected gap3 (${gap3}ms) >= ~gap2 (${gap2}ms)`);
});

// ============================================================================
// Default options
// ============================================================================

test('uses sensible defaults when no options provided', async t => {
  const items = [{ key: 'i1' }];
  const fetchFn = sinon.stub().resolves(items);

  const result = await waitForScIndexing(fetchFn, 5);

  t.deepEqual(result, items);
  t.is(fetchFn.callCount, 1);
});

// ============================================================================
// fetchFn error propagation
// ============================================================================

test('propagates fetchFn errors to the caller', async t => {
  const fetchFn = sinon.stub().rejects(new Error('Network failure'));

  await t.throwsAsync(
    () => waitForScIndexing(fetchFn, 10, { maxRetries: 2, ...FAST }),
    { message: 'Network failure' },
  );
});

// ============================================================================
// Items on last possible attempt
// ============================================================================

test('returns items even on the very last retry', async t => {
  const items = [{ key: 'i1' }];
  const fetchFn = sinon.stub()
    .onCall(0).resolves([])
    .onCall(1).resolves([])
    .onCall(2).resolves(items);

  const result = await waitForScIndexing(fetchFn, 10, {
    maxRetries: 3, ...FAST,
  });

  t.deepEqual(result, items);
  t.is(fetchFn.callCount, 3);
});

// ============================================================================
// Single retry allowed
// ============================================================================

test('works correctly with maxRetries=1 and items present', async t => {
  const items = [{ key: 'i1' }];
  const fetchFn = sinon.stub().resolves(items);

  const result = await waitForScIndexing(fetchFn, 5, {
    maxRetries: 1, ...FAST,
  });

  t.deepEqual(result, items);
  t.is(fetchFn.callCount, 1);
});

test('works correctly with maxRetries=1 and no items', async t => {
  const fetchFn = sinon.stub().resolves([]);

  const result = await waitForScIndexing(fetchFn, 5, {
    maxRetries: 1, ...FAST,
  });

  t.deepEqual(result, []);
  t.is(fetchFn.callCount, 1);
});

// ============================================================================
// No delay on first call
// ============================================================================

test('first attempt calls fetchFn immediately without waiting', async t => {
  const start = Date.now();
  const fetchFn = sinon.stub().resolves([{ key: 'i1' }]);

  await waitForScIndexing(fetchFn, 5, {
    maxRetries: 3, initialDelayMs: 5000,
  });

  const elapsed = Date.now() - start;
  t.true(elapsed < 500, `First attempt should be instant, took ${elapsed}ms`);
  t.is(fetchFn.callCount, 1);
});
