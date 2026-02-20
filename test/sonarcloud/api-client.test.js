import test from 'ava';
import sinon from 'sinon';
import { SonarCloudClient } from '../../src/sonarcloud/api-client.js';
import { SonarCloudAPIError, AuthenticationError } from '../../src/utils/errors.js';

function createClient(overrides = {}) {
  return new SonarCloudClient({
    url: 'https://sonarcloud.io',
    token: 'test-token',
    organization: 'test-org',
    projectKey: 'test-project',
    rateLimit: { maxRetries: 0, baseDelay: 10, minRequestInterval: 0 },
    ...overrides
  });
}

function mockGet(client, response) {
  return sinon.stub(client.client, 'get').resolves(response);
}

function mockPost(client, response) {
  return sinon.stub(client.client, 'post').resolves(response || { data: {} });
}

test.afterEach(() => sinon.restore());

// Constructor
test('constructor sets properties', t => {
  const client = createClient();
  t.is(client.baseURL, 'https://sonarcloud.io');
  t.is(client.token, 'test-token');
  t.is(client.organization, 'test-org');
  t.is(client.projectKey, 'test-project');
  t.is(client._maxRetries, 0);
});

test('constructor removes trailing slash', t => {
  const client = createClient({ url: 'https://sonarcloud.io/' });
  t.is(client.baseURL, 'https://sonarcloud.io');
});

test('constructor uses rate limit defaults', t => {
  const client = new SonarCloudClient({
    url: 'https://sonarcloud.io', token: 'tok', organization: 'org', projectKey: 'proj'
  });
  t.is(client._maxRetries, 3);
  t.is(client._baseDelay, 1000);
  t.is(client._minRequestInterval, 0);
});

// handleError
test('handleError throws AuthenticationError for 401', t => {
  const client = createClient();
  const err = { response: { status: 401, data: { errors: [{ msg: 'Bad creds' }] }, config: { url: '/api' } } };
  t.throws(() => client.handleError(err), { instanceOf: AuthenticationError });
});

test('handleError throws AuthenticationError for 403', t => {
  const client = createClient();
  const err = { response: { status: 403, data: {}, config: { url: '/api' } } };
  t.throws(() => client.handleError(err), { instanceOf: AuthenticationError });
});

test('handleError throws SonarCloudAPIError for other status', t => {
  const client = createClient();
  const err = { response: { status: 500, data: { message: 'Internal' }, config: { url: '/api' } } };
  const thrown = t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError });
  t.is(thrown.statusCode, 500);
});

test('handleError handles ECONNREFUSED', t => {
  const client = createClient();
  const err = { request: {}, code: 'ECONNREFUSED', message: 'refused', config: { url: '/api' } };
  t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError, message: /Connection refused/ });
});

test('handleError handles ETIMEDOUT', t => {
  const client = createClient();
  const err = { request: {}, code: 'ETIMEDOUT', message: 'timeout', config: { url: '/api' } };
  t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError, message: /timed out/ });
});

test('handleError handles ENOTFOUND', t => {
  const client = createClient();
  const err = { request: {}, code: 'ENOTFOUND', message: 'nf', config: { url: '/api' } };
  t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError, message: /not found/ });
});

test('handleError handles unknown connection error', t => {
  const client = createClient();
  const err = { request: {}, code: 'OTHER', message: 'other error', config: { url: '/api' } };
  t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError });
});

test('handleError handles generic error', t => {
  const client = createClient();
  const err = { message: 'generic' };
  t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError });
});

// testConnection
test('testConnection returns true on success', async t => {
  const client = createClient();
  mockGet(client, { data: { organizations: [{ key: 'test-org' }] } });
  const result = await client.testConnection();
  t.true(result);
});

test('testConnection throws when org not found', async t => {
  const client = createClient();
  mockGet(client, { data: { organizations: [] } });
  await t.throwsAsync(() => client.testConnection(), { instanceOf: SonarCloudAPIError });
});

test('testConnection throws on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));
  await t.throwsAsync(() => client.testConnection());
});

// projectExists
test('projectExists returns true when project found', async t => {
  const client = createClient();
  mockGet(client, { data: { components: [{ key: 'test-project' }] } });
  t.true(await client.projectExists());
});

test('projectExists returns false when not found', async t => {
  const client = createClient();
  mockGet(client, { data: { components: [] } });
  t.false(await client.projectExists());
});

test('projectExists returns false on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));
  t.false(await client.projectExists());
});

// isProjectKeyTakenGlobally
test('isProjectKeyTakenGlobally returns taken when found', async t => {
  const client = createClient();
  mockGet(client, { data: { component: { organization: 'other-org' } } });
  const result = await client.isProjectKeyTakenGlobally('proj-key');
  t.true(result.taken);
  t.is(result.owner, 'other-org');
});

test('isProjectKeyTakenGlobally returns not taken on 404', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects({ status: 404, message: 'not found' });
  const result = await client.isProjectKeyTakenGlobally('proj-key');
  t.false(result.taken);
  t.is(result.owner, null);
});

test('isProjectKeyTakenGlobally assumes taken on unexpected error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('unexpected'));
  const result = await client.isProjectKeyTakenGlobally('proj-key');
  t.true(result.taken);
  t.is(result.owner, 'unknown');
});

// ensureProject
test('ensureProject does not create when exists', async t => {
  const client = createClient();
  const getStub = mockGet(client, { data: { components: [{ key: 'test-project' }] } });
  const postStub = mockPost(client);
  await client.ensureProject();
  t.true(getStub.called);
  t.false(postStub.called);
});

test('ensureProject creates when not exists', async t => {
  const client = createClient();
  mockGet(client, { data: { components: [] } });
  const postStub = mockPost(client, { data: {} });
  await client.ensureProject('My Project');
  t.true(postStub.called);
});

// getQualityProfiles
test('getQualityProfiles returns profiles', async t => {
  const client = createClient();
  mockGet(client, { data: { profiles: [{ key: 'p1' }] } });
  const result = await client.getQualityProfiles();
  t.is(result.length, 1);
});

test('getQualityProfiles returns empty on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));
  const result = await client.getQualityProfiles();
  t.deepEqual(result, []);
});

// getMainBranchName
test('getMainBranchName returns main branch', async t => {
  const client = createClient();
  mockGet(client, { data: { branches: [{ name: 'main', isMain: true }] } });
  const result = await client.getMainBranchName();
  t.is(result, 'main');
});

test('getMainBranchName defaults to master', async t => {
  const client = createClient();
  mockGet(client, { data: { branches: [] } });
  const result = await client.getMainBranchName();
  t.is(result, 'master');
});

test('getMainBranchName returns master on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));
  const result = await client.getMainBranchName();
  t.is(result, 'master');
});

// getAnalysisStatus
test('getAnalysisStatus returns task', async t => {
  const client = createClient();
  mockGet(client, { data: { task: { status: 'SUCCESS' } } });
  const result = await client.getAnalysisStatus('task-1');
  t.is(result.status, 'SUCCESS');
});

test('getAnalysisStatus throws on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));
  await t.throwsAsync(() => client.getAnalysisStatus('task-1'));
});

// waitForAnalysis
test('waitForAnalysis resolves on SUCCESS', async t => {
  const client = createClient();
  mockGet(client, { data: { task: { status: 'SUCCESS' } } });
  const result = await client.waitForAnalysis('task-1', 5);
  t.is(result.status, 'SUCCESS');
});

test('waitForAnalysis throws on FAILED', async t => {
  const client = createClient();
  mockGet(client, { data: { task: { status: 'FAILED', errorMessage: 'Parse error' } } });
  await t.throwsAsync(() => client.waitForAnalysis('task-1', 5), { instanceOf: SonarCloudAPIError });
});

test('waitForAnalysis throws on CANCELED', async t => {
  const client = createClient();
  mockGet(client, { data: { task: { status: 'CANCELED' } } });
  await t.throwsAsync(() => client.waitForAnalysis('task-1', 5), { instanceOf: SonarCloudAPIError });
});

// Serial: polling loop has 2s delays that can race with sinon.restore()
test.serial('waitForAnalysis polls until SUCCESS', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({ data: { task: { status: 'PENDING' } } });
  stub.onSecondCall().resolves({ data: { task: { status: 'IN_PROGRESS' } } });
  stub.onThirdCall().resolves({ data: { task: { status: 'SUCCESS' } } });
  // Use very short maxWaitSeconds to avoid long polling delays
  const result = await client.waitForAnalysis('task-1', 30);
  t.is(result.status, 'SUCCESS');
  t.is(stub.callCount, 3);
});

test.serial('waitForAnalysis throws on timeout', async t => {
  const client = createClient();
  // Always return PENDING - will timeout
  mockGet(client, { data: { task: { status: 'PENDING' } } });
  // maxWaitSeconds = 0 → immediate timeout after first poll
  await t.throwsAsync(() => client.waitForAnalysis('task-1', 0), { instanceOf: SonarCloudAPIError, message: /timeout/ });
});

// Quality Gate methods
test('createQualityGate calls post', async t => {
  const client = createClient();
  const stub = mockPost(client, { data: { id: '1', name: 'Gate' } });
  const result = await client.createQualityGate('Gate');
  t.truthy(result);
  t.true(stub.called);
});

test('createQualityGateCondition calls post', async t => {
  const client = createClient();
  const stub = mockPost(client, { data: {} });
  await client.createQualityGateCondition('1', 'coverage', 'LT', '80');
  t.true(stub.called);
});

test('setDefaultQualityGate calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setDefaultQualityGate('1');
  t.true(stub.called);
});

test('assignQualityGateToProject calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.assignQualityGateToProject('1', 'proj');
  t.true(stub.called);
});

// Quality Profile methods
// Serial: restoreQualityProfile has dynamic import('form-data') causing race with sinon.restore()
test.serial('restoreQualityProfile calls post with form data', async t => {
  const client = createClient();
  const stub = mockPost(client, { data: {} });
  await client.restoreQualityProfile('<xml>test</xml>');
  t.true(stub.called);
});

test('setDefaultQualityProfile calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setDefaultQualityProfile('js', 'My Profile');
  t.true(stub.called);
});

test('addQualityProfileGroupPermission calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.addQualityProfileGroupPermission('Profile', 'js', 'admins');
  t.true(stub.called);
});

test('addQualityProfileUserPermission calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.addQualityProfileUserPermission('Profile', 'js', 'user1');
  t.true(stub.called);
});

test('searchQualityProfiles returns profiles', async t => {
  const client = createClient();
  mockGet(client, { data: { profiles: [{ key: 'p1' }] } });
  const result = await client.searchQualityProfiles('js');
  t.is(result.length, 1);
});

test('searchQualityProfiles without language', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { profiles: [] } });
  await client.searchQualityProfiles();
  t.falsy(stub.firstCall.args[1].params.language);
});

test('getActiveRules paginates', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({ data: { rules: new Array(100).fill({ key: 'r' }), total: 150 } });
  stub.onSecondCall().resolves({ data: { rules: new Array(50).fill({ key: 'r' }), total: 150 } });
  const result = await client.getActiveRules('pk');
  t.is(result.length, 150);
});

test('addQualityProfileToProject calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.addQualityProfileToProject('js', 'Profile', 'proj');
  t.true(stub.called);
});

// Group management
test('createGroup calls post', async t => {
  const client = createClient();
  const stub = mockPost(client, { data: { group: { name: 'grp' } } });
  const result = await client.createGroup('grp', 'desc');
  t.truthy(result);
  t.true(stub.called);
});

// Permission management
test('addGroupPermission calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.addGroupPermission('admins', 'admin');
  t.true(stub.called);
});

test('addProjectGroupPermission calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.addProjectGroupPermission('devs', 'proj', 'codeviewer');
  t.true(stub.called);
});

test('createPermissionTemplate calls post', async t => {
  const client = createClient();
  const stub = mockPost(client, { data: { permissionTemplate: { id: '1' } } });
  const result = await client.createPermissionTemplate('Template', 'desc', '.*');
  t.truthy(result);
  t.true(stub.called);
});

test('createPermissionTemplate without pattern', async t => {
  const client = createClient();
  mockPost(client, { data: { permissionTemplate: { id: '1' } } });
  await client.createPermissionTemplate('Template');
  t.pass();
});

test('addGroupToTemplate calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.addGroupToTemplate('t1', 'admins', 'admin');
  t.true(stub.called);
});

test('setDefaultTemplate calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setDefaultTemplate('t1');
  t.true(stub.called);
});

// Issue management
test('transitionIssue calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.transitionIssue('ISSUE-1', 'confirm');
  t.true(stub.called);
});

test('assignIssue calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.assignIssue('ISSUE-1', 'user1');
  t.true(stub.called);
});

test('addIssueComment calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.addIssueComment('ISSUE-1', 'comment text');
  t.true(stub.called);
});

test('setIssueTags calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setIssueTags('ISSUE-1', ['tag1', 'tag2']);
  t.true(stub.called);
});

test('searchIssues paginates single page', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({ data: { issues: [{ key: 'I1' }], paging: { total: 1 } } });
  const result = await client.searchIssues('proj');
  t.is(result.length, 1);
});

test('searchIssues paginates multiple pages', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  const items = Array.from({ length: 500 }, (_, i) => ({ key: `I${i}` }));
  stub.onFirstCall().resolves({ data: { issues: items, paging: { total: 600 } } });
  stub.onSecondCall().resolves({ data: { issues: [{ key: 'I500' }], paging: { total: 600 } } });
  const result = await client.searchIssues('proj');
  t.is(result.length, 501);
  t.is(stub.callCount, 2);
});

test('searchIssues with filters', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.resolves({ data: { issues: [], paging: { total: 0 } } });
  await client.searchIssues('proj', { statuses: 'OPEN', types: 'BUG' });
  t.true(stub.firstCall.args[1].params.statuses === 'OPEN');
});

// Hotspot management
test('changeHotspotStatus calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.changeHotspotStatus('H1', 'SAFE', 'SAFE');
  t.true(stub.called);
});

test('changeHotspotStatus without resolution', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.changeHotspotStatus('H1', 'ACKNOWLEDGED');
  t.true(stub.called);
});

test('searchHotspots paginates single page', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({ data: { hotspots: [{ key: 'H1' }], paging: { total: 1 } } });
  const result = await client.searchHotspots('proj');
  t.is(result.length, 1);
});

test('searchHotspots paginates multiple pages', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  const items = Array.from({ length: 500 }, (_, i) => ({ key: `H${i}` }));
  stub.onFirstCall().resolves({ data: { hotspots: items, paging: { total: 600 } } });
  stub.onSecondCall().resolves({ data: { hotspots: [{ key: 'H500' }], paging: { total: 600 } } });
  const result = await client.searchHotspots('proj');
  t.is(result.length, 501);
  t.is(stub.callCount, 2);
});

test('addHotspotComment calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.addHotspotComment('H1', 'comment');
  t.true(stub.called);
});

// Project config
test('setProjectSetting calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setProjectSetting('sonar.key', 'value');
  t.true(stub.called);
});

test('setProjectSetting with custom component', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setProjectSetting('sonar.key', 'value', 'custom-proj');
  t.is(stub.firstCall.args[2].params.component, 'custom-proj');
});

test('setProjectTags calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setProjectTags('proj', ['t1', 't2']);
  t.true(stub.called);
});

test('createProjectLink calls post', async t => {
  const client = createClient();
  mockPost(client, { data: { link: { id: '1' } } });
  const result = await client.createProjectLink('proj', 'Homepage', 'http://ex.com');
  t.truthy(result);
});

// DevOps bindings
test('setGithubBinding calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setGithubBinding('proj', 'gh', 'org/repo');
  t.true(stub.called);
});

test('setGitlabBinding calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setGitlabBinding('proj', 'gl', '12345');
  t.true(stub.called);
});

test('setAzureBinding calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setAzureBinding('proj', 'az', 'MyProject', 'MyRepo');
  t.true(stub.called);
});

test('setBitbucketBinding calls post', async t => {
  const client = createClient();
  const stub = mockPost(client);
  await client.setBitbucketBinding('proj', 'bb', 'repo', 'slug');
  t.true(stub.called);
});

// Portfolio management (now handled by EnterpriseClient V2 API, not SonarCloudClient)

// --- Interceptor tests ---
// Test request throttling interceptor directly
test('request interceptor throttles POST requests', async t => {
  const client = createClient({ rateLimit: { minRequestInterval: 50 } });
  // Access the request interceptor handler
  const requestHandlers = client.client.interceptors.request.handlers;
  const handler = requestHandlers.find(h => h && h.fulfilled);
  t.truthy(handler);

  // Simulate a POST request config
  const postConfig = { method: 'post' };
  client._lastPostTime = Date.now(); // Set last post time to now
  const result = await handler.fulfilled(postConfig);
  t.is(result.method, 'post');
});

test('request interceptor passes through GET requests', async t => {
  const client = createClient();
  const requestHandlers = client.client.interceptors.request.handlers;
  const handler = requestHandlers.find(h => h && h.fulfilled);

  const getConfig = { method: 'get' };
  const result = await handler.fulfilled(getConfig);
  t.is(result.method, 'get');
});

// Test response interceptor retry logic
test('response interceptor retries on 503', async t => {
  const client = createClient({ rateLimit: { maxRetries: 1, baseDelay: 10 } });
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);
  t.truthy(handler);

  // Stub the client call for retry
  const retryStub = sinon.stub(client, 'client').resolves({ data: {} });

  const error = {
    response: { status: 503 },
    config: { _retryCount: 0 }
  };

  try {
    await handler.rejected(error);
  } catch {
    // May throw if retry doesn't work, that's OK
  }

  // The config should have been mutated with retry count
  t.is(error.config._retryCount, 1);
  retryStub.restore();
});

test('response interceptor exhausts retries on 429', async t => {
  const client = createClient({ rateLimit: { maxRetries: 0, baseDelay: 10 } });
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);

  const error = {
    response: { status: 429, data: { errors: [{ msg: 'Too many requests' }] }, config: { url: '/test' } },
    config: { _retryCount: 1 }
  };

  await t.throwsAsync(() => handler.rejected(error));
});

test('response interceptor calls handleError for non-retry errors', async t => {
  const client = createClient();
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);

  const error = {
    response: { status: 500, data: { errors: [{ msg: 'Server error' }] }, config: { url: '/test' } },
    config: {}
  };

  await t.throwsAsync(() => handler.rejected(error));
});
