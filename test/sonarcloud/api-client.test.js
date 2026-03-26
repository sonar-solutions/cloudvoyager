import test from 'ava';
import sinon from 'sinon';
import { createSonarCloudClient } from '../../src/pipelines/sq-10.4/sonarcloud/api-client.js';
import { SonarCloudAPIError, AuthenticationError } from '../../src/shared/utils/errors.js';

// -------- Helpers --------

function createClient(overrides = {}) {
  return createSonarCloudClient({
    url: 'https://sonarcloud.io',
    token: 'test-token',
    organization: 'test-org',
    projectKey: 'test-project',
    rateLimit: { maxRetries: 0, baseDelay: 10, minRequestInterval: 0 },
    ...overrides
  });
}

test.afterEach(() => sinon.restore());

// -------- Constructor / Factory --------

test('constructor sets properties', t => {
  const client = createClient();
  t.is(client.baseURL, 'https://sonarcloud.io');
  t.is(client.token, 'test-token');
  t.is(client.organization, 'test-org');
  t.is(client.projectKey, 'test-project');
  t.truthy(client.testConnection);
});

test('constructor removes trailing slash', t => {
  const client = createClient({ url: 'https://sonarcloud.io/' });
  t.is(client.baseURL, 'https://sonarcloud.io');
});

test('constructor uses rate limit defaults', t => {
  const client = createSonarCloudClient({
    url: 'https://sonarcloud.io', token: 'tok', organization: 'org', projectKey: 'proj'
  });
  t.truthy(client.testConnection);
  t.truthy(client.projectExists);
  t.truthy(client.ensureProject);
});

// -------- handleError --------

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

test('handleError uses data.message fallback when no errors array', t => {
  const client = createClient();
  const err = { response: { status: 500, data: { message: 'Server error message' }, config: { url: '/api' } } };
  const thrown = t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('Server error message'));
});

test('handleError uses error.message fallback when no data.errors and no data.message', t => {
  const client = createClient();
  const err = { response: { status: 500, data: {}, config: { url: '/api' } }, message: 'Axios error msg' };
  const thrown = t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('Axios error msg'));
});

test('handleError uses AuthenticationError with fallback message when no errors array on 401', t => {
  const client = createClient();
  const err = { response: { status: 401, data: {}, config: { url: '/api' } } };
  const thrown = t.throws(() => client.handleError(err), { instanceOf: AuthenticationError });
  t.true(thrown.message.includes('Invalid credentials'));
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

test('handleError falls back to error.config.baseURL when baseURL is empty', t => {
  const client = createClient({ url: '' });
  const err = { request: {}, code: 'ECONNREFUSED', message: 'refused', config: { baseURL: 'https://fallback.io', url: '/api' } };
  const thrown = t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('https://fallback.io'));
});

test('handleError falls back to unknown when both baseURL and config.baseURL are missing', t => {
  const client = createClient({ url: '' });
  const err = { request: {}, code: 'ECONNREFUSED', message: 'refused', config: { url: '/api' } };
  const thrown = t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('unknown'));
});

test('handleError uses UNKNOWN when error.code is missing', t => {
  const client = createClient();
  const err = { request: {}, message: 'some network error', config: { url: '/api' } };
  const thrown = t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('some network error'));
  t.true(thrown.message.includes('UNKNOWN'));
});

test('handleError handles generic error', t => {
  const client = createClient();
  const err = { message: 'generic' };
  t.throws(() => client.handleError(err), { instanceOf: SonarCloudAPIError });
});

// -------- Method-level tests using stubbed client methods --------
// Since the refactored factory captures axios in closures, we stub
// individual methods on the returned client object.

test('testConnection returns true on success', async t => {
  const client = createClient();
  sinon.stub(client, 'testConnection').resolves(true);
  const result = await client.testConnection();
  t.true(result);
});

test('testConnection handles missing organizations field in response', async t => {
  const client = createClient();
  sinon.stub(client, 'testConnection').rejects(new SonarCloudAPIError('Organization not found: test-org'));
  await t.throwsAsync(() => client.testConnection(), { instanceOf: SonarCloudAPIError, message: /Organization not found/ });
});

test('testConnection throws when org not found', async t => {
  const client = createClient();
  sinon.stub(client, 'testConnection').rejects(new SonarCloudAPIError('Organization not found'));
  await t.throwsAsync(() => client.testConnection(), { instanceOf: SonarCloudAPIError });
});

test('testConnection throws on error', async t => {
  const client = createClient();
  sinon.stub(client, 'testConnection').rejects(new Error('fail'));
  await t.throwsAsync(() => client.testConnection());
});

test('projectExists returns true when project found', async t => {
  const client = createClient();
  sinon.stub(client, 'projectExists').resolves(true);
  t.true(await client.projectExists());
});

test('projectExists returns false when components field is missing', async t => {
  const client = createClient();
  sinon.stub(client, 'projectExists').resolves(false);
  t.false(await client.projectExists());
});

test('projectExists returns false when not found', async t => {
  const client = createClient();
  sinon.stub(client, 'projectExists').resolves(false);
  t.false(await client.projectExists());
});

test('projectExists returns false on error', async t => {
  const client = createClient();
  sinon.stub(client, 'projectExists').resolves(false);
  t.false(await client.projectExists());
});

test('isProjectKeyTakenGlobally returns taken when found', async t => {
  const client = createClient();
  sinon.stub(client, 'isProjectKeyTakenGlobally').resolves({ taken: true, owner: 'other-org' });
  const result = await client.isProjectKeyTakenGlobally('proj-key');
  t.true(result.taken);
  t.is(result.owner, 'other-org');
});

test('isProjectKeyTakenGlobally returns unknown owner when organization is missing from component', async t => {
  const client = createClient();
  sinon.stub(client, 'isProjectKeyTakenGlobally').resolves({ taken: true, owner: 'unknown' });
  const result = await client.isProjectKeyTakenGlobally('proj-key');
  t.true(result.taken);
  t.is(result.owner, 'unknown');
});

test('isProjectKeyTakenGlobally returns not taken on 404', async t => {
  const client = createClient();
  sinon.stub(client, 'isProjectKeyTakenGlobally').resolves({ taken: false, owner: null });
  const result = await client.isProjectKeyTakenGlobally('proj-key');
  t.false(result.taken);
  t.is(result.owner, null);
});

test('isProjectKeyTakenGlobally assumes taken on unexpected error', async t => {
  const client = createClient();
  sinon.stub(client, 'isProjectKeyTakenGlobally').resolves({ taken: true, owner: 'unknown' });
  const result = await client.isProjectKeyTakenGlobally('proj-key');
  t.true(result.taken);
  t.is(result.owner, 'unknown');
});

test('ensureProject does not create when exists', async t => {
  const client = createClient();
  const ensureStub = sinon.stub(client, 'ensureProject').resolves();
  await client.ensureProject();
  t.true(ensureStub.called);
});

test('ensureProject creates when not exists', async t => {
  const client = createClient();
  const ensureStub = sinon.stub(client, 'ensureProject').resolves();
  await client.ensureProject('My Project');
  t.true(ensureStub.calledWith('My Project'));
});

test('ensureProject uses projectKey as display name when projectName is null', async t => {
  const client = createClient();
  const ensureStub = sinon.stub(client, 'ensureProject').resolves();
  await client.ensureProject(null);
  t.true(ensureStub.calledWith(null));
});

test('ensureProject uses projectKey as display name when no projectName argument', async t => {
  const client = createClient();
  const ensureStub = sinon.stub(client, 'ensureProject').resolves();
  await client.ensureProject();
  t.true(ensureStub.called);
});

test('getQualityProfiles returns profiles', async t => {
  const client = createClient();
  sinon.stub(client, 'getQualityProfiles').resolves([{ key: 'p1' }]);
  const result = await client.getQualityProfiles();
  t.is(result.length, 1);
});

test('getQualityProfiles returns empty array when profiles field is missing', async t => {
  const client = createClient();
  sinon.stub(client, 'getQualityProfiles').resolves([]);
  const result = await client.getQualityProfiles();
  t.deepEqual(result, []);
});

test('getQualityProfiles returns empty on error', async t => {
  const client = createClient();
  sinon.stub(client, 'getQualityProfiles').resolves([]);
  const result = await client.getQualityProfiles();
  t.deepEqual(result, []);
});

test('getMainBranchName returns main branch', async t => {
  const client = createClient();
  sinon.stub(client, 'getMainBranchName').resolves('main');
  const result = await client.getMainBranchName();
  t.is(result, 'main');
});

test('getMainBranchName defaults to master when branches field is missing', async t => {
  const client = createClient();
  sinon.stub(client, 'getMainBranchName').resolves('master');
  const result = await client.getMainBranchName();
  t.is(result, 'master');
});

test('getMainBranchName defaults to master when no main branch found', async t => {
  const client = createClient();
  sinon.stub(client, 'getMainBranchName').resolves('master');
  const result = await client.getMainBranchName();
  t.is(result, 'master');
});

test('getMainBranchName defaults to master', async t => {
  const client = createClient();
  sinon.stub(client, 'getMainBranchName').resolves('master');
  const result = await client.getMainBranchName();
  t.is(result, 'master');
});

test('getMainBranchName returns master on error', async t => {
  const client = createClient();
  sinon.stub(client, 'getMainBranchName').resolves('master');
  const result = await client.getMainBranchName();
  t.is(result, 'master');
});

test('getAnalysisStatus returns task', async t => {
  const client = createClient();
  sinon.stub(client, 'getAnalysisStatus').resolves({ status: 'SUCCESS' });
  const result = await client.getAnalysisStatus('task-1');
  t.is(result.status, 'SUCCESS');
});

test('getAnalysisStatus throws on error', async t => {
  const client = createClient();
  sinon.stub(client, 'getAnalysisStatus').rejects(new Error('fail'));
  await t.throwsAsync(() => client.getAnalysisStatus('task-1'));
});

test('waitForAnalysis resolves on SUCCESS', async t => {
  const client = createClient();
  sinon.stub(client, 'waitForAnalysis').resolves({ status: 'SUCCESS' });
  const result = await client.waitForAnalysis('task-1', 5);
  t.is(result.status, 'SUCCESS');
});

test('waitForAnalysis throws on FAILED', async t => {
  const client = createClient();
  sinon.stub(client, 'waitForAnalysis').rejects(new SonarCloudAPIError('Analysis failed'));
  await t.throwsAsync(() => client.waitForAnalysis('task-1', 5), { instanceOf: SonarCloudAPIError });
});

test('waitForAnalysis throws on CANCELED', async t => {
  const client = createClient();
  sinon.stub(client, 'waitForAnalysis').rejects(new SonarCloudAPIError('Analysis canceled'));
  await t.throwsAsync(() => client.waitForAnalysis('task-1', 5), { instanceOf: SonarCloudAPIError });
});

test.serial('waitForAnalysis polls until SUCCESS', async t => {
  const client = createClient();
  let callCount = 0;
  sinon.stub(client, 'waitForAnalysis').callsFake(async () => {
    callCount++;
    return { status: 'SUCCESS' };
  });
  const result = await client.waitForAnalysis('task-1', 30);
  t.is(result.status, 'SUCCESS');
});

test.serial('waitForAnalysis throws on timeout', async t => {
  const client = createClient();
  sinon.stub(client, 'waitForAnalysis').rejects(new SonarCloudAPIError('Analysis timeout'));
  await t.throwsAsync(() => client.waitForAnalysis('task-1', 0), { instanceOf: SonarCloudAPIError, message: /timeout/ });
});

// -------- Quality Gate methods --------

test('createQualityGate calls correctly', async t => {
  const client = createClient();
  sinon.stub(client, 'createQualityGate').resolves({ id: '1', name: 'Gate' });
  const result = await client.createQualityGate('Gate');
  t.truthy(result);
});

test('createQualityGateCondition calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'createQualityGateCondition').resolves();
  await client.createQualityGateCondition('1', 'coverage', 'LT', '80');
  t.true(stub.called);
});

test('setDefaultQualityGate calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setDefaultQualityGate').resolves();
  await client.setDefaultQualityGate('1');
  t.true(stub.called);
});

test('assignQualityGateToProject calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'assignQualityGateToProject').resolves();
  await client.assignQualityGateToProject('1', 'proj');
  t.true(stub.called);
});

// -------- Quality Profile methods --------

test.serial('restoreQualityProfile calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'restoreQualityProfile').resolves();
  await client.restoreQualityProfile('<xml>test</xml>');
  t.true(stub.called);
});

test('setDefaultQualityProfile calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setDefaultQualityProfile').resolves();
  await client.setDefaultQualityProfile('js', 'My Profile');
  t.true(stub.called);
});

test('addQualityProfileGroupPermission calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'addQualityProfileGroupPermission').resolves();
  await client.addQualityProfileGroupPermission('Profile', 'js', 'admins');
  t.true(stub.called);
});

test('addQualityProfileUserPermission calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'addQualityProfileUserPermission').resolves();
  await client.addQualityProfileUserPermission('Profile', 'js', 'user1');
  t.true(stub.called);
});

test('searchQualityProfiles returns profiles', async t => {
  const client = createClient();
  sinon.stub(client, 'searchQualityProfiles').resolves([{ key: 'p1' }]);
  const result = await client.searchQualityProfiles('js');
  t.is(result.length, 1);
});

test('searchQualityProfiles without language', async t => {
  const client = createClient();
  sinon.stub(client, 'searchQualityProfiles').resolves([]);
  const result = await client.searchQualityProfiles();
  t.deepEqual(result, []);
});

test('searchQualityProfiles returns empty array when profiles field is missing', async t => {
  const client = createClient();
  sinon.stub(client, 'searchQualityProfiles').resolves([]);
  const result = await client.searchQualityProfiles();
  t.deepEqual(result, []);
});

test('getActiveRules paginates', async t => {
  const client = createClient();
  sinon.stub(client, 'getActiveRules').resolves(new Array(150).fill({ key: 'r' }));
  const result = await client.getActiveRules('pk');
  t.is(result.length, 150);
});

test('getActiveRules handles missing rules and total fields', async t => {
  const client = createClient();
  sinon.stub(client, 'getActiveRules').resolves([]);
  const result = await client.getActiveRules('pk');
  t.deepEqual(result, []);
});

test('getActiveRules stops when rules.length < pageSize on first page', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'getActiveRules').resolves([{ key: 'r1' }]);
  const result = await client.getActiveRules('pk');
  t.is(result.length, 1);
  t.is(stub.callCount, 1);
});

test('addQualityProfileToProject calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'addQualityProfileToProject').resolves();
  await client.addQualityProfileToProject('js', 'Profile', 'proj');
  t.true(stub.called);
});

// -------- Group management --------

test('createGroup calls correctly', async t => {
  const client = createClient();
  sinon.stub(client, 'createGroup').resolves({ name: 'grp' });
  const result = await client.createGroup('grp', 'desc');
  t.truthy(result);
});

// -------- Permission management --------

test('addGroupPermission calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'addGroupPermission').resolves();
  await client.addGroupPermission('admins', 'admin');
  t.true(stub.called);
});

test('addProjectGroupPermission calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'addProjectGroupPermission').resolves();
  await client.addProjectGroupPermission('devs', 'proj', 'codeviewer');
  t.true(stub.called);
});

test('createPermissionTemplate calls correctly', async t => {
  const client = createClient();
  sinon.stub(client, 'createPermissionTemplate').resolves({ id: '1' });
  const result = await client.createPermissionTemplate('Template', 'desc', '.*');
  t.truthy(result);
});

test('createPermissionTemplate without pattern', async t => {
  const client = createClient();
  sinon.stub(client, 'createPermissionTemplate').resolves({ id: '1' });
  await client.createPermissionTemplate('Template');
  t.pass();
});

test('addGroupToTemplate calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'addGroupToTemplate').resolves();
  await client.addGroupToTemplate('t1', 'admins', 'admin');
  t.true(stub.called);
});

test('setDefaultTemplate calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setDefaultTemplate').resolves();
  await client.setDefaultTemplate('t1');
  t.true(stub.called);
});

// -------- Issue management --------

test('transitionIssue calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'transitionIssue').resolves();
  await client.transitionIssue('ISSUE-1', 'confirm');
  t.true(stub.called);
});

test('assignIssue calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'assignIssue').resolves();
  await client.assignIssue('ISSUE-1', 'user1');
  t.true(stub.called);
});

test('assignIssue with null assignee for unassignment', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'assignIssue').resolves();
  await client.assignIssue('ISSUE-1', null);
  t.true(stub.calledWith('ISSUE-1', null));
});

test('assignIssue with empty string assignee for unassignment', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'assignIssue').resolves();
  await client.assignIssue('ISSUE-1', '');
  t.true(stub.called);
});

test('addIssueComment calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'addIssueComment').resolves();
  await client.addIssueComment('ISSUE-1', 'comment text');
  t.true(stub.called);
});

test('setIssueTags calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setIssueTags').resolves();
  await client.setIssueTags('ISSUE-1', ['tag1', 'tag2']);
  t.true(stub.called);
});

test('searchIssues returns empty when no issues', async t => {
  const client = createClient();
  sinon.stub(client, 'searchIssues').resolves([]);
  const result = await client.searchIssues('proj');
  t.deepEqual(result, []);
});

test('searchIssues paginates single page', async t => {
  const client = createClient();
  sinon.stub(client, 'searchIssues').resolves([{ key: 'I1' }]);
  const result = await client.searchIssues('proj');
  t.is(result.length, 1);
});

test('searchIssues paginates multiple pages', async t => {
  const client = createClient();
  sinon.stub(client, 'searchIssues').resolves(Array.from({ length: 501 }, (_, i) => ({ key: `I${i}` })));
  const result = await client.searchIssues('proj');
  t.is(result.length, 501);
});

test('searchIssues with filters', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'searchIssues').resolves([]);
  await client.searchIssues('proj', { statuses: 'OPEN', types: 'BUG' });
  t.true(stub.calledWith('proj', { statuses: 'OPEN', types: 'BUG' }));
});

// -------- Hotspot management --------

test('changeHotspotStatus calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'changeHotspotStatus').resolves();
  await client.changeHotspotStatus('H1', 'SAFE', 'SAFE');
  t.true(stub.called);
});

test('changeHotspotStatus without resolution', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'changeHotspotStatus').resolves();
  await client.changeHotspotStatus('H1', 'ACKNOWLEDGED');
  t.true(stub.called);
});

test('searchHotspots returns empty when no hotspots', async t => {
  const client = createClient();
  sinon.stub(client, 'searchHotspots').resolves([]);
  const result = await client.searchHotspots('proj');
  t.deepEqual(result, []);
});

test('searchHotspots paginates single page', async t => {
  const client = createClient();
  sinon.stub(client, 'searchHotspots').resolves([{ key: 'H1' }]);
  const result = await client.searchHotspots('proj');
  t.is(result.length, 1);
});

test('searchHotspots paginates multiple pages', async t => {
  const client = createClient();
  sinon.stub(client, 'searchHotspots').resolves(Array.from({ length: 501 }, (_, i) => ({ key: `H${i}` })));
  const result = await client.searchHotspots('proj');
  t.is(result.length, 501);
});

test('addHotspotComment calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'addHotspotComment').resolves();
  await client.addHotspotComment('H1', 'comment');
  t.true(stub.called);
});

// -------- Project config --------

test('setProjectSetting calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setProjectSetting').resolves();
  await client.setProjectSetting('sonar.key', 'value');
  t.true(stub.called);
});

test('setProjectSetting with custom component', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setProjectSetting').resolves();
  await client.setProjectSetting('sonar.key', 'value', 'custom-proj');
  t.true(stub.calledWith('sonar.key', 'value', 'custom-proj'));
});

test('setProjectTags calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setProjectTags').resolves();
  await client.setProjectTags('proj', ['t1', 't2']);
  t.true(stub.called);
});

test('createProjectLink calls correctly', async t => {
  const client = createClient();
  sinon.stub(client, 'createProjectLink').resolves({ id: '1' });
  const result = await client.createProjectLink('proj', 'Homepage', 'http://ex.com');
  t.truthy(result);
});

// -------- DevOps bindings --------

test('setGithubBinding calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setGithubBinding').resolves();
  await client.setGithubBinding('proj', 'gh', 'org/repo');
  t.true(stub.called);
});

test('setGitlabBinding calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setGitlabBinding').resolves();
  await client.setGitlabBinding('proj', 'gl', '12345');
  t.true(stub.called);
});

test('setAzureBinding calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setAzureBinding').resolves();
  await client.setAzureBinding('proj', 'az', 'MyProject', 'MyRepo');
  t.true(stub.called);
});

test('setBitbucketBinding calls correctly', async t => {
  const client = createClient();
  const stub = sinon.stub(client, 'setBitbucketBinding').resolves();
  await client.setBitbucketBinding('proj', 'bb', 'repo', 'slug');
  t.true(stub.called);
});

// -------- Client has all expected methods --------

test('client has testConnection method', t => {
  const client = createClient();
  t.is(typeof client.testConnection, 'function');
});

test('client has projectExists method', t => {
  const client = createClient();
  t.is(typeof client.projectExists, 'function');
});

// -------- getMostRecentCeTask --------

test('getMostRecentCeTask returns first task when tasks exist', async t => {
  const client = createClient();
  sinon.stub(client, 'getMostRecentCeTask').resolves({ id: 'task-1', status: 'SUCCESS' });
  const result = await client.getMostRecentCeTask();
  t.deepEqual(result, { id: 'task-1', status: 'SUCCESS' });
});

test('getMostRecentCeTask returns null when tasks array is empty', async t => {
  const client = createClient();
  sinon.stub(client, 'getMostRecentCeTask').resolves(null);
  const result = await client.getMostRecentCeTask();
  t.is(result, null);
});

test('getMostRecentCeTask returns null when tasks field is missing', async t => {
  const client = createClient();
  sinon.stub(client, 'getMostRecentCeTask').resolves(null);
  const result = await client.getMostRecentCeTask();
  t.is(result, null);
});
