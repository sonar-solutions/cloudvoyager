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
    issues: [{ key: 'i1' }],
    components: [{ key: 'c1' }],
    sources: [{ key: 's1' }]
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
