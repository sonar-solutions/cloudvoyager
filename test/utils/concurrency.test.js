import test from 'ava';
import {
  createLimiter,
  mapConcurrent,
  resolvePerformanceConfig,
  createProgressLogger,
  ensureHeapSize,
  getMemoryInfo,
  logSystemInfo
} from '../../src/utils/concurrency.js';

// createLimiter
test('createLimiter respects concurrency limit', async t => {
  const limiter = createLimiter(2);
  let active = 0;
  let maxActive = 0;

  const task = () => limiter(async () => {
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise(r => setTimeout(r, 50));
    active--;
    return 'done';
  });

  const results = await Promise.all([task(), task(), task(), task()]);
  t.is(maxActive, 2);
  t.deepEqual(results, ['done', 'done', 'done', 'done']);
});

test('createLimiter with concurrency 1 runs sequentially', async t => {
  const limiter = createLimiter(1);
  const order = [];

  const task = (id) => limiter(async () => {
    order.push(`start-${id}`);
    await new Promise(r => setTimeout(r, 10));
    order.push(`end-${id}`);
    return id;
  });

  await Promise.all([task(1), task(2), task(3)]);
  t.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2', 'start-3', 'end-3']);
});

test('createLimiter propagates errors', async t => {
  const limiter = createLimiter(2);
  await t.throwsAsync(() => limiter(async () => { throw new Error('fail'); }), { message: 'fail' });
});

// mapConcurrent
test('mapConcurrent returns empty array for empty input', async t => {
  const result = await mapConcurrent([], () => {});
  t.deepEqual(result, []);
});

test('mapConcurrent maps items with concurrency', async t => {
  const items = [1, 2, 3, 4, 5];
  const results = await mapConcurrent(items, async (item) => item * 2, { concurrency: 2 });
  t.deepEqual(results, [2, 4, 6, 8, 10]);
});

test('mapConcurrent calls onProgress callback', async t => {
  const progressCalls = [];
  const items = [1, 2, 3];
  await mapConcurrent(items, async (item) => item, {
    concurrency: 1,
    onProgress: (completed, total) => progressCalls.push({ completed, total })
  });
  t.is(progressCalls.length, 3);
  t.deepEqual(progressCalls[2], { completed: 3, total: 3 });
});

test('mapConcurrent with settled=true returns all results including errors', async t => {
  const items = [1, 2, 3];
  const results = await mapConcurrent(
    items,
    async (item) => {
      if (item === 2) throw new Error('fail');
      return item;
    },
    { concurrency: 1, settled: true }
  );
  t.is(results.length, 3);
  t.is(results[0].status, 'fulfilled');
  t.is(results[0].value, 1);
  t.is(results[1].status, 'rejected');
  t.is(results[1].reason.message, 'fail');
  t.is(results[2].status, 'fulfilled');
  t.is(results[2].value, 3);
});

test('mapConcurrent without settled fails fast on error', async t => {
  const items = [1, 2, 3];
  await t.throwsAsync(
    () => mapConcurrent(items, async (item) => {
      if (item === 2) throw new Error('fail fast');
      return item;
    }, { concurrency: 1 }),
    { message: 'fail fast' }
  );
});

test('mapConcurrent with settled=true calls onProgress for errors too', async t => {
  const progressCalls = [];
  const items = [1, 2];
  await mapConcurrent(
    items,
    async (item) => { if (item === 2) throw new Error('err'); return item; },
    {
      concurrency: 1,
      settled: true,
      onProgress: (completed, total) => progressCalls.push({ completed, total })
    }
  );
  t.is(progressCalls.length, 2);
});

// resolvePerformanceConfig
test('resolvePerformanceConfig returns defaults when no config', t => {
  const config = resolvePerformanceConfig();
  t.is(config.autoTune, false);
  t.truthy(config.maxConcurrency);
  t.is(config.maxMemoryMB, 0);
  t.is(config.sourceExtraction.concurrency, 10);
  t.is(config.hotspotExtraction.concurrency, 10);
  t.is(config.issueSync.concurrency, 5);
  t.is(config.hotspotSync.concurrency, 3);
  t.is(config.projectMigration.concurrency, 1);
});

test('resolvePerformanceConfig respects explicit values', t => {
  const config = resolvePerformanceConfig({
    maxConcurrency: 16,
    sourceExtraction: { concurrency: 20 }
  });
  t.is(config.maxConcurrency, 16);
  t.is(config.sourceExtraction.concurrency, 20);
  t.is(config.hotspotExtraction.concurrency, 10); // default
});

test('resolvePerformanceConfig with autoTune uses hardware-aware defaults', t => {
  const config = resolvePerformanceConfig({ autoTune: true });
  t.is(config.autoTune, true);
  t.truthy(config.maxConcurrency);
  t.truthy(config.maxMemoryMB > 0);
  t.truthy(config.sourceExtraction.concurrency);
});

test('resolvePerformanceConfig with autoTune but explicit overrides', t => {
  const config = resolvePerformanceConfig({
    autoTune: true,
    maxConcurrency: 4,
    sourceExtraction: { concurrency: 5 }
  });
  t.is(config.maxConcurrency, 4);
  t.is(config.sourceExtraction.concurrency, 5);
});

test('resolvePerformanceConfig with empty object', t => {
  const config = resolvePerformanceConfig({});
  t.is(config.autoTune, false);
  t.truthy(config.maxConcurrency);
});

// createProgressLogger
test('createProgressLogger returns a function', t => {
  const progress = createProgressLogger('Test', 100);
  t.is(typeof progress, 'function');
});

test('createProgressLogger callback does not throw', t => {
  const progress = createProgressLogger('Test', 100);
  t.notThrows(() => progress(10, 100));
  t.notThrows(() => progress(50, 100));
  t.notThrows(() => progress(100, 100));
});

test('createProgressLogger with small total', t => {
  const progress = createProgressLogger('Small', 5);
  t.notThrows(() => progress(5, 5));
});

// ensureHeapSize
test('ensureHeapSize does nothing when maxMemoryMB is 0', t => {
  t.notThrows(() => ensureHeapSize(0));
});

test('ensureHeapSize does nothing when maxMemoryMB is negative', t => {
  t.notThrows(() => ensureHeapSize(-1));
});

test('ensureHeapSize does nothing when maxMemoryMB is falsy', t => {
  t.notThrows(() => ensureHeapSize(null));
  t.notThrows(() => ensureHeapSize(undefined));
});

test('ensureHeapSize does nothing when CLOUDVOYAGER_RESPAWNED is set', t => {
  const original = process.env.CLOUDVOYAGER_RESPAWNED;
  process.env.CLOUDVOYAGER_RESPAWNED = '1';
  t.notThrows(() => ensureHeapSize(99999));
  if (original === undefined) {
    delete process.env.CLOUDVOYAGER_RESPAWNED;
  } else {
    process.env.CLOUDVOYAGER_RESPAWNED = original;
  }
});

test('ensureHeapSize does nothing when current heap is sufficient', t => {
  // Request less than current heap
  t.notThrows(() => ensureHeapSize(1));
});

// getMemoryInfo
test('getMemoryInfo returns heap statistics', t => {
  const info = getMemoryInfo();
  t.is(typeof info.heapSizeLimitMB, 'number');
  t.is(typeof info.usedHeapMB, 'number');
  t.is(typeof info.totalHeapMB, 'number');
  t.true(info.heapSizeLimitMB > 0);
  t.true(info.usedHeapMB > 0);
});

// logSystemInfo
test('logSystemInfo does not throw', t => {
  const perfConfig = resolvePerformanceConfig();
  t.notThrows(() => logSystemInfo(perfConfig));
});

test('logSystemInfo with autoTune config', t => {
  const perfConfig = resolvePerformanceConfig({ autoTune: true });
  t.notThrows(() => logSystemInfo(perfConfig));
});
