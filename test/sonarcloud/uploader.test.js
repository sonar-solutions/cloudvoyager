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

test('submitToComputeEngine handles response without ceTask', async t => {
  const client = mockClient();
  client.client.post.resolves({ data: { taskId: 'task-2' } });
  const uploader = new ReportUploader(client);
  const result = await uploader.submitToComputeEngine(Buffer.from('data'), {});
  t.is(result.id, 'task-2');
});

test('submitToComputeEngine throws on response error', async t => {
  const client = mockClient();
  client.client.post.rejects({
    response: { status: 400, data: { errors: [{ msg: 'Bad request' }] } }
  });
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
