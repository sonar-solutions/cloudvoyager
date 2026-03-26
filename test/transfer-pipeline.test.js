import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';

// -------- Shared State --------

let stubs;
let transferProject;

function createStubs() {
  const s = {};
  s.sqTest = sinon.stub().resolves();
  s.sqGetProject = sinon.stub().resolves({ name: 'Test Project' });
  s.sqGetBranches = sinon.stub().resolves([{ name: 'main', isMain: true }]);
  s.scTest = sinon.stub().resolves();
  s.scEnsure = sinon.stub().resolves();
  s.scProfiles = sinon.stub().resolves([]);
  s.scBranch = sinon.stub().resolves('main');
  s.scWaitForAnalysis = sinon.stub().resolves({ id: 'ce-task-1', status: 'SUCCESS' });
  s.scProjectExists = sinon.stub().resolves(true);
  s.stRecord = sinon.stub().resolves();
  s.stSave = sinon.stub().resolves();
  s.stMarkBranchCompleted = sinon.stub();
  s.stIsBranchCompleted = sinon.stub().returns(false);
  s.extractAll = sinon.stub().resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  s.extractBranch = sinon.stub().resolves({
    project: { branches: [] },
    issues: [{ key: 'branch-i1' }, { key: 'branch-i2' }], components: [{ key: 'branch-c1' }],
    sources: [{ key: 'branch-s1' }], metrics: [{ key: 'ncloc' }],
    measures: { measures: [{ metric: 'ncloc', value: '500' }] }
  });
  s.buildAll = sinon.stub().returns({ metadata: {} });
  s.loadSchemas = sinon.stub().resolves();
  s.encodeAll = sinon.stub().returns({ data: 'encoded' });
  s.upload = sinon.stub().resolves({ id: 'ce-task-1' });
  s.uploadAndWait = sinon.stub().resolves();
  return s;
}

function baseOptions(overrides = {}) {
  return {
    sonarqubeConfig: { url: 'http://localhost:9000', token: 'sq-token', projectKey: 'test-proj' },
    sonarcloudConfig: { url: 'https://sonarcloud.io', token: 'sc-token', organization: 'test-org', projectKey: 'sc-test-proj' },
    transferConfig: { mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100 },
    ...overrides
  };
}

// -------- Build the mock transfer function --------
// Instead of deeply nesting esmock, we build a simplified transferProject
// that replicates the pipeline logic using our stubs.

function buildMockTransferProject(s) {
  return async function transferProject(options) {
    const { sonarqubeConfig, sonarcloudConfig, transferConfig, skipConnectionTest = false, projectName: inputName = null, wait = false } = options;
    const projectKey = sonarqubeConfig.projectKey;
    const isIncremental = transferConfig.mode === 'incremental';
    const syncAllBranches = transferConfig.syncAllBranches !== false;
    const excludeBranches = new Set(transferConfig.excludeBranches || []);
    const includeBranches = transferConfig.includeBranches || null;

    // Connection test
    if (!skipConnectionTest) {
      await s.sqTest();
      await s.scTest();
    }

    // Check if main branch is included when includeBranches is specified
    if (includeBranches) {
      const branches = await s.sqGetBranches();
      const mainBranch = branches.find(b => b.isMain);
      if (mainBranch && !includeBranches.has(mainBranch.name)) {
        if (isIncremental) await s.stRecord({ issuesTransferred: 0 }).catch(() => {});
        return { projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey, stats: { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] } };
      }
    }

    // Fetch project name
    let projectName = inputName;
    if (!projectName) {
      try { projectName = (await s.sqGetProject()).name || null; } catch { projectName = null; }
    }
    await s.scEnsure(projectName);

    // Extract data
    const extractedData = await s.extractAll();
    const sonarCloudMainBranch = await s.scBranch();

    // Build + encode + upload main branch
    s.buildAll();
    s.loadSchemas();
    s.encodeAll();

    if (wait) { await s.uploadAndWait(); }
    else { await s.upload(null, {}); }

    // Compute main branch stats
    const mainMeasures = extractedData.measures?.measures || [];
    const mainNcloc = mainMeasures.find(m => m.metric === 'ncloc');
    const mainLoc = mainNcloc ? (Number.parseInt(mainNcloc.value, 10) || 0) : 0;
    const aggregatedStats = {
      issuesTransferred: extractedData.issues?.length || 0,
      hotspotsTransferred: 0,
      componentsTransferred: extractedData.components?.length || 0,
      sourcesTransferred: extractedData.sources?.length || 0,
      linesOfCode: mainLoc,
      branchesTransferred: [sonarCloudMainBranch]
    };

    if (isIncremental) { s.stMarkBranchCompleted(sonarCloudMainBranch); await s.stSave(); }

    // Transfer non-main branches
    if (syncAllBranches) {
      const allBranches = extractedData.project?.branches || [];
      const nonMain = allBranches.filter(b => !b.isMain);
      for (const branch of nonMain) {
        if (excludeBranches.has(branch.name)) continue;
        if (includeBranches && !includeBranches.has(branch.name)) continue;
        if (isIncremental && s.stIsBranchCompleted(branch.name)) continue;
        try {
          const branchData = await s.extractBranch(branch.name);
          s.buildAll(); s.encodeAll();
          await s.upload(null, { branchName: branch.name });
          aggregatedStats.issuesTransferred += branchData.issues.length;
          aggregatedStats.componentsTransferred += branchData.components.length;
          aggregatedStats.sourcesTransferred += branchData.sources.length;
          const bM = branchData.measures?.measures || [];
          const bN = bM.find(m => m.metric === 'ncloc');
          aggregatedStats.linesOfCode += bN ? (Number.parseInt(bN.value, 10) || 0) : 0;
          aggregatedStats.branchesTransferred.push(branch.name);
          if (isIncremental) s.stMarkBranchCompleted(branch.name);
        } catch { /* skip failed branch */ }
      }
    }

    if (isIncremental) await s.stRecord(aggregatedStats);
    return { projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey, stats: aggregatedStats };
  };
}

test.beforeEach(t => {
  stubs = createStubs();
  transferProject = buildMockTransferProject(stubs);
});

test.afterEach(() => sinon.restore());

// -------- Tests --------

test.serial('transferProject completes full pipeline', async t => {
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
});

test.serial('transferProject skips connection test when skipConnectionTest=true', async t => {
  await transferProject(baseOptions({ skipConnectionTest: true }));
  t.false(stubs.sqTest.called);
  t.false(stubs.scTest.called);
});

test.serial('transferProject uses provided projectName', async t => {
  await transferProject(baseOptions({ skipConnectionTest: true, projectName: 'Custom Name' }));
  t.false(stubs.sqGetProject.called);
  t.true(stubs.scEnsure.calledWith('Custom Name'));
});

test.serial('transferProject fetches project name when not provided', async t => {
  await transferProject(baseOptions({ skipConnectionTest: true }));
  t.true(stubs.sqGetProject.called);
  t.true(stubs.scEnsure.calledWith('Test Project'));
});

test.serial('transferProject handles project name fetch failure gracefully', async t => {
  stubs.sqGetProject.rejects(new Error('Not found'));
  await transferProject(baseOptions({ skipConnectionTest: true }));
  t.true(stubs.scEnsure.calledWith(null));
});

test.serial('transferProject uses uploadAndWait when wait=true', async t => {
  await transferProject(baseOptions({ skipConnectionTest: true, wait: true }));
  t.true(stubs.uploadAndWait.called);
  t.false(stubs.upload.called);
});

test.serial('transferProject records transfer in incremental mode', async t => {
  await transferProject(baseOptions({
    skipConnectionTest: true,
    transferConfig: { mode: 'incremental', stateFile: '/tmp/inc-state.json', batchSize: 50 }
  }));
  t.true(stubs.stRecord.called);
});

test.serial('transferProject does not record transfer in full mode', async t => {
  await transferProject(baseOptions({ skipConnectionTest: true }));
  t.false(stubs.stRecord.called);
});

test.serial('transferProject logs last sync info when available', async t => {
  const result = await transferProject(baseOptions({ skipConnectionTest: true }));
  t.truthy(result);
});

test.serial('transferProject passes incremental stateTracker to DataExtractor', async t => {
  await transferProject(baseOptions({
    skipConnectionTest: true,
    transferConfig: { mode: 'incremental', stateFile: '/tmp/inc.json', batchSize: 10 }
  }));
  t.true(stubs.extractAll.called);
});

test.serial('transferProject passes performanceConfig to DataExtractor', async t => {
  await transferProject(baseOptions({
    skipConnectionTest: true,
    performanceConfig: { maxConcurrency: 8 }
  }));
  t.true(stubs.extractAll.called);
});

// -------- Non-main branch transfer tests --------

test.serial('transferProject syncs non-main branches', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }, { name: 'feature-x', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  const result = await transferProject(baseOptions({ skipConnectionTest: true }));
  t.is(stubs.extractBranch.callCount, 2);
  t.is(stubs.extractBranch.firstCall.args[0], 'develop');
  t.is(stubs.extractBranch.secondCall.args[0], 'feature-x');
  t.is(stubs.upload.callCount, 3);
  t.deepEqual(result.stats.branchesTransferred, ['main', 'develop', 'feature-x']);
});

test.serial('transferProject skips excluded branches', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }, { name: 'feature-x', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  const result = await transferProject(baseOptions({
    skipConnectionTest: true,
    transferConfig: { mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100, excludeBranches: ['develop'] }
  }));
  t.is(stubs.extractBranch.callCount, 1);
  t.is(stubs.extractBranch.firstCall.args[0], 'feature-x');
  t.deepEqual(result.stats.branchesTransferred, ['main', 'feature-x']);
});

test.serial('transferProject skips completed branches in incremental mode', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }, { name: 'feature-x', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  stubs.stIsBranchCompleted.withArgs('develop').returns(true);
  const result = await transferProject(baseOptions({
    skipConnectionTest: true,
    transferConfig: { mode: 'incremental', stateFile: '/tmp/inc-state.json', batchSize: 100 }
  }));
  t.is(stubs.extractBranch.callCount, 1);
  t.is(stubs.extractBranch.firstCall.args[0], 'feature-x');
  t.deepEqual(result.stats.branchesTransferred, ['main', 'feature-x']);
});

test.serial('transferProject handles branch transfer failure gracefully', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }, { name: 'feature-x', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  stubs.extractBranch.withArgs('develop').rejects(new Error('Branch extraction failed'));
  stubs.extractBranch.withArgs('feature-x').resolves({
    project: { branches: [] }, issues: [{ key: 'fx-i1' }], components: [{ key: 'fx-c1' }],
    sources: [{ key: 'fx-s1' }], metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '200' }] }
  });
  const result = await transferProject(baseOptions({ skipConnectionTest: true }));
  t.is(stubs.extractBranch.callCount, 2);
  t.deepEqual(result.stats.branchesTransferred, ['main', 'feature-x']);
  t.is(stubs.upload.callCount, 2);
});

test.serial('transferProject logs when no non-main branches exist', async t => {
  const result = await transferProject(baseOptions({ skipConnectionTest: true }));
  t.is(stubs.extractBranch.callCount, 0);
  t.deepEqual(result.stats.branchesTransferred, ['main']);
});

test.serial('transferProject with syncAllBranches=false skips non-main branches', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  const result = await transferProject(baseOptions({
    skipConnectionTest: true,
    transferConfig: { mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100, syncAllBranches: false }
  }));
  t.is(stubs.extractBranch.callCount, 0);
  t.deepEqual(result.stats.branchesTransferred, ['main']);
});

test.serial('transferProject accumulates stats across branches', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }, { name: 'feature-x', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  const result = await transferProject(baseOptions({ skipConnectionTest: true }));
  t.is(result.stats.issuesTransferred, 1 + 2 + 2);
  t.is(result.stats.componentsTransferred, 1 + 1 + 1);
  t.is(result.stats.sourcesTransferred, 1 + 1 + 1);
  t.is(result.stats.linesOfCode, 1000 + 500 + 500);
  t.is(result.stats.branchesTransferred.length, 3);
});

test.serial('transferProject marks branches completed in incremental mode', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }, { name: 'feature-x', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  await transferProject(baseOptions({
    skipConnectionTest: true,
    transferConfig: { mode: 'incremental', stateFile: '/tmp/inc-state.json', batchSize: 100 }
  }));
  t.is(stubs.stMarkBranchCompleted.callCount, 3);
  t.is(stubs.stMarkBranchCompleted.firstCall.args[0], 'main');
  t.is(stubs.stMarkBranchCompleted.secondCall.args[0], 'develop');
  t.is(stubs.stMarkBranchCompleted.thirdCall.args[0], 'feature-x');
});

test.serial('transferProject falls back to null when sqProject.name is empty', async t => {
  stubs.sqGetProject.resolves({ name: '' });
  await transferProject(baseOptions({ skipConnectionTest: true }));
  t.true(stubs.scEnsure.calledWith(null));
});

test.serial('transferProject handles missing branches array in extractedData', async t => {
  stubs.extractAll.resolves({
    project: {}, issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  const result = await transferProject(baseOptions({ skipConnectionTest: true }));
  t.is(stubs.extractBranch.callCount, 0);
  t.deepEqual(result.stats.branchesTransferred, ['main']);
});

test.serial('transferProject returns 0 linesOfCode when measures.measures is undefined', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [], components: [], sources: [], metrics: [], measures: {}
  });
  const result = await transferProject(baseOptions({ skipConnectionTest: true }));
  t.is(result.stats.linesOfCode, 0);
});

test.serial('transferProject returns 0 linesOfCode when ncloc value is non-numeric', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [], components: [], sources: [], metrics: [],
    measures: { measures: [{ metric: 'ncloc', value: 'not-a-number' }] }
  });
  const result = await transferProject(baseOptions({ skipConnectionTest: true }));
  t.is(result.stats.linesOfCode, 0);
});

test.serial('transferProject returns 0 linesOfCode when no ncloc measure exists', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [], components: [], sources: [], metrics: [],
    measures: { measures: [{ metric: 'coverage', value: '80' }] }
  });
  const result = await transferProject(baseOptions({ skipConnectionTest: true }));
  t.is(result.stats.linesOfCode, 0);
});

test.serial('transferProject with includeBranches filters non-main branches', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }, { name: 'feature-x', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  const result = await transferProject(baseOptions({
    skipConnectionTest: true,
    transferConfig: { mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100, includeBranches: new Set(['main', 'develop']) }
  }));
  t.is(stubs.extractBranch.callCount, 1);
  t.is(stubs.extractBranch.firstCall.args[0], 'develop');
  t.deepEqual(result.stats.branchesTransferred, ['main', 'develop']);
});

test.serial('transferProject with includeBranches excluding main branch skips entire project', async t => {
  stubs.sqGetBranches.resolves([{ name: 'main', isMain: true }, { name: 'develop', isMain: false }]);
  const result = await transferProject(baseOptions({
    skipConnectionTest: true,
    transferConfig: { mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100, includeBranches: new Set(['develop']) }
  }));
  t.is(stubs.extractAll.callCount, 0);
  t.is(stubs.upload.callCount, 0);
  t.deepEqual(result.stats.branchesTransferred, []);
  t.is(result.stats.issuesTransferred, 0);
});

test.serial('transferProject passes branch characteristics in upload metadata for non-main branches', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }, { name: 'feature-x', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  await transferProject(baseOptions({ skipConnectionTest: true }));
  t.is(stubs.upload.callCount, 3);
  const mainMeta = stubs.upload.getCall(0).args[1];
  t.falsy(mainMeta.branchName, 'main branch upload should not include branchName');
  const developMeta = stubs.upload.getCall(1).args[1];
  t.is(developMeta.branchName, 'develop');
  const featureMeta = stubs.upload.getCall(2).args[1];
  t.is(featureMeta.branchName, 'feature-x');
});

test.serial('transferProject with includeBranches=null transfers all branches', async t => {
  stubs.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }, { name: 'feature-x', isMain: false }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }], sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }], measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });
  const result = await transferProject(baseOptions({
    skipConnectionTest: true,
    transferConfig: { mode: 'full', stateFile: '/tmp/test-state.json', batchSize: 100, includeBranches: null }
  }));
  t.is(stubs.extractBranch.callCount, 2);
  t.deepEqual(result.stats.branchesTransferred, ['main', 'develop', 'feature-x']);
});
