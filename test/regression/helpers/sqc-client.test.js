import test from 'ava';
import esmock from 'esmock';
import sinon from 'sinon';

let originalFetch;

test.before(() => {
  originalFetch = global.fetch;
});

test.afterEach(() => {
  sinon.restore();
  global.fetch = originalFetch;
});

test.serial('SqcClient.getIssueCount returns total from API response', async t => {
  global.fetch = sinon.stub().resolves({
    ok: true,
    status: 200,
    json: async () => ({ total: 15234, issues: [] })
  });

  const { SqcClient } = await esmock('./sqc-client.js', {
    './config-reader.js': {
      readConfig: async () => ({}),
      getSqcUrl: () => 'https://sonarcloud.io',
      getSqcToken: () => 'test-token',
      getSqcOrgKey: () => 'test-org'
    }
  });

  const client = new SqcClient('https://sonarcloud.io', 'test-token', 'test-org');
  const count = await client.getIssueCount('my-project');
  t.is(count, 15234);
});

test.serial('SqcClient retries on 429 then succeeds', async t => {
  let callCount = 0;
  global.fetch = sinon.stub().callsFake(async () => {
    callCount++;
    if (callCount <= 2) {
      return { ok: false, status: 429, text: async () => 'rate limited' };
    }
    return { ok: true, status: 200, json: async () => ({ total: 100 }) };
  });

  const { SqcClient } = await esmock('./sqc-client.js', {
    './config-reader.js': {
      readConfig: async () => ({}),
      getSqcUrl: () => 'https://sonarcloud.io',
      getSqcToken: () => 'test-token',
      getSqcOrgKey: () => 'test-org'
    }
  });

  const client = new SqcClient('https://sonarcloud.io', 'test-token', 'test-org');
  const count = await client.getIssueCount('my-project');
  t.is(count, 100);
  t.is(callCount, 3);
});

test.serial('SqcClient retries on 500 then succeeds', async t => {
  let callCount = 0;
  global.fetch = sinon.stub().callsFake(async () => {
    callCount++;
    if (callCount === 1) {
      return { ok: false, status: 500, text: async () => 'server error' };
    }
    return { ok: true, status: 200, json: async () => ({ total: 50 }) };
  });

  const { SqcClient } = await esmock('./sqc-client.js', {
    './config-reader.js': {
      readConfig: async () => ({}),
      getSqcUrl: () => 'https://sonarcloud.io',
      getSqcToken: () => 'test-token',
      getSqcOrgKey: () => 'test-org'
    }
  });

  const client = new SqcClient('https://sonarcloud.io', 'test-token', 'test-org');
  const count = await client.getIssueCount('my-project');
  t.is(count, 50);
  t.is(callCount, 2);
});

test.serial('SqcClient throws immediately on 401', async t => {
  global.fetch = sinon.stub().resolves({
    ok: false,
    status: 401,
    text: async () => 'unauthorized'
  });

  const { SqcClient } = await esmock('./sqc-client.js', {
    './config-reader.js': {
      readConfig: async () => ({}),
      getSqcUrl: () => 'https://sonarcloud.io',
      getSqcToken: () => 'bad-token',
      getSqcOrgKey: () => 'test-org'
    }
  });

  const client = new SqcClient('https://sonarcloud.io', 'bad-token', 'test-org');
  const error = await t.throwsAsync(() => client.getIssueCount('my-project'));
  t.regex(error.message, /401/);
  t.is(global.fetch.callCount, 1);
});

test.serial('SqcClient retries on network error', async t => {
  let callCount = 0;
  global.fetch = sinon.stub().callsFake(async () => {
    callCount++;
    if (callCount === 1) {
      throw new TypeError('fetch failed');
    }
    return { ok: true, status: 200, json: async () => ({ total: 25 }) };
  });

  const { SqcClient } = await esmock('./sqc-client.js', {
    './config-reader.js': {
      readConfig: async () => ({}),
      getSqcUrl: () => 'https://sonarcloud.io',
      getSqcToken: () => 'test-token',
      getSqcOrgKey: () => 'test-org'
    }
  });

  const client = new SqcClient('https://sonarcloud.io', 'test-token', 'test-org');
  const count = await client.getIssueCount('my-project');
  t.is(count, 25);
  t.is(callCount, 2);
});

test.serial('SqcClient.fromConfig throws on missing token', async t => {
  const { SqcClient } = await esmock('./sqc-client.js', {
    './config-reader.js': {
      readConfig: async () => ({}),
      getSqcUrl: () => 'https://sonarcloud.io',
      getSqcToken: () => undefined,
      getSqcOrgKey: () => 'test-org'
    }
  });

  const error = await t.throwsAsync(() => SqcClient.fromConfig());
  t.regex(error.message, /token not found/);
});

test.serial('SqcClient.getIssuesByCreationDate returns buckets', async t => {
  global.fetch = sinon.stub().resolves({
    ok: true,
    status: 200,
    json: async () => ({
      total: 31642,
      facets: [{ property: 'createdAt', values: [
        { val: '2025-10-01', count: 4854 },
        { val: '2025-11-01', count: 4816 },
        { val: '2025-12-01', count: 4959 }
      ]}]
    })
  });

  const { SqcClient } = await esmock('./sqc-client.js', {
    './config-reader.js': {
      readConfig: async () => ({}),
      getSqcUrl: () => 'https://sonarcloud.io',
      getSqcToken: () => 'test-token',
      getSqcOrgKey: () => 'test-org'
    }
  });

  const client = new SqcClient('https://sonarcloud.io', 'test-token', 'test-org');
  const { total, dateBuckets } = await client.getIssuesByCreationDate('my-project');
  t.is(total, 31642);
  t.is(dateBuckets.length, 3);
  t.is(dateBuckets[0].count, 4854);
});
