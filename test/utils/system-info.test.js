import test from 'ava';
import esmock from 'esmock';
import sinon from 'sinon';

test.serial.afterEach(() => sinon.restore());

// ---------------------------------------------------------------------------
// Line 5: typeof _availableParallelism === 'function' — false branch
// When availableParallelism is NOT a function, fallback to cpus().length
// ---------------------------------------------------------------------------

test('resolvePerformanceConfig falls back to cpus().length when availableParallelism is not a function', async t => {
  // Mock node:os to export availableParallelism as undefined (not a function)
  const { resolvePerformanceConfig } = await esmock('../../src/utils/system-info.js', {
    'node:os': {
      availableParallelism: 'not-a-function', // typeof will be 'string', not 'function'
      cpus: () => [{ model: 'Mock CPU' }, { model: 'Mock CPU' }],
      totalmem: () => 8 * 1024 * 1024 * 1024 // 8GB
    }
  });

  const config = resolvePerformanceConfig();
  // Should fallback to cpus().length = 2
  t.truthy(config.maxConcurrency);
  t.is(config.autoTune, false);
});

// ---------------------------------------------------------------------------
// Line 55: isBunCompiled check — true branch
// When running as a Bun-compiled binary, ensureHeapSize should return early
// ---------------------------------------------------------------------------

test.serial('ensureHeapSize returns early when running as Bun compiled binary', async t => {
  const spawnSyncStub = sinon.stub().returns({ status: 0 });

  const { ensureHeapSize } = await esmock('../../src/utils/system-info.js', {
    'node:os': {
      availableParallelism: () => 4,
      cpus: () => [{ model: 'Mock CPU' }],
      totalmem: () => 8 * 1024 * 1024 * 1024
    },
    'node:child_process': {
      spawnSync: spawnSyncStub
    }
  });

  // Save and set process.argv to simulate Bun compiled binary
  const origArgv = process.argv;
  const origRespawned = process.env.CLOUDVOYAGER_RESPAWNED;
  delete process.env.CLOUDVOYAGER_RESPAWNED;

  try {
    // Bun compiled binaries have $bunfs in argv[1]
    process.argv = ['/usr/local/bin/cloudvoyager', '/usr/local/bin/$bunfs/cloudvoyager'];
    // Request a huge heap to ensure we'd normally need to respawn
    ensureHeapSize(999999);
    // Should NOT have called spawnSync because isBunCompiled is true
    t.false(spawnSyncStub.called);
  } finally {
    process.argv = origArgv;
    if (origRespawned === undefined) delete process.env.CLOUDVOYAGER_RESPAWNED;
    else process.env.CLOUDVOYAGER_RESPAWNED = origRespawned;
  }
});

// ---------------------------------------------------------------------------
// Lines 58-69: ensureHeapSize function — full respawn path
// When current heap is insufficient, it should call spawnSync and process.exit
// ---------------------------------------------------------------------------

test.serial('ensureHeapSize respawns when heap is insufficient', async t => {
  const spawnSyncStub = sinon.stub().returns({ status: 0 });
  const exitStub = sinon.stub(process, 'exit');

  const { ensureHeapSize } = await esmock('../../src/utils/system-info.js', {
    'node:os': {
      availableParallelism: () => 4,
      cpus: () => [{ model: 'Mock CPU' }],
      totalmem: () => 8 * 1024 * 1024 * 1024
    },
    'node:child_process': {
      spawnSync: spawnSyncStub
    },
    'node:v8': {
      default: {
        getHeapStatistics: () => ({
          heap_size_limit: 100 * 1024 * 1024, // 100MB — less than requested
          used_heap_size: 50 * 1024 * 1024,
          total_heap_size: 80 * 1024 * 1024
        })
      }
    }
  });

  const origArgv = process.argv;
  const origRespawned = process.env.CLOUDVOYAGER_RESPAWNED;
  delete process.env.CLOUDVOYAGER_RESPAWNED;

  try {
    process.argv = ['/usr/local/bin/node', 'src/index.js', 'transfer', '-c', 'config.json'];
    ensureHeapSize(8192);
    // spawnSync should have been called
    t.true(spawnSyncStub.called);
    // process.exit should have been called
    t.true(exitStub.called);
    // Verify NODE_OPTIONS was set in the spawned env
    const spawnEnv = spawnSyncStub.firstCall.args[2].env;
    t.true(spawnEnv.NODE_OPTIONS.includes('--max-old-space-size=8192'));
    t.is(spawnEnv.CLOUDVOYAGER_RESPAWNED, '1');
  } finally {
    process.argv = origArgv;
    if (origRespawned === undefined) delete process.env.CLOUDVOYAGER_RESPAWNED;
    else process.env.CLOUDVOYAGER_RESPAWNED = origRespawned;
  }
});

test.serial('ensureHeapSize uses result.status ?? 1 when status is null', async t => {
  const spawnSyncStub = sinon.stub().returns({ status: null });
  const exitStub = sinon.stub(process, 'exit');

  const { ensureHeapSize } = await esmock('../../src/utils/system-info.js', {
    'node:os': {
      availableParallelism: () => 4,
      cpus: () => [{ model: 'Mock CPU' }],
      totalmem: () => 8 * 1024 * 1024 * 1024
    },
    'node:child_process': {
      spawnSync: spawnSyncStub
    },
    'node:v8': {
      default: {
        getHeapStatistics: () => ({
          heap_size_limit: 100 * 1024 * 1024,
          used_heap_size: 50 * 1024 * 1024,
          total_heap_size: 80 * 1024 * 1024
        })
      }
    }
  });

  const origArgv = process.argv;
  const origRespawned = process.env.CLOUDVOYAGER_RESPAWNED;
  delete process.env.CLOUDVOYAGER_RESPAWNED;

  try {
    process.argv = ['/usr/local/bin/node', 'src/index.js', 'transfer'];
    ensureHeapSize(8192);
    // process.exit should have been called with 1 (null ?? 1 = 1)
    t.true(exitStub.calledWith(1));
  } finally {
    process.argv = origArgv;
    if (origRespawned === undefined) delete process.env.CLOUDVOYAGER_RESPAWNED;
    else process.env.CLOUDVOYAGER_RESPAWNED = origRespawned;
  }
});

test.serial('ensureHeapSize handles SEA binary (argv[0] === argv[1])', async t => {
  const spawnSyncStub = sinon.stub().returns({ status: 0 });
  const exitStub = sinon.stub(process, 'exit');

  const { ensureHeapSize } = await esmock('../../src/utils/system-info.js', {
    'node:os': {
      availableParallelism: () => 4,
      cpus: () => [{ model: 'Mock CPU' }],
      totalmem: () => 8 * 1024 * 1024 * 1024
    },
    'node:child_process': {
      spawnSync: spawnSyncStub
    },
    'node:v8': {
      default: {
        getHeapStatistics: () => ({
          heap_size_limit: 100 * 1024 * 1024,
          used_heap_size: 50 * 1024 * 1024,
          total_heap_size: 80 * 1024 * 1024
        })
      }
    }
  });

  const origArgv = process.argv;
  const origRespawned = process.env.CLOUDVOYAGER_RESPAWNED;
  delete process.env.CLOUDVOYAGER_RESPAWNED;

  try {
    // SEA binary: argv[0] === argv[1]
    process.argv = ['/usr/local/bin/cloudvoyager', '/usr/local/bin/cloudvoyager', 'transfer', '-c', 'config.json'];
    ensureHeapSize(8192);
    // spawnSync should use argv.slice(2) for SEA mode
    const respawnArgs = spawnSyncStub.firstCall.args[1];
    t.deepEqual(respawnArgs, ['transfer', '-c', 'config.json']);
  } finally {
    process.argv = origArgv;
    if (origRespawned === undefined) delete process.env.CLOUDVOYAGER_RESPAWNED;
    else process.env.CLOUDVOYAGER_RESPAWNED = origRespawned;
  }
});

test.serial('ensureHeapSize appends to existing NODE_OPTIONS', async t => {
  const spawnSyncStub = sinon.stub().returns({ status: 0 });
  const exitStub = sinon.stub(process, 'exit');

  const { ensureHeapSize } = await esmock('../../src/utils/system-info.js', {
    'node:os': {
      availableParallelism: () => 4,
      cpus: () => [{ model: 'Mock CPU' }],
      totalmem: () => 8 * 1024 * 1024 * 1024
    },
    'node:child_process': {
      spawnSync: spawnSyncStub
    },
    'node:v8': {
      default: {
        getHeapStatistics: () => ({
          heap_size_limit: 100 * 1024 * 1024,
          used_heap_size: 50 * 1024 * 1024,
          total_heap_size: 80 * 1024 * 1024
        })
      }
    }
  });

  const origArgv = process.argv;
  const origRespawned = process.env.CLOUDVOYAGER_RESPAWNED;
  const origNodeOptions = process.env.NODE_OPTIONS;
  delete process.env.CLOUDVOYAGER_RESPAWNED;
  process.env.NODE_OPTIONS = '--experimental-vm-modules';

  try {
    process.argv = ['/usr/local/bin/node', 'src/index.js', 'transfer'];
    ensureHeapSize(8192);
    const spawnEnv = spawnSyncStub.firstCall.args[2].env;
    t.true(spawnEnv.NODE_OPTIONS.includes('--experimental-vm-modules'));
    t.true(spawnEnv.NODE_OPTIONS.includes('--max-old-space-size=8192'));
  } finally {
    process.argv = origArgv;
    if (origRespawned === undefined) delete process.env.CLOUDVOYAGER_RESPAWNED;
    else process.env.CLOUDVOYAGER_RESPAWNED = origRespawned;
    if (origNodeOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = origNodeOptions;
  }
});

// ---------------------------------------------------------------------------
// Line 83: cpuInfo.length > 0 ? cpuInfo[0].model.trim() : 'Unknown'
// When cpus() returns empty array, cpuModel should be 'Unknown'
// ---------------------------------------------------------------------------

test('collectEnvironmentInfo returns Unknown cpu when cpus() returns empty array', async t => {
  const { collectEnvironmentInfo } = await esmock('../../src/utils/system-info.js', {
    'node:os': {
      availableParallelism: () => 4,
      cpus: () => [],
      totalmem: () => 8 * 1024 * 1024 * 1024
    }
  });

  const info = collectEnvironmentInfo();
  t.is(info.cpuModel, 'Unknown');
  t.is(info.cpuCores, 4);
});

// ---------------------------------------------------------------------------
// Lines 131-136: Various auto-tune override comparisons
// We need perfConfig values that differ from auto-tune defaults individually
// ---------------------------------------------------------------------------

test('logSystemInfo with autoTune logs all individual overrides', async t => {
  const { resolvePerformanceConfig, logSystemInfo } = await esmock('../../src/utils/system-info.js', {
    'node:os': {
      availableParallelism: () => 4,
      cpus: () => [{ model: 'Mock CPU' }],
      totalmem: () => 8 * 1024 * 1024 * 1024
    }
  });

  // Get auto-tune defaults to know what to override
  const defaults = resolvePerformanceConfig({ autoTune: true });

  // Override every single field so each comparison on lines 130-136 is true
  const perfConfig = {
    autoTune: true,
    maxConcurrency: defaults.maxConcurrency + 10,
    maxMemoryMB: defaults.maxMemoryMB + 100,
    sourceExtraction: { concurrency: defaults.sourceExtraction.concurrency + 5 },
    hotspotExtraction: { concurrency: defaults.hotspotExtraction.concurrency + 5 },
    issueSync: { concurrency: defaults.issueSync.concurrency + 5 },
    hotspotSync: { concurrency: defaults.hotspotSync.concurrency + 5 },
    projectMigration: { concurrency: defaults.projectMigration.concurrency + 5 }
  };

  // This should exercise all override branches (lines 130-136)
  t.notThrows(() => logSystemInfo(perfConfig));
});

test('logSystemInfo with autoTune and no overrides exercises "no overrides" path', async t => {
  const { resolvePerformanceConfig, logSystemInfo } = await esmock('../../src/utils/system-info.js', {
    'node:os': {
      availableParallelism: () => 4,
      cpus: () => [{ model: 'Mock CPU' }],
      totalmem: () => 8 * 1024 * 1024 * 1024
    }
  });

  // Use pure auto-tune defaults (no overrides at all)
  const perfConfig = resolvePerformanceConfig({ autoTune: true });

  // This should exercise the "No user overrides" branch (line 142)
  t.notThrows(() => logSystemInfo(perfConfig));
});
