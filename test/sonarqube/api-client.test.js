import test from 'ava';
import sinon from 'sinon';
import { SonarQubeClient } from '../../src/sonarqube/api-client.js';
import { SonarQubeAPIError, AuthenticationError } from '../../src/utils/errors.js';

function createClient(overrides = {}) {
  return new SonarQubeClient({
    url: 'http://localhost:9000',
    token: 'test-token',
    projectKey: 'test-project',
    ...overrides
  });
}

function mockGet(client, responses) {
  const stub = sinon.stub(client.client, 'get');
  if (Array.isArray(responses)) {
    responses.forEach((resp, i) => {
      stub.onCall(i).resolves(resp);
    });
  } else {
    stub.resolves(responses);
  }
  return stub;
}

test.afterEach(() => {
  sinon.restore();
});

// Constructor
test('constructor sets baseURL without trailing slash', t => {
  const client = createClient({ url: 'http://localhost:9000/' });
  t.is(client.baseURL, 'http://localhost:9000');
});

test('constructor sets token and projectKey', t => {
  const client = createClient();
  t.is(client.token, 'test-token');
  t.is(client.projectKey, 'test-project');
});

// handleError
test('handleError throws AuthenticationError for 401', t => {
  const client = createClient();
  const error = {
    response: {
      status: 401,
      data: { errors: [{ msg: 'Unauthorized' }] },
      config: { url: '/api/test' }
    }
  };
  t.throws(() => client.handleError(error), { instanceOf: AuthenticationError });
});

test('handleError throws AuthenticationError for 403', t => {
  const client = createClient();
  const error = {
    response: {
      status: 403,
      data: {},
      config: { url: '/api/test' }
    }
  };
  t.throws(() => client.handleError(error), { instanceOf: AuthenticationError });
});

test('handleError throws SonarQubeAPIError for other status codes', t => {
  const client = createClient();
  const error = {
    response: {
      status: 404,
      data: { errors: [{ msg: 'Not found' }] },
      config: { url: '/api/test' }
    }
  };
  const thrown = t.throws(() => client.handleError(error), { instanceOf: SonarQubeAPIError });
  t.is(thrown.statusCode, 404);
  t.is(thrown.endpoint, '/api/test');
});

test('handleError handles response with message instead of errors', t => {
  const client = createClient();
  const error = {
    response: {
      status: 500,
      data: { message: 'Internal error' },
      config: { url: '/api/test' }
    }
  };
  const thrown = t.throws(() => client.handleError(error), { instanceOf: SonarQubeAPIError });
  t.true(thrown.message.includes('Internal error'));
});

test('handleError handles connection refused', t => {
  const client = createClient();
  const error = {
    request: {},
    code: 'ECONNREFUSED',
    message: 'connect ECONNREFUSED',
    config: { baseURL: 'http://localhost:9000', url: '/api/test' }
  };
  const thrown = t.throws(() => client.handleError(error), { instanceOf: SonarQubeAPIError });
  t.true(thrown.message.includes('Connection refused'));
});

test('handleError handles timeout', t => {
  const client = createClient();
  const error = {
    request: {},
    code: 'ETIMEDOUT',
    message: 'timeout',
    config: { baseURL: 'http://localhost:9000', url: '/api/test' }
  };
  const thrown = t.throws(() => client.handleError(error), { instanceOf: SonarQubeAPIError });
  t.true(thrown.message.includes('timed out'));
});

test('handleError handles ENOTFOUND', t => {
  const client = createClient();
  const error = {
    request: {},
    code: 'ENOTFOUND',
    message: 'not found',
    config: { baseURL: 'http://localhost:9000', url: '/api/test' }
  };
  const thrown = t.throws(() => client.handleError(error), { instanceOf: SonarQubeAPIError });
  t.true(thrown.message.includes('not found'));
});

test('handleError handles unknown connection error', t => {
  const client = createClient();
  const error = {
    request: {},
    code: 'UNKNOWN',
    message: 'something went wrong',
    config: { baseURL: 'http://localhost:9000', url: '/api/test' }
  };
  const thrown = t.throws(() => client.handleError(error), { instanceOf: SonarQubeAPIError });
  t.true(thrown.message.includes('something went wrong'));
});

test('handleError handles request error with no config', t => {
  const client = createClient();
  const error = {
    request: {},
    code: 'ECONNREFUSED',
    message: 'connect ECONNREFUSED'
  };
  const thrown = t.throws(() => client.handleError(error), { instanceOf: SonarQubeAPIError });
  t.truthy(thrown.message);
});

test('handleError handles generic error', t => {
  const client = createClient();
  const error = { message: 'Unknown error' };
  const thrown = t.throws(() => client.handleError(error), { instanceOf: SonarQubeAPIError });
  t.true(thrown.message.includes('Unknown error'));
});

// getPaginated
test('getPaginated fetches all pages', async t => {
  const client = createClient();
  const stub = mockGet(client, [
    { data: { items: [{ id: 1 }, { id: 2 }], paging: { total: 4 } } },
    { data: { items: [{ id: 3 }, { id: 4 }], paging: { total: 4 } } }
  ]);

  const results = await client.getPaginated('/api/test', { ps: 2 }, 'items');
  t.is(results.length, 4);
  t.is(stub.callCount, 2);
});

test('getPaginated handles single page', async t => {
  const client = createClient();
  mockGet(client, { data: { items: [{ id: 1 }], paging: { total: 1 } } });

  const results = await client.getPaginated('/api/test', {}, 'items');
  t.is(results.length, 1);
});

test('getPaginated handles empty results', async t => {
  const client = createClient();
  mockGet(client, { data: { paging: { total: 0 } } });

  const results = await client.getPaginated('/api/test', {}, 'items');
  t.deepEqual(results, []);
});

test('getPaginated uses data.total as fallback', async t => {
  const client = createClient();
  mockGet(client, { data: { items: [{ id: 1 }], total: 1 } });

  const results = await client.getPaginated('/api/test', {}, 'items');
  t.is(results.length, 1);
});

// getProject
test('getProject returns project data', async t => {
  const client = createClient();
  mockGet(client, { data: { components: [{ key: 'test-project', name: 'Test' }] } });

  const project = await client.getProject();
  t.is(project.key, 'test-project');
});

test('getProject throws when project not found', async t => {
  const client = createClient();
  mockGet(client, { data: { components: [] } });

  await t.throwsAsync(() => client.getProject(), { instanceOf: SonarQubeAPIError, message: /not found/ });
});

// getBranches
test('getBranches returns branches', async t => {
  const client = createClient();
  mockGet(client, { data: { branches: [{ name: 'main', isMain: true }] } });

  const branches = await client.getBranches();
  t.is(branches.length, 1);
  t.is(branches[0].name, 'main');
});

// getQualityGate
test('getQualityGate returns quality gate', async t => {
  const client = createClient();
  mockGet(client, { data: { qualityGate: { name: 'Sonar way' } } });

  const qg = await client.getQualityGate();
  t.is(qg.name, 'Sonar way');
});

test('getQualityGate returns null on 404', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects({ statusCode: 404 });

  const qg = await client.getQualityGate();
  t.is(qg, null);
});

test('getQualityGate re-throws non-404 errors', async t => {
  const client = createClient();
  const error = new SonarQubeAPIError('Server error', 500);
  sinon.stub(client.client, 'get').rejects(error);

  await t.throwsAsync(() => client.getQualityGate(), { instanceOf: SonarQubeAPIError });
});

// getMetrics
test('getMetrics fetches metric definitions', async t => {
  const client = createClient();
  mockGet(client, { data: { metrics: [{ key: 'coverage' }], paging: { total: 1 } } });

  const metrics = await client.getMetrics();
  t.is(metrics.length, 1);
  t.is(metrics[0].key, 'coverage');
});

// getIssues
test('getIssues fetches issues with filters', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { issues: [{ key: 'ISSUE-1' }], paging: { total: 1 } } });

  const issues = await client.getIssues({ branch: 'main' });
  t.is(issues.length, 1);
  t.is(stub.firstCall.args[1].params.componentKeys, 'test-project');
  t.is(stub.firstCall.args[1].params.branch, 'main');
});

// getMeasures
test('getMeasures fetches component measures', async t => {
  const client = createClient();
  mockGet(client, { data: { component: { key: 'test', measures: [] } } });

  const result = await client.getMeasures(null, ['coverage']);
  t.truthy(result.key);
});

test('getMeasures with branch', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { component: {} } });

  await client.getMeasures('main', ['coverage']);
  t.is(stub.firstCall.args[1].params.branch, 'main');
});

// getComponentTree
test('getComponentTree fetches component tree', async t => {
  const client = createClient();
  mockGet(client, { data: { components: [{ key: 'file1' }], paging: { total: 1 } } });

  const tree = await client.getComponentTree(null, ['coverage']);
  t.is(tree.length, 1);
});

test('getComponentTree with branch', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { components: [], paging: { total: 0 } } });

  await client.getComponentTree('main', ['coverage']);
  t.is(stub.firstCall.args[1].params.branch, 'main');
});

// getSourceCode
test('getSourceCode fetches raw source', async t => {
  const client = createClient();
  mockGet(client, { data: 'console.log("hello");' });

  const source = await client.getSourceCode('project:src/index.js');
  t.is(source, 'console.log("hello");');
});

test('getSourceCode with branch', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: 'code' });

  await client.getSourceCode('project:src/index.js', 'develop');
  t.is(stub.firstCall.args[1].params.branch, 'develop');
});

// getSourceFiles
test('getSourceFiles fetches file list', async t => {
  const client = createClient();
  mockGet(client, { data: { components: [{ key: 'f1' }], paging: { total: 1 } } });

  const files = await client.getSourceFiles();
  t.is(files.length, 1);
});

test('getSourceFiles with branch', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { components: [], paging: { total: 0 } } });

  await client.getSourceFiles('main');
  t.is(stub.firstCall.args[1].params.branch, 'main');
});

// getQualityProfiles
test('getQualityProfiles fetches profiles', async t => {
  const client = createClient();
  mockGet(client, { data: { profiles: [{ key: 'p1', name: 'Sonar way' }] } });

  const profiles = await client.getQualityProfiles();
  t.is(profiles.length, 1);
});

// getActiveRules
test('getActiveRules fetches rules for profile', async t => {
  const client = createClient();
  mockGet(client, { data: { rules: [{ key: 'js:S1234' }], paging: { total: 1 } } });

  const rules = await client.getActiveRules('profile-key');
  t.is(rules.length, 1);
});

// getLatestAnalysisRevision
test('getLatestAnalysisRevision returns revision', async t => {
  const client = createClient();
  mockGet(client, { data: { analyses: [{ revision: 'abc123' }] } });

  const rev = await client.getLatestAnalysisRevision();
  t.is(rev, 'abc123');
});

test('getLatestAnalysisRevision returns null when no analyses', async t => {
  const client = createClient();
  mockGet(client, { data: { analyses: [] } });

  const rev = await client.getLatestAnalysisRevision();
  t.is(rev, null);
});

test('getLatestAnalysisRevision returns null on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));

  const rev = await client.getLatestAnalysisRevision();
  t.is(rev, null);
});

test('getLatestAnalysisRevision returns null when no revision in analysis', async t => {
  const client = createClient();
  mockGet(client, { data: { analyses: [{ date: '2024-01-01' }] } });

  const rev = await client.getLatestAnalysisRevision();
  t.is(rev, null);
});

// listAllProjects
test('listAllProjects fetches all projects', async t => {
  const client = createClient();
  mockGet(client, { data: { components: [{ key: 'p1' }, { key: 'p2' }], paging: { total: 2 } } });

  const projects = await client.listAllProjects();
  t.is(projects.length, 2);
});

// getHotspots
test('getHotspots fetches hotspots', async t => {
  const client = createClient();
  mockGet(client, { data: { hotspots: [{ key: 'h1' }], paging: { total: 1 } } });

  const hotspots = await client.getHotspots();
  t.is(hotspots.length, 1);
});

// getHotspotDetails
test('getHotspotDetails fetches details', async t => {
  const client = createClient();
  mockGet(client, { data: { key: 'h1', status: 'TO_REVIEW' } });

  const details = await client.getHotspotDetails('h1');
  t.is(details.key, 'h1');
});

// getProjectSettings
test('getProjectSettings fetches settings', async t => {
  const client = createClient();
  mockGet(client, { data: { settings: [{ key: 'sonar.coverage.exclusions' }] } });

  const settings = await client.getProjectSettings();
  t.is(settings.length, 1);
});

test('getProjectSettings uses custom projectKey', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { settings: [] } });

  await client.getProjectSettings('custom-project');
  t.is(stub.firstCall.args[1].params.component, 'custom-project');
});

// getProjectTags
test('getProjectTags fetches tags', async t => {
  const client = createClient();
  mockGet(client, { data: { tags: ['tag1', 'tag2'] } });

  const tags = await client.getProjectTags();
  t.deepEqual(tags, ['tag1', 'tag2']);
});

// getProjectLinks
test('getProjectLinks fetches links', async t => {
  const client = createClient();
  mockGet(client, { data: { links: [{ name: 'Homepage', url: 'http://example.com' }] } });

  const links = await client.getProjectLinks();
  t.is(links.length, 1);
});

test('getProjectLinks uses custom projectKey', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { links: [] } });

  await client.getProjectLinks('custom-project');
  t.is(stub.firstCall.args[1].params.projectKey, 'custom-project');
});

// getNewCodePeriods
test('getNewCodePeriods returns project-level and branch overrides', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({ data: { type: 'NUMBER_OF_DAYS', value: '30' } });
  stub.onSecondCall().resolves({ data: { newCodePeriods: [{ branchKey: 'main', type: 'PREVIOUS_VERSION' }] } });

  const result = await client.getNewCodePeriods();
  t.truthy(result.projectLevel);
  t.is(result.branchOverrides.length, 1);
});

test('getNewCodePeriods handles errors gracefully', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));

  const result = await client.getNewCodePeriods();
  t.is(result.projectLevel, null);
  t.deepEqual(result.branchOverrides, []);
});

// getAlmSettings
test('getAlmSettings returns settings', async t => {
  const client = createClient();
  mockGet(client, { data: { github: [{ key: 'gh' }] } });

  const settings = await client.getAlmSettings();
  t.truthy(settings.github);
});

test('getAlmSettings returns empty on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));

  const settings = await client.getAlmSettings();
  t.deepEqual(settings, {});
});

// getProjectBinding
test('getProjectBinding returns binding', async t => {
  const client = createClient();
  mockGet(client, { data: { alm: 'github', repository: 'org/repo' } });

  const binding = await client.getProjectBinding();
  t.is(binding.alm, 'github');
});

test('getProjectBinding returns null on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));

  const binding = await client.getProjectBinding();
  t.is(binding, null);
});

test('getProjectBinding uses custom projectKey', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { alm: 'github' } });

  await client.getProjectBinding('custom');
  t.is(stub.firstCall.args[1].params.project, 'custom');
});

// getQualityGates
test('getQualityGates returns data', async t => {
  const client = createClient();
  mockGet(client, { data: { qualitygates: [{ name: 'Sonar way' }] } });

  const result = await client.getQualityGates();
  t.truthy(result.qualitygates);
});

// getQualityGateDetails
test('getQualityGateDetails returns details', async t => {
  const client = createClient();
  mockGet(client, { data: { name: 'My Gate', conditions: [] } });

  const details = await client.getQualityGateDetails('My Gate');
  t.is(details.name, 'My Gate');
});

// getQualityGatePermissions
test('getQualityGatePermissions returns users and groups', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({ data: { users: [{ login: 'user1' }] } });
  stub.onSecondCall().resolves({ data: { groups: [{ name: 'group1' }] } });

  const perms = await client.getQualityGatePermissions('My Gate');
  t.is(perms.users.length, 1);
  t.is(perms.groups.length, 1);
});

test('getQualityGatePermissions handles errors', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));

  const perms = await client.getQualityGatePermissions('My Gate');
  t.deepEqual(perms.users, []);
  t.deepEqual(perms.groups, []);
});

// getAllQualityProfiles
test('getAllQualityProfiles returns all profiles', async t => {
  const client = createClient();
  mockGet(client, { data: { profiles: [{ key: 'p1' }, { key: 'p2' }] } });

  const profiles = await client.getAllQualityProfiles();
  t.is(profiles.length, 2);
});

// getQualityProfileBackup
test('getQualityProfileBackup returns XML', async t => {
  const client = createClient();
  mockGet(client, { data: '<xml>backup</xml>' });

  const xml = await client.getQualityProfileBackup('js', 'Sonar way');
  t.is(xml, '<xml>backup</xml>');
});

// getQualityProfilePermissions
test('getQualityProfilePermissions returns users and groups', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({ data: { users: [{ login: 'u1' }] } });
  stub.onSecondCall().resolves({ data: { groups: [{ name: 'g1' }] } });

  const perms = await client.getQualityProfilePermissions('js', 'Sonar way');
  t.is(perms.users.length, 1);
  t.is(perms.groups.length, 1);
});

test('getQualityProfilePermissions handles errors', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));

  const perms = await client.getQualityProfilePermissions('js', 'Sonar way');
  t.deepEqual(perms.users, []);
  t.deepEqual(perms.groups, []);
});

// getGroups
test('getGroups fetches groups', async t => {
  const client = createClient();
  mockGet(client, { data: { groups: [{ name: 'group1' }], paging: { total: 1 } } });

  const groups = await client.getGroups();
  t.is(groups.length, 1);
});

// getGlobalPermissions
test('getGlobalPermissions fetches permissions', async t => {
  const client = createClient();
  mockGet(client, { data: { groups: [{ name: 'admin' }], paging: { total: 1 } } });

  const perms = await client.getGlobalPermissions();
  t.is(perms.length, 1);
});

// getProjectPermissions
test('getProjectPermissions fetches project perms', async t => {
  const client = createClient();
  mockGet(client, { data: { groups: [{ name: 'dev' }], paging: { total: 1 } } });

  const perms = await client.getProjectPermissions('test-project');
  t.is(perms.length, 1);
});

// getPermissionTemplates
test('getPermissionTemplates fetches templates', async t => {
  const client = createClient();
  mockGet(client, { data: { permissionTemplates: [{ name: 'Default' }] } });

  const result = await client.getPermissionTemplates();
  t.truthy(result.permissionTemplates);
});

// getPortfolios
test('getPortfolios returns portfolios', async t => {
  const client = createClient();
  mockGet(client, { data: { views: [{ key: 'v1' }] } });

  const portfolios = await client.getPortfolios();
  t.is(portfolios.length, 1);
});

test('getPortfolios returns empty on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('Enterprise only'));

  const portfolios = await client.getPortfolios();
  t.deepEqual(portfolios, []);
});

// getPortfolioDetails
test('getPortfolioDetails returns details', async t => {
  const client = createClient();
  mockGet(client, { data: { key: 'v1', name: 'Portfolio 1' } });

  const details = await client.getPortfolioDetails('v1');
  t.is(details.key, 'v1');
});

test('getPortfolioDetails returns null on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));

  const details = await client.getPortfolioDetails('v1');
  t.is(details, null);
});

// getSystemInfo
test('getSystemInfo returns system info', async t => {
  const client = createClient();
  mockGet(client, { data: { System: { Version: '9.9' } } });

  const info = await client.getSystemInfo();
  t.truthy(info.System);
});

test('getSystemInfo falls back to system/status on error', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().rejects(new Error('admin required'));
  stub.onSecondCall().resolves({ data: { status: 'UP' } });

  const info = await client.getSystemInfo();
  t.is(info.status, 'UP');
});

// getInstalledPlugins
test('getInstalledPlugins returns plugins', async t => {
  const client = createClient();
  mockGet(client, { data: { plugins: [{ key: 'javascript' }] } });

  const plugins = await client.getInstalledPlugins();
  t.is(plugins.length, 1);
});

test('getInstalledPlugins returns empty on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));

  const plugins = await client.getInstalledPlugins();
  t.deepEqual(plugins, []);
});

// getWebhooks
test('getWebhooks fetches server-level webhooks', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { webhooks: [{ name: 'wh1' }] } });

  const hooks = await client.getWebhooks();
  t.is(hooks.length, 1);
  t.falsy(stub.firstCall.args[1].params.project);
});

test('getWebhooks fetches project-level webhooks', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { webhooks: [] } });

  await client.getWebhooks('my-project');
  t.is(stub.firstCall.args[1].params.project, 'my-project');
});

test('getWebhooks returns empty on error', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('fail'));

  const hooks = await client.getWebhooks();
  t.deepEqual(hooks, []);
});

// getIssuesWithComments
test('getIssuesWithComments fetches issues with comments field', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: { issues: [{ key: 'I1', comments: [] }], paging: { total: 1 } } });

  const issues = await client.getIssuesWithComments();
  t.is(issues.length, 1);
  t.is(stub.firstCall.args[1].params.additionalFields, 'comments');
});

// getIssueChangelog
test('getIssueChangelog fetches changelog for an issue', async t => {
  const client = createClient();
  const changelog = [
    { diffs: [{ key: 'status', oldValue: 'OPEN', newValue: 'CONFIRMED' }] }
  ];
  mockGet(client, { data: { changelog } });

  const result = await client.getIssueChangelog('ISSUE-1');
  t.deepEqual(result, changelog);
});

test('getIssueChangelog returns empty array when changelog is missing', async t => {
  const client = createClient();
  mockGet(client, { data: {} });

  const result = await client.getIssueChangelog('ISSUE-1');
  t.deepEqual(result, []);
});

// testConnection
test('testConnection returns true on success', async t => {
  const client = createClient();
  mockGet(client, { data: { status: 'UP' } });

  const result = await client.testConnection();
  t.true(result);
});

test('testConnection throws on failure', async t => {
  const client = createClient();
  sinon.stub(client.client, 'get').rejects(new Error('Connection failed'));

  await t.throwsAsync(() => client.testConnection());
});
