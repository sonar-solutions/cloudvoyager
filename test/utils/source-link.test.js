import test from 'ava';
import sinon from 'sinon';
import { resolveSourceBaseURL } from '../../src/shared/utils/source-link/resolve-source-base-url.js';
import { buildIssueSourceComment, buildHotspotSourceComment } from '../../src/shared/utils/source-link/build-source-comments.js';

test.afterEach(() => sinon.restore());

// ============================================================================
// resolveSourceBaseURL
// ============================================================================

test('resolveSourceBaseURL prefers sonar.core.serverBaseURL when set', async t => {
  const sqClient = {
    baseURL: 'http://localhost:9000',
    getServerSettings: sinon.stub().resolves([
      { key: 'sonar.core.id', value: 'abc' },
      { key: 'sonar.core.serverBaseURL', value: 'https://sonar.example.com' },
    ]),
  };
  const url = await resolveSourceBaseURL(sqClient);
  t.is(url, 'https://sonar.example.com');
});

test('resolveSourceBaseURL strips trailing slashes from setting value', async t => {
  const sqClient = {
    baseURL: 'http://localhost:9000',
    getServerSettings: sinon.stub().resolves([
      { key: 'sonar.core.serverBaseURL', value: 'https://sonar.example.com/' },
    ]),
  };
  const url = await resolveSourceBaseURL(sqClient);
  t.is(url, 'https://sonar.example.com');
});

test('resolveSourceBaseURL falls back to sqClient.baseURL when setting unset', async t => {
  const sqClient = {
    baseURL: 'http://localhost:9000',
    getServerSettings: sinon.stub().resolves([{ key: 'sonar.core.id', value: 'abc' }]),
  };
  const url = await resolveSourceBaseURL(sqClient);
  t.is(url, 'http://localhost:9000');
});

test('resolveSourceBaseURL falls back when setting has empty value', async t => {
  const sqClient = {
    baseURL: 'http://localhost:9000',
    getServerSettings: sinon.stub().resolves([{ key: 'sonar.core.serverBaseURL', value: '   ' }]),
  };
  const url = await resolveSourceBaseURL(sqClient);
  t.is(url, 'http://localhost:9000');
});

test('resolveSourceBaseURL falls back when getServerSettings throws', async t => {
  const sqClient = {
    baseURL: 'http://localhost:9000',
    getServerSettings: sinon.stub().rejects(new Error('forbidden')),
  };
  const url = await resolveSourceBaseURL(sqClient);
  t.is(url, 'http://localhost:9000');
});

test('resolveSourceBaseURL caches the resolved value', async t => {
  const stub = sinon.stub().resolves([{ key: 'sonar.core.serverBaseURL', value: 'https://cached.example.com' }]);
  const sqClient = { baseURL: 'http://localhost:9000', getServerSettings: stub };
  const first = await resolveSourceBaseURL(sqClient);
  const second = await resolveSourceBaseURL(sqClient);
  t.is(first, 'https://cached.example.com');
  t.is(second, 'https://cached.example.com');
  t.is(stub.callCount, 1);
});

test('resolveSourceBaseURL returns null for falsy client', async t => {
  t.is(await resolveSourceBaseURL(null), null);
  t.is(await resolveSourceBaseURL(undefined), null);
  t.is(await resolveSourceBaseURL({}), null);
});

test('resolveSourceBaseURL handles client without getServerSettings', async t => {
  const url = await resolveSourceBaseURL({ baseURL: 'http://localhost:9000' });
  t.is(url, 'http://localhost:9000');
});

// ============================================================================
// buildIssueSourceComment
// ============================================================================

test('buildIssueSourceComment builds markdown comment with link', t => {
  const text = buildIssueSourceComment('https://sonar.example.com', 'proj-key', 'issue-uuid');
  t.is(
    text,
    'Link to [Original issue](https://sonar.example.com/project/issues?id=proj-key&issues=issue-uuid&open=issue-uuid)',
  );
});

test('buildIssueSourceComment URL-encodes project and issue keys', t => {
  const text = buildIssueSourceComment('https://sonar.example.com', 'group:proj', 'AY/key+1');
  t.true(text.includes('id=group%3Aproj'));
  t.true(text.includes('issues=AY%2Fkey%2B1'));
  t.true(text.includes('open=AY%2Fkey%2B1'));
});

// ============================================================================
// buildHotspotSourceComment
// ============================================================================

test('buildHotspotSourceComment builds markdown comment with link', t => {
  const text = buildHotspotSourceComment('https://sonar.example.com', 'proj-key', 'hotspot-uuid');
  t.is(
    text,
    'Link to [Original hotspot](https://sonar.example.com/security_hotspots?id=proj-key&hotspots=hotspot-uuid)',
  );
});
