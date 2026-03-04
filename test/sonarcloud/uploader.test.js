import test from 'ava';
import sinon from 'sinon';
import { ReportUploader } from '../../src/sonarcloud/uploader.js';
import { SonarCloudAPIError } from '../../src/utils/errors.js';

function mockClient() {
  return {
    ensureProject: sinon.stub().resolves(),
    waitForAnalysis: sinon.stub().resolves({ status: 'SUCCESS' }),
    projectKey: 'test-project',
    organization: 'test-org',
    client: {
      post: sinon.stub().resolves({ data: { ceTask: { id: 'task-1' } } })
    }
  };
}

function mockReport() {
  return {
    metadata: Buffer.from('metadata'),
    components: [Buffer.from('comp1')],
    issues: new Map([[1, Buffer.from('issue1')]]),
    measures: new Map([[1, Buffer.from('measure1')]]),
    sourceFilesText: [{ componentRef: 1, text: 'source code' }],
    activeRules: Buffer.from('rules'),
    changesets: new Map([[1, Buffer.from('changeset1')]])
  };
}

test.afterEach(() => sinon.restore());

test('ReportUploader constructor sets client', t => {
  const client = mockClient();
  const uploader = new ReportUploader(client);
  t.is(uploader.client, client);
});

test('upload ensures project and submits report', async t => {
  const client = mockClient();
  const uploader = new ReportUploader(client);
  const result = await uploader.upload(mockReport(), { version: '1.0' });
  t.truthy(result.id);
  t.true(client.ensureProject.called);
});

test('upload throws on error', async t => {
  const client = mockClient();
  client.ensureProject.rejects(new Error('fail'));
  const uploader = new ReportUploader(client);
  await t.throwsAsync(() => uploader.upload(mockReport(), {}));
});

test('prepareReportData creates zip buffer', t => {
  const client = mockClient();
  const uploader = new ReportUploader(client);
  const report = mockReport();
  const result = uploader.prepareReportData(report, {});
  t.true(Buffer.isBuffer(result));
  t.true(result.length > 0);
});

test('prepareReportData handles empty optional fields', t => {
  const client = mockClient();
  const uploader = new ReportUploader(client);
  const report = {
    metadata: Buffer.from('meta'),
    components: [Buffer.from('comp')],
    issues: new Map(),
    measures: new Map(),
    sourceFilesText: [],
    activeRules: null,
    changesets: null
  };
  const result = uploader.prepareReportData(report, {});
  t.true(Buffer.isBuffer(result));
});

test('prepareReportData handles no sourceFilesText', t => {
  const client = mockClient();
  const uploader = new ReportUploader(client);
  const report = {
    metadata: Buffer.from('meta'),
    components: [Buffer.from('comp')],
    issues: new Map(),
    measures: new Map()
  };
  const result = uploader.prepareReportData(report, {});
  t.true(Buffer.isBuffer(result));
});

test('submitToComputeEngine submits form data', async t => {
  const client = mockClient();
  const uploader = new ReportUploader(client);
  const result = await uploader.submitToComputeEngine(Buffer.from('data'), { version: '1.0' });
  t.truthy(result.id);
});

test('submitToComputeEngine includes branch characteristics for non-main branches', async t => {
  const client = mockClient();
  const uploader = new ReportUploader(client);
  const metadata = { version: '1.0', branchName: 'feature/feature-x', branchType: 'BRANCH' };
  const result = await uploader.submitToComputeEngine(Buffer.from('data'), metadata);
  t.truthy(result.id);
  // Verify the form data sent to the post call includes the characteristic fields
  const postCall = client.client.post.getCall(0);
  const bodyBuffer = postCall.args[1];
  const bodyStr = bodyBuffer.toString('utf-8');
  t.true(bodyStr.includes('branch=feature/feature-x'), 'should include branch characteristic');
  t.true(bodyStr.includes('branchType=BRANCH'), 'should include branchType characteristic');
});

test('submitToComputeEngine handles response without ceTask', async t => {
  const client = mockClient();
  client.client.post.resolves({ data: { taskId: 'task-2' } });
  const uploader = new ReportUploader(client);
  const result = await uploader.submitToComputeEngine(Buffer.from('data'), {});
  t.is(result.id, 'task-2');
});

test('submitToComputeEngine throws on response error', async t => {
  const client = mockClient();
  const error = new Error('Bad request');
  error.response = { status: 400, data: { errors: [{ msg: 'Bad request' }] } };
  client.client.post.rejects(error);
  const uploader = new ReportUploader(client);
  await t.throwsAsync(() => uploader.submitToComputeEngine(Buffer.from('data'), {}), {
    instanceOf: SonarCloudAPIError
  });
});

test('submitToComputeEngine re-throws non-response errors', async t => {
  const client = mockClient();
  client.client.post.rejects(new Error('network error'));
  const uploader = new ReportUploader(client);
  await t.throwsAsync(() => uploader.submitToComputeEngine(Buffer.from('data'), {}));
});

test('uploadAndWait uploads and waits', async t => {
  const client = mockClient();
  const uploader = new ReportUploader(client);
  const result = await uploader.uploadAndWait(mockReport(), { version: '1.0' }, 5);
  t.is(result.status, 'SUCCESS');
});

test('validateReport returns true for valid report', t => {
  const uploader = new ReportUploader(mockClient());
  const result = uploader.validateReport(mockReport());
  t.true(result);
});

test('validateReport throws for missing metadata', t => {
  const uploader = new ReportUploader(mockClient());
  t.throws(() => uploader.validateReport({ components: [Buffer.from('c')] }), {
    instanceOf: SonarCloudAPIError, message: /metadata/
  });
});

test('validateReport throws for missing components', t => {
  const uploader = new ReportUploader(mockClient());
  t.throws(() => uploader.validateReport({ metadata: Buffer.from('m'), components: [] }), {
    instanceOf: SonarCloudAPIError, message: /components/
  });
});

test('validateReport throws for null components', t => {
  const uploader = new ReportUploader(mockClient());
  t.throws(() => uploader.validateReport({ metadata: Buffer.from('m') }), {
    instanceOf: SonarCloudAPIError
  });
});

// ============================================================================
// submitToComputeEngine - timeout and retry logic
// ============================================================================

function mockClientWithGet() {
  return {
    ensureProject: sinon.stub().resolves(),
    waitForAnalysis: sinon.stub().resolves({ status: 'SUCCESS' }),
    getMostRecentCeTask: sinon.stub().resolves(null),
    projectKey: 'test-project',
    organization: 'test-org',
    client: {
      post: sinon.stub().resolves({ data: { ceTask: { id: 'task-1' } } }),
      get: sinon.stub().resolves({ data: { tasks: [] } })
    }
  };
}

test.serial('submitToComputeEngine falls back to activity lookup on timeout and finds task', async t => {
  const client = mockClientWithGet();

  // Post never resolves (simulates server not responding)
  client.client.post = sinon.stub().returns(new Promise(() => {}));

  const now = Date.now();
  client.getMostRecentCeTask = sinon.stub().resolves({
    id: 'found-task-1',
    status: 'PENDING',
    submittedAt: new Date(now).toISOString()
  });

  const uploader = new ReportUploader(client);
  const clock = sinon.useFakeTimers({ now, shouldAdvanceTime: false });

  try {
    const resultPromise = uploader.submitToComputeEngine(Buffer.from('data'), { version: '1.0' });
    await clock.tickAsync(61_000);
    const result = await resultPromise;
    t.is(result.id, 'found-task-1');
    t.is(result.status, 'PENDING');
    t.true(client.getMostRecentCeTask.called);
  } finally {
    clock.restore();
  }
});

test.serial('submitToComputeEngine retries after timeout when no task found in activity', async t => {
  const client = mockClientWithGet();

  // Post never responds (both attempts)
  client.client.post = sinon.stub().returns(new Promise(() => {}));
  client.getMostRecentCeTask = sinon.stub().resolves(null);

  const uploader = new ReportUploader(client);
  const now = Date.now();
  const clock = sinon.useFakeTimers({ now, shouldAdvanceTime: false });

  try {
    const resultPromise = uploader.submitToComputeEngine(Buffer.from('data'), { version: '1.0' });
    await clock.tickAsync(200_000);

    await t.throwsAsync(() => resultPromise, {
      instanceOf: SonarCloudAPIError,
      message: /Report submission failed after 2 attempts/
    });
  } finally {
    clock.restore();
  }
});

test.serial('submitToComputeEngine second attempt succeeds after first timeout', async t => {
  const client = mockClientWithGet();
  const now = Date.now();

  let callCount = 0;
  client.client.post = sinon.stub().callsFake(() => {
    callCount++;
    if (callCount === 1) {
      return new Promise(() => {}); // hangs
    }
    return Promise.resolve({ data: { ceTask: { id: 'task-retry-success' } } });
  });

  client.getMostRecentCeTask = sinon.stub().resolves(null);

  const uploader = new ReportUploader(client);
  const clock = sinon.useFakeTimers({ now, shouldAdvanceTime: false });

  try {
    const resultPromise = uploader.submitToComputeEngine(Buffer.from('data'), { version: '1.0' });
    await clock.tickAsync(80_000);
    const result = await resultPromise;
    t.is(result.id, 'task-retry-success');
    t.is(callCount, 2);
  } finally {
    clock.restore();
  }
});

// ============================================================================
// _findTaskFromActivity
// ============================================================================

test('_findTaskFromActivity returns task when found within time window', async t => {
  const client = mockClientWithGet();
  const now = Date.now();
  client.getMostRecentCeTask = sinon.stub().resolves({
    id: 'activity-task-1',
    status: 'SUCCESS',
    submittedAt: new Date(now).toISOString()
  });

  const uploader = new ReportUploader(client);
  const result = await uploader._findTaskFromActivity(now, 3, 10);

  t.deepEqual(result, { id: 'activity-task-1', status: 'SUCCESS' });
  t.is(client.getMostRecentCeTask.callCount, 1);
});

test('_findTaskFromActivity returns null when no matching task found after all checks', async t => {
  const client = mockClientWithGet();
  const now = Date.now();
  client.getMostRecentCeTask = sinon.stub().resolves(null);

  const uploader = new ReportUploader(client);
  // Use 1ms interval to avoid needing fake timers
  const result = await uploader._findTaskFromActivity(now, 3, 1);

  t.is(result, null);
  t.is(client.getMostRecentCeTask.callCount, 3);
});

test('_findTaskFromActivity returns null when task is too old', async t => {
  const client = mockClientWithGet();
  const now = Date.now();
  // Task was submitted way before our upload
  client.getMostRecentCeTask = sinon.stub().resolves({
    id: 'old-task',
    status: 'SUCCESS',
    submittedAt: new Date(now - 120_000).toISOString() // 2 minutes before
  });

  const uploader = new ReportUploader(client);
  const result = await uploader._findTaskFromActivity(now, 2, 1);

  t.is(result, null);
  t.is(client.getMostRecentCeTask.callCount, 2);
});

test('_findTaskFromActivity finds task on second check', async t => {
  const client = mockClientWithGet();
  const now = Date.now();

  client.getMostRecentCeTask = sinon.stub()
    .onFirstCall().resolves(null)
    .onSecondCall().resolves({
      id: 'delayed-task',
      status: 'IN_PROGRESS',
      submittedAt: new Date(now).toISOString()
    });

  const uploader = new ReportUploader(client);
  const result = await uploader._findTaskFromActivity(now, 3, 1);

  t.deepEqual(result, { id: 'delayed-task', status: 'IN_PROGRESS' });
  t.is(client.getMostRecentCeTask.callCount, 2);
});

test('_findTaskFromActivity accepts task submitted within 30s before upload start', async t => {
  const client = mockClientWithGet();
  const now = Date.now();
  // Task submitted 20 seconds before upload started (within 30s tolerance)
  client.getMostRecentCeTask = sinon.stub().resolves({
    id: 'slightly-early-task',
    status: 'SUCCESS',
    submittedAt: new Date(now - 20_000).toISOString()
  });

  const uploader = new ReportUploader(client);
  const result = await uploader._findTaskFromActivity(now, 1, 10);

  t.deepEqual(result, { id: 'slightly-early-task', status: 'SUCCESS' });
});

test('_findTaskFromActivity handles task without submittedAt', async t => {
  const client = mockClientWithGet();
  const now = Date.now();
  // Task without submittedAt - submittedAt will be 0, which is < uploadStart - 30_000
  client.getMostRecentCeTask = sinon.stub().resolves({
    id: 'no-timestamp-task',
    status: 'SUCCESS'
  });

  const uploader = new ReportUploader(client);
  const result = await uploader._findTaskFromActivity(now, 2, 1);

  t.is(result, null);
});

// ============================================================================
// submitToComputeEngine - HTTP error handling edge cases
// ============================================================================

test('submitToComputeEngine handles response error with data.message fallback', async t => {
  const client = mockClient();
  const error = new Error('Server error');
  error.response = { status: 500, data: { message: 'Internal server error' } };
  client.client.post.rejects(error);
  const uploader = new ReportUploader(client);
  const err = await t.throwsAsync(() => uploader.submitToComputeEngine(Buffer.from('data'), {}), {
    instanceOf: SonarCloudAPIError
  });
  t.true(err.message.includes('Internal server error'));
});

test('submitToComputeEngine handles response error with no error details', async t => {
  const client = mockClient();
  const error = new Error('Unknown');
  error.response = { status: 502, data: {} };
  client.client.post.rejects(error);
  const uploader = new ReportUploader(client);
  const err = await t.throwsAsync(() => uploader.submitToComputeEngine(Buffer.from('data'), {}), {
    instanceOf: SonarCloudAPIError
  });
  t.true(err.message.includes('Unknown error'));
});

test('submitToComputeEngine handles response with task field instead of ceTask', async t => {
  const client = mockClient();
  client.client.post.resolves({ data: { task: { id: 'task-from-task-field' } } });
  const uploader = new ReportUploader(client);
  const result = await uploader.submitToComputeEngine(Buffer.from('data'), {});
  t.is(result.id, 'task-from-task-field');
});

test('submitToComputeEngine handles response with unknown id fallback', async t => {
  const client = mockClient();
  client.client.post.resolves({ data: {} });
  const uploader = new ReportUploader(client);
  const result = await uploader.submitToComputeEngine(Buffer.from('data'), {});
  t.is(result.id, 'unknown');
});

// ============================================================================
// uploadAndWait
// ============================================================================

test('uploadAndWait passes maxWaitSeconds to waitForAnalysis', async t => {
  const client = mockClient();
  const uploader = new ReportUploader(client);
  await uploader.uploadAndWait(mockReport(), { version: '1.0' }, 120);
  t.true(client.waitForAnalysis.calledOnce);
  // The second arg to waitForAnalysis should be the maxWaitSeconds
  t.is(client.waitForAnalysis.firstCall.args[1], 120);
});

// ============================================================================
// onUploadProgress callback
// ============================================================================

test('submitToComputeEngine invokes onUploadProgress with total (percentage path)', async t => {
  const client = mockClient();
  let capturedOnUploadProgress = null;

  client.client.post = sinon.stub().callsFake((_url, _data, options) => {
    capturedOnUploadProgress = options.onUploadProgress;
    return Promise.resolve({ data: { ceTask: { id: 'task-progress-1' } } });
  });

  const uploader = new ReportUploader(client);
  await uploader.submitToComputeEngine(Buffer.from('data'), { version: '1.0' });

  t.truthy(capturedOnUploadProgress, 'onUploadProgress callback should have been captured');

  // Invoke with progressEvent that HAS total (covers the if branch with percentage)
  capturedOnUploadProgress({ loaded: 512, total: 1024 });
  // If we get here without error, the callback executed successfully
  t.pass();
});

test('submitToComputeEngine invokes onUploadProgress without total (bytes-only path)', async t => {
  const client = mockClient();
  let capturedOnUploadProgress = null;

  client.client.post = sinon.stub().callsFake((_url, _data, options) => {
    capturedOnUploadProgress = options.onUploadProgress;
    return Promise.resolve({ data: { ceTask: { id: 'task-progress-2' } } });
  });

  const uploader = new ReportUploader(client);
  await uploader.submitToComputeEngine(Buffer.from('data'), { version: '1.0' });

  t.truthy(capturedOnUploadProgress, 'onUploadProgress callback should have been captured');

  // Invoke with progressEvent that does NOT have total (covers the else branch)
  capturedOnUploadProgress({ loaded: 2048 });
  // If we get here without error, the callback executed successfully
  t.pass();
});
