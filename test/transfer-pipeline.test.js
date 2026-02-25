import test from 'ava';
import sinon from 'sinon';
import { SonarQubeClient } from '../src/sonarqube/api-client.js';
import { SonarCloudClient } from '../src/sonarcloud/api-client.js';
import { DataExtractor } from '../src/sonarqube/extractors/index.js';
import { ProtobufBuilder } from '../src/protobuf/builder.js';
import { ProtobufEncoder } from '../src/protobuf/encoder.js';
import { ReportUploader } from '../src/sonarcloud/uploader.js';
import { StateTracker } from '../src/state/tracker.js';
import { transferProject } from '../src/transfer-pipeline.js';

function setupStubs() {
  const stubs = {};

  // StateTracker
  stubs.stInit = sinon.stub(StateTracker.prototype, 'initialize').resolves();
  stubs.stSummary = sinon.stub(StateTracker.prototype, 'getSummary').returns({
    lastSync: null,
    processedIssuesCount: 0,
    completedBranchesCount: 0,
    completedBranches: [],
    syncHistoryCount: 0
  });
  stubs.stRecord = sinon.stub(StateTracker.prototype, 'recordTransfer').resolves();

  // SonarQubeClient
  stubs.sqTest = sinon.stub(SonarQubeClient.prototype, 'testConnection').resolves();
  stubs.sqGetProject = sinon.stub(SonarQubeClient.prototype, 'getProject').resolves({ name: 'Test Project' });

  // SonarCloudClient
  stubs.scTest = sinon.stub(SonarCloudClient.prototype, 'testConnection').resolves();
  stubs.scEnsure = sinon.stub(SonarCloudClient.prototype, 'ensureProject').resolves();
  stubs.scProfiles = sinon.stub(SonarCloudClient.prototype, 'getQualityProfiles').resolves([]);
  stubs.scBranch = sinon.stub(SonarCloudClient.prototype, 'getMainBranchName').resolves('main');

  // DataExtractor
  stubs.extractAll = sinon.stub(DataExtractor.prototype, 'extractAll').resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [{ key: 'i1' }],
    components: [{ key: 'c1' }],
    sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }],
    measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });

  // ProtobufBuilder
  stubs.buildAll = sinon.stub(ProtobufBuilder.prototype, 'buildAll').returns({ metadata: {} });

  // ProtobufEncoder
  stubs.loadSchemas = sinon.stub(ProtobufEncoder.prototype, 'loadSchemas').resolves();
  stubs.encodeAll = sinon.stub(ProtobufEncoder.prototype, 'encodeAll').returns({ data: 'encoded' });

  // ReportUploader
  stubs.upload = sinon.stub(ReportUploader.prototype, 'upload').resolves({ id: 'ce-task-1' });
  stubs.uploadAndWait = sinon.stub(ReportUploader.prototype, 'uploadAndWait').resolves();

  return stubs;
}

function baseOptions(overrides = {}) {
  return {
    sonarqubeConfig: { url: 'http://localhost:9000', token: 'sq-token', projectKey: 'test-proj' },
    sonarcloudConfig: { url: 'https://sonarcloud.io', token: 'sc-token', organization: 'test-org', projectKey: 'sc-test-proj' },
    transferConfig: { mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100 },
    ...overrides
  };
}

// Serial because we stub shared prototypes
test.serial('transferProject completes full pipeline', async t => {
  const stubs = setupStubs();
  try {
    const result = await transferProject(baseOptions());
    t.is(result.projectKey, 'test-proj');
    t.is(result.sonarCloudProjectKey, 'sc-test-proj');
    t.is(result.stats.issuesTransferred, 1);
    t.is(result.stats.componentsTransferred, 1);
    t.is(result.stats.sourcesTransferred, 1);
    t.true(stubs.sqTest.called);
    t.true(stubs.scTest.called);
    t.true(stubs.scEnsure.called);
    t.true(stubs.extractAll.called);
    t.true(stubs.buildAll.called);
    t.true(stubs.loadSchemas.called);
    t.true(stubs.encodeAll.called);
    t.true(stubs.upload.called);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject skips connection test when skipConnectionTest=true', async t => {
  const stubs = setupStubs();
  try {
    await transferProject(baseOptions({ skipConnectionTest: true }));
    t.false(stubs.sqTest.called);
    t.false(stubs.scTest.called);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject uses provided projectName', async t => {
  const stubs = setupStubs();
  try {
    await transferProject(baseOptions({ skipConnectionTest: true, projectName: 'Custom Name' }));
    t.false(stubs.sqGetProject.called);
    t.true(stubs.scEnsure.calledWith('Custom Name'));
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject fetches project name when not provided', async t => {
  const stubs = setupStubs();
  try {
    await transferProject(baseOptions({ skipConnectionTest: true }));
    t.true(stubs.sqGetProject.called);
    t.true(stubs.scEnsure.calledWith('Test Project'));
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject handles project name fetch failure gracefully', async t => {
  const stubs = setupStubs();
  stubs.sqGetProject.rejects(new Error('Not found'));
  try {
    await transferProject(baseOptions({ skipConnectionTest: true }));
    t.true(stubs.scEnsure.calledWith(null));
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject uses uploadAndWait when wait=true', async t => {
  const stubs = setupStubs();
  try {
    await transferProject(baseOptions({ skipConnectionTest: true, wait: true }));
    t.true(stubs.uploadAndWait.called);
    t.false(stubs.upload.called);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject records transfer in incremental mode', async t => {
  const stubs = setupStubs();
  try {
    await transferProject(baseOptions({
      skipConnectionTest: true,
      transferConfig: { mode: 'incremental', stateFile: '/tmp/inc-state.json', batchSize: 50 }
    }));
    t.true(stubs.stRecord.called);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject does not record transfer in full mode', async t => {
  const stubs = setupStubs();
  try {
    await transferProject(baseOptions({ skipConnectionTest: true }));
    t.false(stubs.stRecord.called);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject logs last sync info when available', async t => {
  const stubs = setupStubs();
  stubs.stSummary.returns({ lastSync: '2025-01-01', processedIssuesCount: 42 });
  try {
    const result = await transferProject(baseOptions({ skipConnectionTest: true }));
    t.truthy(result);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject passes incremental stateTracker to DataExtractor', async t => {
  const stubs = setupStubs();
  try {
    await transferProject(baseOptions({
      skipConnectionTest: true,
      transferConfig: { mode: 'incremental', stateFile: '/tmp/inc.json', batchSize: 10 }
    }));
    t.true(stubs.extractAll.called);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject passes performanceConfig to DataExtractor', async t => {
  const stubs = setupStubs();
  try {
    await transferProject(baseOptions({
      skipConnectionTest: true,
      performanceConfig: { maxConcurrency: 8 }
    }));
    t.true(stubs.extractAll.called);
  } finally {
    sinon.restore();
  }
});

// ---------------------------------------------------------------------------
// Non-main branch transfer tests (lines 105-158)
// ---------------------------------------------------------------------------

/**
 * Helper that extends setupStubs() with branch-related stubs and configures
 * extractAll to return multiple branches by default.
 */
function setupBranchStubs() {
  const stubs = setupStubs();

  // Override extractAll to include non-main branches
  stubs.extractAll.resolves({
    project: { branches: [
      { name: 'main', isMain: true },
      { name: 'develop', isMain: false },
      { name: 'feature-x', isMain: false }
    ]},
    issues: [{ key: 'i1' }],
    components: [{ key: 'c1' }],
    sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }],
    measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });

  // Stub extractBranch to return branch-specific data
  stubs.extractBranch = sinon.stub(DataExtractor.prototype, 'extractBranch').resolves({
    project: { branches: [] },
    issues: [{ key: 'branch-i1' }, { key: 'branch-i2' }],
    components: [{ key: 'branch-c1' }],
    sources: [{ key: 'branch-s1' }],
    metrics: [{ key: 'ncloc' }],
    measures: { measures: [{ metric: 'ncloc', value: '500' }] }
  });

  // Stub branch completion tracking
  stubs.isBranchCompleted = sinon.stub(StateTracker.prototype, 'isBranchCompleted').returns(false);
  stubs.markBranchCompleted = sinon.stub(StateTracker.prototype, 'markBranchCompleted');

  return stubs;
}

test.serial('transferProject syncs non-main branches', async t => {
  const stubs = setupBranchStubs();
  try {
    const result = await transferProject(baseOptions({ skipConnectionTest: true }));

    // extractBranch should be called once for each non-main branch (develop, feature-x)
    t.is(stubs.extractBranch.callCount, 2);
    t.is(stubs.extractBranch.firstCall.args[0], 'develop');
    t.is(stubs.extractBranch.secondCall.args[0], 'feature-x');

    // upload should be called 3 times: main + develop + feature-x
    t.is(stubs.upload.callCount, 3);

    // branchesTransferred should contain all three
    t.deepEqual(result.stats.branchesTransferred, ['main', 'develop', 'feature-x']);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject skips excluded branches', async t => {
  const stubs = setupBranchStubs();
  try {
    const result = await transferProject(baseOptions({
      skipConnectionTest: true,
      transferConfig: { mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100, excludeBranches: ['develop'] }
    }));

    // Only feature-x should be transferred (develop excluded)
    t.is(stubs.extractBranch.callCount, 1);
    t.is(stubs.extractBranch.firstCall.args[0], 'feature-x');

    // branchesTransferred: main + feature-x only
    t.deepEqual(result.stats.branchesTransferred, ['main', 'feature-x']);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject skips completed branches in incremental mode', async t => {
  const stubs = setupBranchStubs();
  // Mark 'develop' as already completed
  stubs.isBranchCompleted.withArgs('develop').returns(true);
  try {
    const result = await transferProject(baseOptions({
      skipConnectionTest: true,
      transferConfig: { mode: 'incremental', stateFile: '/tmp/inc-state.json', batchSize: 100 }
    }));

    // Only feature-x should be extracted (develop skipped as completed)
    t.is(stubs.extractBranch.callCount, 1);
    t.is(stubs.extractBranch.firstCall.args[0], 'feature-x');

    // branchesTransferred: main + feature-x
    t.deepEqual(result.stats.branchesTransferred, ['main', 'feature-x']);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject handles branch transfer failure gracefully', async t => {
  const stubs = setupBranchStubs();
  // Make extractBranch fail for 'develop' but succeed for 'feature-x'
  stubs.extractBranch.withArgs('develop').rejects(new Error('Branch extraction failed'));
  stubs.extractBranch.withArgs('feature-x').resolves({
    project: { branches: [] },
    issues: [{ key: 'fx-i1' }],
    components: [{ key: 'fx-c1' }],
    sources: [{ key: 'fx-s1' }],
    metrics: [{ key: 'ncloc' }],
    measures: { measures: [{ metric: 'ncloc', value: '200' }] }
  });
  try {
    const result = await transferProject(baseOptions({ skipConnectionTest: true }));

    // Both branches attempted
    t.is(stubs.extractBranch.callCount, 2);

    // Only main + feature-x succeeded (develop failed)
    t.deepEqual(result.stats.branchesTransferred, ['main', 'feature-x']);

    // Upload should have been called twice (main + feature-x)
    t.is(stubs.upload.callCount, 2);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject logs when no non-main branches exist', async t => {
  const stubs = setupStubs();
  // Default setupStubs already returns only main branch
  // Just add the branch-related stubs that won't be exercised
  stubs.extractBranch = sinon.stub(DataExtractor.prototype, 'extractBranch');
  stubs.isBranchCompleted = sinon.stub(StateTracker.prototype, 'isBranchCompleted');
  stubs.markBranchCompleted = sinon.stub(StateTracker.prototype, 'markBranchCompleted');
  try {
    const result = await transferProject(baseOptions({ skipConnectionTest: true }));

    // extractBranch should never be called (no non-main branches)
    t.is(stubs.extractBranch.callCount, 0);

    // Only main branch transferred
    t.deepEqual(result.stats.branchesTransferred, ['main']);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject with syncAllBranches=false skips non-main branches', async t => {
  const stubs = setupBranchStubs();
  try {
    const result = await transferProject(baseOptions({
      skipConnectionTest: true,
      transferConfig: { mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100, syncAllBranches: false }
    }));

    // extractBranch should never be called when syncAllBranches is false
    t.is(stubs.extractBranch.callCount, 0);

    // Only main branch transferred
    t.deepEqual(result.stats.branchesTransferred, ['main']);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject accumulates stats across branches', async t => {
  const stubs = setupBranchStubs();
  try {
    const result = await transferProject(baseOptions({ skipConnectionTest: true }));

    // Main branch stats: 1 issue, 1 component, 1 source, 1000 loc
    // Each non-main branch: 2 issues, 1 component, 1 source, 500 loc (x2 branches)
    t.is(result.stats.issuesTransferred, 1 + 2 + 2);  // 5
    t.is(result.stats.componentsTransferred, 1 + 1 + 1);  // 3
    t.is(result.stats.sourcesTransferred, 1 + 1 + 1);  // 3
    t.is(result.stats.linesOfCode, 1000 + 500 + 500);  // 2000
    t.is(result.stats.branchesTransferred.length, 3);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject marks branches completed in incremental mode', async t => {
  const stubs = setupBranchStubs();
  try {
    await transferProject(baseOptions({
      skipConnectionTest: true,
      transferConfig: { mode: 'incremental', stateFile: '/tmp/inc-state.json', batchSize: 100 }
    }));

    // markBranchCompleted should be called for main + develop + feature-x
    t.is(stubs.markBranchCompleted.callCount, 3);
    t.is(stubs.markBranchCompleted.firstCall.args[0], 'main');
    t.is(stubs.markBranchCompleted.secondCall.args[0], 'develop');
    t.is(stubs.markBranchCompleted.thirdCall.args[0], 'feature-x');
  } finally {
    sinon.restore();
  }
});

// ---------------------------------------------------------------------------
// Line 60: sqProject.name || null — when name is falsy
// ---------------------------------------------------------------------------

test.serial('transferProject falls back to null when sqProject.name is empty', async t => {
  const stubs = setupStubs();
  // getProject returns an object with empty/falsy name
  stubs.sqGetProject.resolves({ name: '' });
  try {
    await transferProject(baseOptions({ skipConnectionTest: true }));
    // ensureProject should have been called with null ('' || null => null)
    t.true(stubs.scEnsure.calledWith(null));
  } finally {
    sinon.restore();
  }
});

// ---------------------------------------------------------------------------
// Line 106: extractedData.project.branches || [] — when branches is undefined
// ---------------------------------------------------------------------------

test.serial('transferProject handles missing branches array in extractedData', async t => {
  const stubs = setupStubs();
  // extractAll returns data where project.branches is undefined
  stubs.extractAll.resolves({
    project: { /* branches is missing/undefined */ },
    issues: [{ key: 'i1' }],
    components: [{ key: 'c1' }],
    sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }],
    measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  // Add branch stubs so the filter logic is entered
  stubs.extractBranch = sinon.stub(DataExtractor.prototype, 'extractBranch');
  stubs.isBranchCompleted = sinon.stub(StateTracker.prototype, 'isBranchCompleted');
  stubs.markBranchCompleted = sinon.stub(StateTracker.prototype, 'markBranchCompleted');
  try {
    const result = await transferProject(baseOptions({ skipConnectionTest: true }));
    // Since branches is undefined, || [] gives empty array, no non-main branches
    t.is(stubs.extractBranch.callCount, 0);
    // Only main branch transferred
    t.deepEqual(result.stats.branchesTransferred, ['main']);
  } finally {
    sinon.restore();
  }
});

// ---------------------------------------------------------------------------
// Lines 212-217: nclocMeasure fallback branches
// ---------------------------------------------------------------------------

test.serial('transferProject returns 0 linesOfCode when measures.measures is undefined', async t => {
  const stubs = setupStubs();
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [],
    components: [],
    sources: [],
    metrics: [],
    measures: { /* measures property is missing */ }
  });
  try {
    const result = await transferProject(baseOptions({ skipConnectionTest: true }));
    t.is(result.stats.linesOfCode, 0);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject returns 0 linesOfCode when ncloc value is non-numeric', async t => {
  const stubs = setupStubs();
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [],
    components: [],
    sources: [],
    metrics: [],
    measures: { measures: [{ metric: 'ncloc', value: 'not-a-number' }] }
  });
  try {
    const result = await transferProject(baseOptions({ skipConnectionTest: true }));
    // parseInt('not-a-number', 10) => NaN, NaN || 0 => 0
    t.is(result.stats.linesOfCode, 0);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject returns 0 linesOfCode when no ncloc measure exists', async t => {
  const stubs = setupStubs();
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [],
    components: [],
    sources: [],
    metrics: [],
    measures: { measures: [{ metric: 'coverage', value: '80' }] }
  });
  try {
    const result = await transferProject(baseOptions({ skipConnectionTest: true }));
    // No ncloc measure found => 0
    t.is(result.stats.linesOfCode, 0);
  } finally {
    sinon.restore();
  }
});

// ---------------------------------------------------------------------------
// includeBranches filtering (CSV-driven per-project branch selection)
// ---------------------------------------------------------------------------

test.serial('transferProject with includeBranches filters non-main branches', async t => {
  const stubs = setupBranchStubs();
  // Stub getBranches for the main branch check
  stubs.sqGetBranches = sinon.stub(SonarQubeClient.prototype, 'getBranches').resolves([
    { name: 'main', isMain: true },
    { name: 'develop', isMain: false },
    { name: 'feature-x', isMain: false }
  ]);
  try {
    const result = await transferProject(baseOptions({
      skipConnectionTest: true,
      transferConfig: {
        mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100,
        includeBranches: new Set(['main', 'develop'])
      }
    }));

    // Only develop should be extracted as a non-main branch (feature-x excluded)
    t.is(stubs.extractBranch.callCount, 1);
    t.is(stubs.extractBranch.firstCall.args[0], 'develop');

    // main + develop transferred
    t.deepEqual(result.stats.branchesTransferred, ['main', 'develop']);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject with includeBranches excluding main branch skips entire project', async t => {
  const stubs = setupBranchStubs();
  stubs.sqGetBranches = sinon.stub(SonarQubeClient.prototype, 'getBranches').resolves([
    { name: 'main', isMain: true },
    { name: 'develop', isMain: false }
  ]);
  try {
    const result = await transferProject(baseOptions({
      skipConnectionTest: true,
      transferConfig: {
        mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100,
        includeBranches: new Set(['develop']) // main not included
      }
    }));

    // Project skipped entirely — no extraction or upload
    t.is(stubs.extractAll.callCount, 0);
    t.is(stubs.upload.callCount, 0);
    t.deepEqual(result.stats.branchesTransferred, []);
    t.is(result.stats.issuesTransferred, 0);
  } finally {
    sinon.restore();
  }
});

test.serial('transferProject with includeBranches=null transfers all branches', async t => {
  const stubs = setupBranchStubs();
  try {
    const result = await transferProject(baseOptions({
      skipConnectionTest: true,
      transferConfig: {
        mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100,
        includeBranches: null
      }
    }));

    // All non-main branches extracted
    t.is(stubs.extractBranch.callCount, 2);
    t.deepEqual(result.stats.branchesTransferred, ['main', 'develop', 'feature-x']);
  } finally {
    sinon.restore();
  }
});
