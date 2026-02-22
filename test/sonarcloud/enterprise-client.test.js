import test from 'ava';
import sinon from 'sinon';
import { EnterpriseClient } from '../../src/sonarcloud/enterprise-client.js';
import { migratePortfolios } from '../../src/sonarcloud/migrators/portfolios.js';
import { SonarCloudAPIError } from '../../src/utils/errors.js';

// ============================================================================
// Helpers
// ============================================================================

function createClient(overrides = {}) {
  return new EnterpriseClient({
    url: 'https://sonarcloud.io',
    token: 'test-token',
    rateLimit: { maxRetries: 0, baseDelay: 10 },
    ...overrides
  });
}

function mockGet(client, response) {
  return sinon.stub(client.client, 'get').resolves(response);
}

function mockPost(client, response) {
  return sinon.stub(client.client, 'post').resolves(response || { data: {} });
}

function mockPatch(client, response) {
  return sinon.stub(client.client, 'patch').resolves(response || { data: {} });
}

function mockDelete(client) {
  return sinon.stub(client.client, 'delete').resolves({});
}

test.afterEach(() => sinon.restore());

// ============================================================================
// EnterpriseClient - Constructor
// ============================================================================

test('constructor derives correct base URL from sonarcloud.io', t => {
  const client = createClient({ url: 'https://sonarcloud.io' });
  t.is(client.baseURL, 'https://api.sonarcloud.io/enterprises');
});

test('constructor derives correct base URL from sc-staging.io', t => {
  const client = createClient({ url: 'https://sc-staging.io' });
  t.is(client.baseURL, 'https://api.sc-staging.io/enterprises');
});

test('constructor stores token', t => {
  const client = createClient({ token: 'my-secret-token' });
  t.is(client.token, 'my-secret-token');
});

test('constructor sets Bearer auth header on axios instance', t => {
  const client = createClient({ token: 'bearer-test-token' });
  t.is(client.client.defaults.headers['Authorization'], 'Bearer bearer-test-token');
});

test('constructor sets Content-Type and Accept headers', t => {
  const client = createClient();
  t.is(client.client.defaults.headers['Content-Type'], 'application/json');
  t.is(client.client.defaults.headers['Accept'], 'application/json');
});

test('constructor sets baseURL on axios instance', t => {
  const client = createClient({ url: 'https://sonarcloud.io' });
  t.is(client.client.defaults.baseURL, 'https://api.sonarcloud.io/enterprises');
});

test('constructor sets timeout of 60000ms', t => {
  const client = createClient();
  t.is(client.client.defaults.timeout, 60000);
});

test('constructor uses default rateLimit when none provided', t => {
  // This just exercises the default path for maxRetries and baseDelay
  const client = new EnterpriseClient({
    url: 'https://sonarcloud.io',
    token: 'tok'
  });
  // Should not throw
  t.truthy(client);
  t.is(client.baseURL, 'https://api.sonarcloud.io/enterprises');
});

// ============================================================================
// EnterpriseClient - _handleError
// ============================================================================

test('_handleError throws SonarCloudAPIError with response status and message from data.message', t => {
  const client = createClient();
  const error = {
    response: {
      status: 400,
      data: { message: 'Bad request' },
      config: { url: '/enterprises' }
    }
  };
  const thrown = t.throws(() => client._handleError(error), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('400'));
  t.true(thrown.message.includes('Bad request'));
  t.is(thrown.statusCode, 400);
  t.is(thrown.endpoint, '/enterprises');
});

test('_handleError extracts message from data.errors array', t => {
  const client = createClient();
  const error = {
    response: {
      status: 422,
      data: { errors: [{ msg: 'Validation failed' }] },
      config: { url: '/portfolios' }
    }
  };
  const thrown = t.throws(() => client._handleError(error), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('Validation failed'));
  t.is(thrown.statusCode, 422);
});

test('_handleError falls back to error.message when no data message', t => {
  const client = createClient();
  const error = {
    response: {
      status: 500,
      data: {},
      config: { url: '/portfolios' }
    },
    message: 'Fallback message'
  };
  const thrown = t.throws(() => client._handleError(error), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('Fallback message'));
});

test('_handleError throws network error when request exists but no response', t => {
  const client = createClient();
  const error = {
    request: {},
    message: 'ECONNREFUSED',
    config: { url: '/enterprises' }
  };
  const thrown = t.throws(() => client._handleError(error), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('Cannot connect'));
  t.true(thrown.message.includes('ECONNREFUSED'));
  t.is(thrown.statusCode, 0);
});

test('_handleError network error includes baseURL', t => {
  const client = createClient({ url: 'https://sc-staging.io' });
  const error = {
    request: {},
    message: 'timeout',
    config: { url: '/enterprises' }
  };
  const thrown = t.throws(() => client._handleError(error), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('api.sc-staging.io'));
});

test('_handleError network error handles missing config.url', t => {
  const client = createClient();
  const error = {
    request: {},
    message: 'network fail'
  };
  const thrown = t.throws(() => client._handleError(error), { instanceOf: SonarCloudAPIError });
  // error.config is undefined, so error.config?.url is undefined, which becomes endpoint=undefined in constructor
  // However SonarCloudAPIError defaults endpoint to null
  t.is(thrown.endpoint, null);
});

test('_handleError throws generic error when neither response nor request', t => {
  const client = createClient();
  const error = { message: 'Something unexpected' };
  const thrown = t.throws(() => client._handleError(error), { instanceOf: SonarCloudAPIError });
  t.true(thrown.message.includes('request failed'));
  t.true(thrown.message.includes('Something unexpected'));
});

// ============================================================================
// EnterpriseClient - resolveEnterpriseId
// ============================================================================

test('resolveEnterpriseId returns enterprise ID on success', async t => {
  const client = createClient();
  mockGet(client, { data: [{ id: 'ent-uuid-123', name: 'My Enterprise' }] });
  const id = await client.resolveEnterpriseId('my-enterprise');
  t.is(id, 'ent-uuid-123');
});

test('resolveEnterpriseId returns first enterprise ID when multiple', async t => {
  const client = createClient();
  mockGet(client, { data: [{ id: 'first-id' }, { id: 'second-id' }] });
  const id = await client.resolveEnterpriseId('key');
  t.is(id, 'first-id');
});

test('resolveEnterpriseId passes enterpriseKey as param', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: [{ id: 'id-1' }] });
  await client.resolveEnterpriseId('my-key');
  t.deepEqual(stub.firstCall.args[1], { params: { enterpriseKey: 'my-key' } });
});

test('resolveEnterpriseId calls GET /enterprises', async t => {
  const client = createClient();
  const stub = mockGet(client, { data: [{ id: 'id-1' }] });
  await client.resolveEnterpriseId('key');
  t.is(stub.firstCall.args[0], '/enterprises');
});

test('resolveEnterpriseId throws when response is empty array', async t => {
  const client = createClient();
  mockGet(client, { data: [] });
  await t.throwsAsync(
    () => client.resolveEnterpriseId('missing-key'),
    { instanceOf: SonarCloudAPIError, message: /Enterprise not found: missing-key/ }
  );
});

test('resolveEnterpriseId throws when response is not an array', async t => {
  const client = createClient();
  mockGet(client, { data: { id: 'not-array' } });
  await t.throwsAsync(
    () => client.resolveEnterpriseId('bad-key'),
    { instanceOf: SonarCloudAPIError, message: /Enterprise not found/ }
  );
});

test('resolveEnterpriseId throws when response data is null', async t => {
  const client = createClient();
  mockGet(client, { data: null });
  await t.throwsAsync(
    () => client.resolveEnterpriseId('null-key'),
    { instanceOf: SonarCloudAPIError, message: /Enterprise not found/ }
  );
});

// ============================================================================
// EnterpriseClient - listPortfolios
// ============================================================================

test('listPortfolios returns all portfolios from single page', async t => {
  const client = createClient();
  mockGet(client, {
    data: {
      portfolios: [{ id: 'p1', name: 'Portfolio 1' }, { id: 'p2', name: 'Portfolio 2' }],
      page: { total: 2 }
    }
  });
  const result = await client.listPortfolios('ent-id');
  t.is(result.length, 2);
  t.is(result[0].id, 'p1');
  t.is(result[1].id, 'p2');
});

test('listPortfolios paginates across multiple pages', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({
    data: {
      portfolios: [{ id: 'p1' }, { id: 'p2' }],
      page: { total: 3 }
    }
  });
  stub.onSecondCall().resolves({
    data: {
      portfolios: [{ id: 'p3' }],
      page: { total: 3 }
    }
  });
  const result = await client.listPortfolios('ent-id');
  t.is(result.length, 3);
  t.is(stub.callCount, 2);
});

test('listPortfolios sends correct params', async t => {
  const client = createClient();
  const stub = mockGet(client, {
    data: { portfolios: [], page: { total: 0 } }
  });
  await client.listPortfolios('ent-uuid', 25);
  t.deepEqual(stub.firstCall.args[1], { params: { enterpriseId: 'ent-uuid', pageSize: 25, pageIndex: 1 } });
});

test('listPortfolios handles empty portfolios list', async t => {
  const client = createClient();
  mockGet(client, {
    data: { portfolios: [], page: { total: 0 } }
  });
  const result = await client.listPortfolios('ent-id');
  t.deepEqual(result, []);
});

test('listPortfolios handles missing portfolios key', async t => {
  const client = createClient();
  mockGet(client, {
    data: { page: { total: 0 } }
  });
  const result = await client.listPortfolios('ent-id');
  t.deepEqual(result, []);
});

test('listPortfolios handles missing page.total gracefully', async t => {
  const client = createClient();
  mockGet(client, {
    data: { portfolios: [{ id: 'p1' }] }
  });
  // When page is undefined, (page.page?.total || 0) = 0, portfolios.length=1 >= 0, so it breaks after first call
  const result = await client.listPortfolios('ent-id');
  t.is(result.length, 1);
});

test('listPortfolios uses default pageSize of 50', async t => {
  const client = createClient();
  const stub = mockGet(client, {
    data: { portfolios: [], page: { total: 0 } }
  });
  await client.listPortfolios('ent-id');
  t.is(stub.firstCall.args[1].params.pageSize, 50);
});

// ============================================================================
// EnterpriseClient - createPortfolio
// ============================================================================

test('createPortfolio sends POST and returns data', async t => {
  const client = createClient();
  const stub = mockPost(client, { data: { id: 'new-p', name: 'New Portfolio' } });
  const result = await client.createPortfolio({
    name: 'New Portfolio',
    enterpriseId: 'ent-1',
    description: 'A test portfolio',
    selection: 'projects',
    projects: [{ id: 'proj-1' }],
    tags: ['tag1'],
    organizationIds: ['org-1']
  });
  t.is(result.id, 'new-p');
  t.is(result.name, 'New Portfolio');
  t.true(stub.calledOnce);
  t.is(stub.firstCall.args[0], '/portfolios');
});

test('createPortfolio sends correct body payload', async t => {
  const client = createClient();
  const stub = mockPost(client, { data: { id: 'p1' } });
  await client.createPortfolio({
    name: 'Test',
    enterpriseId: 'ent-1',
    description: 'desc',
    selection: 'projects',
    projects: [{ id: 'a' }],
    tags: ['t1'],
    organizationIds: ['o1']
  });
  const body = stub.firstCall.args[1];
  t.is(body.name, 'Test');
  t.is(body.enterpriseId, 'ent-1');
  t.is(body.description, 'desc');
  t.is(body.selection, 'projects');
  t.deepEqual(body.projects, [{ id: 'a' }]);
  t.deepEqual(body.tags, ['t1']);
  t.deepEqual(body.organizationIds, ['o1']);
});

test('createPortfolio uses default values for optional params', async t => {
  const client = createClient();
  const stub = mockPost(client, { data: { id: 'p1' } });
  await client.createPortfolio({ name: 'Minimal', enterpriseId: 'ent-1' });
  const body = stub.firstCall.args[1];
  t.is(body.description, '');
  t.is(body.selection, 'projects');
  t.deepEqual(body.projects, []);
  t.deepEqual(body.tags, []);
  t.deepEqual(body.organizationIds, []);
});

// ============================================================================
// EnterpriseClient - updatePortfolio
// ============================================================================

test('updatePortfolio sends PATCH and returns data', async t => {
  const client = createClient();
  const stub = mockPatch(client, { data: { id: 'p1', name: 'Updated' } });
  const result = await client.updatePortfolio('p1', {
    name: 'Updated',
    description: 'Updated desc',
    selection: 'projects',
    projects: [{ id: 'a' }],
    tags: [],
    organizationIds: []
  });
  t.is(result.id, 'p1');
  t.is(result.name, 'Updated');
  t.true(stub.calledOnce);
  t.is(stub.firstCall.args[0], '/portfolios/p1');
});

test('updatePortfolio sends correct body', async t => {
  const client = createClient();
  const stub = mockPatch(client, { data: {} });
  await client.updatePortfolio('p1', {
    name: 'Name',
    description: 'Desc',
    selection: 'projects',
    projects: [{ id: 'x' }],
    tags: ['t'],
    organizationIds: ['o']
  });
  const body = stub.firstCall.args[1];
  t.is(body.name, 'Name');
  t.is(body.description, 'Desc');
  t.deepEqual(body.projects, [{ id: 'x' }]);
});

test('updatePortfolio uses default values for optional params', async t => {
  const client = createClient();
  const stub = mockPatch(client, { data: {} });
  await client.updatePortfolio('p1', { name: 'Only Name' });
  const body = stub.firstCall.args[1];
  t.is(body.description, '');
  t.is(body.selection, 'projects');
  t.deepEqual(body.projects, []);
  t.deepEqual(body.tags, []);
  t.deepEqual(body.organizationIds, []);
});

// ============================================================================
// EnterpriseClient - deletePortfolio
// ============================================================================

test('deletePortfolio sends DELETE to correct path', async t => {
  const client = createClient();
  const stub = mockDelete(client);
  await client.deletePortfolio('port-123');
  t.true(stub.calledOnce);
  t.is(stub.firstCall.args[0], '/portfolios/port-123');
});

test('deletePortfolio does not return data', async t => {
  const client = createClient();
  mockDelete(client);
  const result = await client.deletePortfolio('port-1');
  t.is(result, undefined);
});

// ============================================================================
// EnterpriseClient - getSelectableOrganizations
// ============================================================================

test('getSelectableOrganizations returns all orgs from single page', async t => {
  const client = createClient();
  mockGet(client, {
    data: {
      organizations: [{ id: 'org1', name: 'Org One' }, { id: 'org2', name: 'Org Two' }],
      page: { total: 2 }
    }
  });
  const result = await client.getSelectableOrganizations('port-1');
  t.is(result.length, 2);
  t.is(result[0].id, 'org1');
});

test('getSelectableOrganizations paginates across multiple pages', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({
    data: {
      organizations: [{ id: 'org1' }, { id: 'org2' }],
      page: { total: 3 }
    }
  });
  stub.onSecondCall().resolves({
    data: {
      organizations: [{ id: 'org3' }],
      page: { total: 3 }
    }
  });
  const result = await client.getSelectableOrganizations('port-1');
  t.is(result.length, 3);
  t.is(stub.callCount, 2);
});

test('getSelectableOrganizations sends correct params', async t => {
  const client = createClient();
  const stub = mockGet(client, {
    data: { organizations: [], page: { total: 0 } }
  });
  await client.getSelectableOrganizations('port-1', 30);
  t.deepEqual(stub.firstCall.args[1], { params: { portfolioId: 'port-1', pageSize: 30, pageIndex: 1 } });
});

test('getSelectableOrganizations calls GET /portfolio-organizations', async t => {
  const client = createClient();
  const stub = mockGet(client, {
    data: { organizations: [], page: { total: 0 } }
  });
  await client.getSelectableOrganizations('port-1');
  t.is(stub.firstCall.args[0], '/portfolio-organizations');
});

test('getSelectableOrganizations handles empty organizations', async t => {
  const client = createClient();
  mockGet(client, {
    data: { organizations: [], page: { total: 0 } }
  });
  const result = await client.getSelectableOrganizations('port-1');
  t.deepEqual(result, []);
});

test('getSelectableOrganizations handles missing organizations key', async t => {
  const client = createClient();
  mockGet(client, {
    data: { page: { total: 0 } }
  });
  const result = await client.getSelectableOrganizations('port-1');
  t.deepEqual(result, []);
});

test('getSelectableOrganizations uses default pageSize of 50', async t => {
  const client = createClient();
  const stub = mockGet(client, {
    data: { organizations: [], page: { total: 0 } }
  });
  await client.getSelectableOrganizations('port-1');
  t.is(stub.firstCall.args[1].params.pageSize, 50);
});

// ============================================================================
// EnterpriseClient - getSelectableProjects
// ============================================================================

test('getSelectableProjects returns all projects from single page', async t => {
  const client = createClient();
  mockGet(client, {
    data: {
      projects: [
        { id: 'proj-1', projectKey: 'key1', branchId: 'b1' },
        { id: 'proj-2', projectKey: 'key2', branchId: 'b2' }
      ],
      page: { total: 2 }
    }
  });
  const result = await client.getSelectableProjects('port-1', 'org-1');
  t.is(result.length, 2);
  t.is(result[0].projectKey, 'key1');
});

test('getSelectableProjects paginates across multiple pages', async t => {
  const client = createClient();
  const stub = sinon.stub(client.client, 'get');
  stub.onFirstCall().resolves({
    data: {
      projects: [{ id: 'p1' }, { id: 'p2' }],
      page: { total: 3 }
    }
  });
  stub.onSecondCall().resolves({
    data: {
      projects: [{ id: 'p3' }],
      page: { total: 3 }
    }
  });
  const result = await client.getSelectableProjects('port-1', 'org-1');
  t.is(result.length, 3);
  t.is(stub.callCount, 2);
});

test('getSelectableProjects sends correct params', async t => {
  const client = createClient();
  const stub = mockGet(client, {
    data: { projects: [], page: { total: 0 } }
  });
  await client.getSelectableProjects('port-1', 'org-1', 25);
  t.deepEqual(stub.firstCall.args[1], {
    params: { portfolioId: 'port-1', organizationId: 'org-1', pageSize: 25, pageIndex: 1 }
  });
});

test('getSelectableProjects calls GET /portfolio-projects', async t => {
  const client = createClient();
  const stub = mockGet(client, {
    data: { projects: [], page: { total: 0 } }
  });
  await client.getSelectableProjects('port-1', 'org-1');
  t.is(stub.firstCall.args[0], '/portfolio-projects');
});

test('getSelectableProjects handles empty projects', async t => {
  const client = createClient();
  mockGet(client, {
    data: { projects: [], page: { total: 0 } }
  });
  const result = await client.getSelectableProjects('port-1', 'org-1');
  t.deepEqual(result, []);
});

test('getSelectableProjects handles missing projects key', async t => {
  const client = createClient();
  mockGet(client, {
    data: { page: { total: 0 } }
  });
  const result = await client.getSelectableProjects('port-1', 'org-1');
  t.deepEqual(result, []);
});

test('getSelectableProjects uses default pageSize of 50', async t => {
  const client = createClient();
  const stub = mockGet(client, {
    data: { projects: [], page: { total: 0 } }
  });
  await client.getSelectableProjects('port-1', 'org-1');
  t.is(stub.firstCall.args[1].params.pageSize, 50);
});

// ============================================================================
// EnterpriseClient - Response Interceptor Success Path
// ============================================================================

test('response interceptor passes through successful responses', async t => {
  const client = createClient();
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.fulfilled);
  t.truthy(handler);

  const mockResponse = { data: { result: 'ok' }, status: 200 };
  const result = handler.fulfilled(mockResponse);
  t.deepEqual(result, mockResponse);
});

// ============================================================================
// EnterpriseClient - Retry Interceptor
// ============================================================================

test('retry interceptor increments _retryCount on 503', async t => {
  const client = createClient({ rateLimit: { maxRetries: 1, baseDelay: 10 } });
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);
  t.truthy(handler);

  // Stub the client call for retry
  sinon.stub(client, 'client').resolves({ data: {} });

  const error = {
    response: { status: 503 },
    config: { _retryCount: 0 }
  };

  try {
    await handler.rejected(error);
  } catch {
    // May throw depending on the stub behavior
  }
  t.is(error.config._retryCount, 1);
});

test('retry interceptor increments _retryCount on 429', async t => {
  const client = createClient({ rateLimit: { maxRetries: 1, baseDelay: 10 } });
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);

  sinon.stub(client, 'client').resolves({ data: {} });

  const error = {
    response: { status: 429 },
    config: { _retryCount: 0 }
  };

  try {
    await handler.rejected(error);
  } catch {
    // May throw
  }
  t.is(error.config._retryCount, 1);
});

test('retry interceptor falls through to _handleError after maxRetries exhausted', async t => {
  const client = createClient({ rateLimit: { maxRetries: 1, baseDelay: 10 } });
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);

  const error = {
    response: { status: 503, data: { message: 'Service unavailable' }, config: { url: '/portfolios' } },
    config: { _retryCount: 1 } // already at max (maxRetries=1)
  };

  await t.throwsAsync(
    () => handler.rejected(error),
    { instanceOf: SonarCloudAPIError }
  );
});

test('retry interceptor calls _handleError for non-retryable status codes', async t => {
  const client = createClient({ rateLimit: { maxRetries: 3, baseDelay: 10 } });
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);

  const error = {
    response: { status: 404, data: { message: 'Not found' }, config: { url: '/portfolios' } },
    config: {}
  };

  await t.throwsAsync(
    () => handler.rejected(error),
    { instanceOf: SonarCloudAPIError }
  );
});

test('retry interceptor handles error without config (no retry)', async t => {
  const client = createClient({ rateLimit: { maxRetries: 3, baseDelay: 10 } });
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);

  const error = {
    response: { status: 503, data: {}, config: { url: '/test' } },
    config: undefined
  };

  // With no config, the retry condition (status === 503 && cfg) is false since cfg is undefined
  await t.throwsAsync(
    () => handler.rejected(error),
    { instanceOf: SonarCloudAPIError }
  );
});

test('retry interceptor initializes _retryCount when not set', async t => {
  const client = createClient({ rateLimit: { maxRetries: 2, baseDelay: 10 } });
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);

  sinon.stub(client, 'client').resolves({ data: {} });

  const error = {
    response: { status: 503 },
    config: {} // no _retryCount yet
  };

  try {
    await handler.rejected(error);
  } catch {
    // May throw
  }
  // Should have set _retryCount to 1 from (0 || 0) + 1
  t.is(error.config._retryCount, 1);
});

test('retry interceptor handles error without response (network error)', async t => {
  const client = createClient({ rateLimit: { maxRetries: 3, baseDelay: 10 } });
  const responseHandlers = client.client.interceptors.response.handlers;
  const handler = responseHandlers.find(h => h && h.rejected);

  const error = {
    request: {},
    message: 'Network error',
    config: { url: '/test' }
  };

  // No response means status is undefined, so (status === 503 || status === 429) is false
  await t.throwsAsync(
    () => handler.rejected(error),
    { instanceOf: SonarCloudAPIError }
  );
});

// ============================================================================
// migratePortfolios - Returns 0 for edge cases
// ============================================================================

test.serial('migratePortfolios returns 0 when no enterprise key configured', async t => {
  const result = await migratePortfolios(
    [{ name: 'Portfolio', projects: [] }],
    new Map(),
    null, // no enterprise config
    { url: 'https://sonarcloud.io', token: 'token' },
    {}
  );
  t.is(result, 0);
});

test.serial('migratePortfolios returns 0 when enterprise config has no key', async t => {
  const result = await migratePortfolios(
    [{ name: 'Portfolio', projects: [] }],
    new Map(),
    {}, // empty enterprise config, no .key
    { url: 'https://sonarcloud.io', token: 'token' },
    {}
  );
  t.is(result, 0);
});

test.serial('migratePortfolios returns 0 when portfolio list is empty', async t => {
  const result = await migratePortfolios(
    [],
    new Map(),
    { key: 'enterprise-key' },
    { url: 'https://sonarcloud.io', token: 'token' },
    {}
  );
  t.is(result, 0);
});

// ============================================================================
// migratePortfolios - Creates new portfolios
// ============================================================================

test.serial('migratePortfolios creates new portfolios', async t => {
  // Stub EnterpriseClient.prototype methods
  const resolveStub = sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  const listStub = sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]); // no existing
  const createStub = sinon.stub(EnterpriseClient.prototype, 'createPortfolio').resolves({ id: 'temp-id' });
  const deleteStub = sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  const getOrgsStub = sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([
    { id: 'org-1', name: 'Org 1' }
  ]);
  const getProjectsStub = sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([
    { id: 'proj-uuid-1', projectKey: 'sc-project-a', branchId: 'branch-1' }
  ]);
  const updateStub = sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const projectKeyMapping = new Map([['sq-project-a', 'sc-project-a']]);

  const portfolios = [
    {
      name: 'My Portfolio',
      description: 'Test',
      selectionMode: 'MANUAL',
      projects: [{ key: 'sq-project-a' }]
    }
  ];

  const result = await migratePortfolios(
    portfolios,
    projectKeyMapping,
    { key: 'my-enterprise' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  t.is(result, 1);
  t.true(resolveStub.calledOnce);
  t.true(listStub.calledOnce);
  // createPortfolio called twice: once for temp portfolio in buildProjectUuidMap, once for actual portfolio
  t.is(createStub.callCount, 2);
  t.true(deleteStub.calledOnce); // temp portfolio deleted
  t.true(getOrgsStub.calledOnce);
  t.true(getProjectsStub.calledOnce);
  t.false(updateStub.called); // not updating, creating new

  sinon.restore();
});

// ============================================================================
// migratePortfolios - Updates existing portfolios
// ============================================================================

test.serial('migratePortfolios updates existing portfolios', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([
    { id: 'existing-p1', name: 'Existing Portfolio', projects: [] }
  ]);
  sinon.stub(EnterpriseClient.prototype, 'createPortfolio').resolves({ id: 'temp-id' });
  sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([
    { id: 'org-1', name: 'Org 1' }
  ]);
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([
    { id: 'proj-uuid-1', projectKey: 'sc-key', branchId: 'br-1' }
  ]);
  const updateStub = sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const portfolios = [
    {
      name: 'Existing Portfolio',
      description: 'Updated desc',
      selectionMode: 'MANUAL',
      projects: [{ key: 'sc-key' }]
    }
  ];

  const result = await migratePortfolios(
    portfolios,
    new Map(), // no mapping needed, key matches directly
    { key: 'ent-key' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  t.is(result, 1);
  t.true(updateStub.calledOnce);
  t.is(updateStub.firstCall.args[0], 'existing-p1');
  t.is(updateStub.firstCall.args[1].name, 'Existing Portfolio');
  t.is(updateStub.firstCall.args[1].projects.length, 1);

  sinon.restore();
});

// ============================================================================
// migratePortfolios - Skips existing portfolio with no projects to add
// ============================================================================

test.serial('migratePortfolios skips existing portfolio when both have zero projects', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([
    { id: 'existing-p1', name: 'Empty Portfolio', projects: [] }
  ]);
  sinon.stub(EnterpriseClient.prototype, 'createPortfolio').resolves({ id: 'temp-id' });
  sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([]);
  const updateStub = sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const portfolios = [
    {
      name: 'Empty Portfolio',
      selectionMode: 'MANUAL',
      projects: [] // no projects in SQ either
    }
  ];

  const result = await migratePortfolios(
    portfolios,
    new Map(),
    { key: 'ent-key' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  t.is(result, 0); // skipped, not updated
  t.false(updateStub.called);

  sinon.restore();
});

// ============================================================================
// migratePortfolios - Handles per-portfolio errors gracefully
// ============================================================================

test.serial('migratePortfolios handles per-portfolio errors gracefully and continues', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]);
  const createStub = sinon.stub(EnterpriseClient.prototype, 'createPortfolio');
  // First call is for temp portfolio (succeeds), second and third are real portfolios
  createStub.onFirstCall().resolves({ id: 'temp-id' });
  createStub.onSecondCall().rejects(new Error('API error for portfolio 1'));
  createStub.onThirdCall().resolves({ id: 'p2' });

  sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const portfolios = [
    { name: 'Failing Portfolio', selectionMode: 'MANUAL', projects: [] },
    { name: 'Succeeding Portfolio', selectionMode: 'MANUAL', projects: [] }
  ];

  const result = await migratePortfolios(
    portfolios,
    new Map(),
    { key: 'ent-key' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  // One succeeded, one failed
  t.is(result, 1);

  sinon.restore();
});

// ============================================================================
// migratePortfolios - resolvePortfolioProjects with REST mode (all projects)
// ============================================================================

test.serial('migratePortfolios with REST selectionMode includes all selectable projects', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]);
  const createStub = sinon.stub(EnterpriseClient.prototype, 'createPortfolio');
  createStub.onFirstCall().resolves({ id: 'temp-id' }); // temp portfolio
  createStub.onSecondCall().resolves({ id: 'new-p1' }); // actual portfolio

  sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([
    { id: 'org-1', name: 'Org' }
  ]);
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([
    { id: 'uuid-a', projectKey: 'proj-a', branchId: 'br-a' },
    { id: 'uuid-b', projectKey: 'proj-b', branchId: 'br-b' },
    { id: 'uuid-c', projectKey: 'proj-c', branchId: 'br-c' }
  ]);
  sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const portfolios = [
    {
      name: 'All Projects Portfolio',
      selectionMode: 'REST', // this means "all projects"
      projects: []
    }
  ];

  const result = await migratePortfolios(
    portfolios,
    new Map(),
    { key: 'ent-key' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  t.is(result, 1);
  // The actual create call should have 3 projects (all selectable)
  const actualCreateCall = createStub.secondCall;
  t.is(actualCreateCall.args[0].projects.length, 3);

  sinon.restore();
});

// ============================================================================
// migratePortfolios - resolvePortfolioProjects with MANUAL mode skips unmapped
// ============================================================================

test.serial('migratePortfolios with MANUAL mode skips unmapped projects', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]);
  const createStub = sinon.stub(EnterpriseClient.prototype, 'createPortfolio');
  createStub.onFirstCall().resolves({ id: 'temp-id' });
  createStub.onSecondCall().resolves({ id: 'new-p1' });

  sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([
    { id: 'org-1', name: 'Org' }
  ]);
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([
    { id: 'uuid-a', projectKey: 'sc-proj-a', branchId: 'br-a' }
    // sc-proj-b is NOT in the selectable projects
  ]);
  sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const projectKeyMapping = new Map([
    ['sq-proj-a', 'sc-proj-a'],
    ['sq-proj-b', 'sc-proj-b']
  ]);

  const portfolios = [
    {
      name: 'Manual Portfolio',
      selectionMode: 'MANUAL',
      projects: [
        { key: 'sq-proj-a' }, // maps to sc-proj-a, which IS in UUID map
        { key: 'sq-proj-b' }  // maps to sc-proj-b, which is NOT in UUID map
      ]
    }
  ];

  const result = await migratePortfolios(
    portfolios,
    projectKeyMapping,
    { key: 'ent-key' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  t.is(result, 1);
  // Only 1 project should be included (the mapped one)
  const actualCreateCall = createStub.secondCall;
  t.is(actualCreateCall.args[0].projects.length, 1);
  t.is(actualCreateCall.args[0].projects[0].id, 'uuid-a');

  sinon.restore();
});

// ============================================================================
// migratePortfolios - resolvePortfolioProjects uses project key directly when no mapping
// ============================================================================

test.serial('migratePortfolios MANUAL mode uses project key directly when no mapping exists', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]);
  const createStub = sinon.stub(EnterpriseClient.prototype, 'createPortfolio');
  createStub.onFirstCall().resolves({ id: 'temp-id' });
  createStub.onSecondCall().resolves({ id: 'new-p1' });

  sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([
    { id: 'org-1', name: 'Org' }
  ]);
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([
    { id: 'uuid-direct', projectKey: 'direct-key', branchId: 'br-d' }
  ]);
  sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  // Empty mapping - key falls through to project.key directly
  const projectKeyMapping = new Map();

  const portfolios = [
    {
      name: 'Direct Key Portfolio',
      selectionMode: 'MANUAL',
      projects: [{ key: 'direct-key' }]
    }
  ];

  const result = await migratePortfolios(
    portfolios,
    projectKeyMapping,
    { key: 'ent-key' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  t.is(result, 1);
  const actualCreateCall = createStub.secondCall;
  t.is(actualCreateCall.args[0].projects.length, 1);
  t.is(actualCreateCall.args[0].projects[0].id, 'uuid-direct');

  sinon.restore();
});

// ============================================================================
// migratePortfolios - buildProjectUuidMap creates and deletes temp portfolio
// ============================================================================

test.serial('migratePortfolios buildProjectUuidMap creates temp portfolio and deletes it', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]);
  const createStub = sinon.stub(EnterpriseClient.prototype, 'createPortfolio');
  createStub.onFirstCall().resolves({ id: 'temp-portfolio-id' });
  createStub.onSecondCall().resolves({ id: 'real-id' });

  const deleteStub = sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([
    { id: 'org-1', name: 'Org A' },
    { id: 'org-2', name: 'Org B' }
  ]);
  const getProjectsStub = sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects');
  getProjectsStub.onFirstCall().resolves([
    { id: 'u1', projectKey: 'key-1', branchId: 'b1' }
  ]);
  getProjectsStub.onSecondCall().resolves([
    { id: 'u2', projectKey: 'key-2', branchId: 'b2' }
  ]);
  sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const portfolios = [
    { name: 'Test', selectionMode: 'REST', projects: [] }
  ];

  await migratePortfolios(
    portfolios,
    new Map(),
    { key: 'ent-key' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  // Temp portfolio name starts with _cloudvoyager_temp_lookup_
  const tempCreateCall = createStub.firstCall;
  t.true(tempCreateCall.args[0].name.startsWith('_cloudvoyager_temp_lookup_'));
  t.is(tempCreateCall.args[0].enterpriseId, 'ent-uuid');

  // Temp portfolio should be deleted
  t.true(deleteStub.calledWith('temp-portfolio-id'));

  // getSelectableOrganizations should be called with temp portfolio id
  t.true(EnterpriseClient.prototype.getSelectableOrganizations.calledWith('temp-portfolio-id'));

  // getSelectableProjects should be called once per org
  t.is(getProjectsStub.callCount, 2);
  t.true(getProjectsStub.calledWith('temp-portfolio-id', 'org-1'));
  t.true(getProjectsStub.calledWith('temp-portfolio-id', 'org-2'));

  sinon.restore();
});

// ============================================================================
// migratePortfolios - buildProjectUuidMap deletes temp portfolio even on error
// ============================================================================

test.serial('migratePortfolios buildProjectUuidMap deletes temp portfolio even when getSelectableOrganizations fails', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]);
  const createStub = sinon.stub(EnterpriseClient.prototype, 'createPortfolio');
  createStub.onFirstCall().resolves({ id: 'temp-id' });

  const deleteStub = sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').rejects(new Error('Org fetch failed'));
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const portfolios = [
    { name: 'Test', selectionMode: 'MANUAL', projects: [] }
  ];

  // buildProjectUuidMap should throw, which bubbles up since it's not in the per-portfolio try/catch
  await t.throwsAsync(
    () => migratePortfolios(
      portfolios,
      new Map(),
      { key: 'ent-key' },
      { url: 'https://sonarcloud.io', token: 'tok' },
      { maxRetries: 0, baseDelay: 10 }
    ),
    { message: /Org fetch failed/ }
  );

  // Despite the error, temp portfolio should still be deleted (finally block)
  t.true(deleteStub.calledWith('temp-id'));

  sinon.restore();
});

// ============================================================================
// migratePortfolios - Uses orgConfig.url default when not provided
// ============================================================================

test.serial('migratePortfolios uses default URL when orgConfig.url is not set', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'createPortfolio').resolves({ id: 'temp-id' });
  sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const portfolios = [
    { name: 'Test', selectionMode: 'MANUAL', projects: [] }
  ];

  const result = await migratePortfolios(
    portfolios,
    new Map(),
    { key: 'ent-key' },
    { token: 'tok' }, // no url field
    {}
  );

  // Should not throw; uses default 'https://sonarcloud.io'
  t.is(result, 1);

  sinon.restore();
});

// ============================================================================
// migratePortfolios - Mixed create and update in single run
// ============================================================================

test.serial('migratePortfolios handles mix of new and existing portfolios', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([
    { id: 'existing-id', name: 'Existing One', projects: [{ id: 'old-proj' }] }
  ]);
  const createStub = sinon.stub(EnterpriseClient.prototype, 'createPortfolio');
  createStub.onFirstCall().resolves({ id: 'temp-id' }); // temp
  createStub.onSecondCall().resolves({ id: 'new-id' }); // new portfolio
  sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([]);
  const updateStub = sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const portfolios = [
    { name: 'Existing One', selectionMode: 'MANUAL', projects: [] },
    { name: 'Brand New', selectionMode: 'MANUAL', projects: [] }
  ];

  const result = await migratePortfolios(
    portfolios,
    new Map(),
    { key: 'ent-key' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  // 'Existing One' has projects: [{ id: 'old-proj' }] (length 1) but resolved is [] (length 0), so not equal → update
  // 'Brand New' is new → create
  t.is(result, 2);
  t.true(updateStub.calledOnce);
  // createStub called twice: temp portfolio + Brand New
  t.is(createStub.callCount, 2);

  sinon.restore();
});

// ============================================================================
// migratePortfolios - Portfolio with description defaults
// ============================================================================

test.serial('migratePortfolios passes empty string for missing portfolio description', async t => {
  sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid');
  sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]);
  const createStub = sinon.stub(EnterpriseClient.prototype, 'createPortfolio');
  createStub.onFirstCall().resolves({ id: 'temp-id' });
  createStub.onSecondCall().resolves({ id: 'new-id' });
  sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([]);
  sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves({});

  const portfolios = [
    { name: 'No Description', selectionMode: 'MANUAL', projects: [] }
    // Note: no description field
  ];

  await migratePortfolios(
    portfolios,
    new Map(),
    { key: 'ent-key' },
    { url: 'https://sonarcloud.io', token: 'tok' },
    { maxRetries: 0, baseDelay: 10 }
  );

  const actualCreateCall = createStub.secondCall;
  t.is(actualCreateCall.args[0].description, '');

  sinon.restore();
});
