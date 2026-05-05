import test from 'ava';
import sinon from 'sinon';
import { buildSettingsParams, dispatchSettingToApi } from '../../src/shared/utils/settings-params.js';

test.afterEach(() => sinon.restore());

// ============================================================================
// buildSettingsParams
// ============================================================================

test('buildSettingsParams builds scalar value params', t => {
  const params = buildSettingsParams({ key: 'sonar.cpd.enabled', component: 'proj', value: 'true' });
  t.is(params.get('key'), 'sonar.cpd.enabled');
  t.is(params.get('component'), 'proj');
  t.is(params.get('value'), 'true');
  t.deepEqual(params.getAll('values'), []);
  t.deepEqual(params.getAll('fieldValues'), []);
});

test('buildSettingsParams builds multi-value params with repeated values', t => {
  const params = buildSettingsParams({ key: 'sonar.exclusions', component: 'proj', values: ['**/*.test.js', '**/*.spec.js'] });
  t.is(params.get('key'), 'sonar.exclusions');
  t.is(params.get('component'), 'proj');
  t.is(params.get('value'), null);
  t.deepEqual(params.getAll('values'), ['**/*.test.js', '**/*.spec.js']);
});

test('buildSettingsParams builds fieldValues params as JSON', t => {
  const fvs = [{ resourceKey: '**/*.js', ruleKey: 'squid:S001' }];
  const params = buildSettingsParams({ key: 'sonar.issue.enforce.multicriteria', component: 'proj', fieldValues: fvs });
  t.is(params.get('key'), 'sonar.issue.enforce.multicriteria');
  const parsed = JSON.parse(params.getAll('fieldValues')[0]);
  t.deepEqual(parsed, { resourceKey: '**/*.js', ruleKey: 'squid:S001' });
});

test('buildSettingsParams includes empty string value', t => {
  const params = buildSettingsParams({ key: 'sonar.test.inclusions', component: 'proj', value: '' });
  t.is(params.get('value'), '');
});

test('buildSettingsParams omits undefined value', t => {
  const params = buildSettingsParams({ key: 'sonar.exclusions', component: 'proj', value: undefined, values: ['a'] });
  t.is(params.get('value'), null);
  t.deepEqual(params.getAll('values'), ['a']);
});

test('buildSettingsParams omits null value', t => {
  const params = buildSettingsParams({ key: 'sonar.exclusions', component: 'proj', value: null, values: ['a'] });
  t.is(params.get('value'), null);
});

// ============================================================================
// dispatchSettingToApi
// ============================================================================

test('dispatchSettingToApi dispatches scalar value', async t => {
  const client = { setProjectSetting: sinon.stub().resolves() };
  const result = await dispatchSettingToApi(client, { key: 'sonar.cpd.enabled', value: 'true' }, 'proj');
  t.true(result);
  t.deepEqual(client.setProjectSetting.firstCall.args, ['sonar.cpd.enabled', { value: 'true' }, 'proj']);
});

test('dispatchSettingToApi dispatches multi-value array', async t => {
  const client = { setProjectSetting: sinon.stub().resolves() };
  const result = await dispatchSettingToApi(client, { key: 'sonar.exclusions', values: ['a', 'b'] }, 'proj');
  t.true(result);
  t.deepEqual(client.setProjectSetting.firstCall.args, ['sonar.exclusions', { values: ['a', 'b'] }, 'proj']);
});

test('dispatchSettingToApi dispatches fieldValues', async t => {
  const client = { setProjectSetting: sinon.stub().resolves() };
  const fvs = [{ resourceKey: '**/*.js', ruleKey: 'squid:S001' }];
  const result = await dispatchSettingToApi(client, { key: 'sonar.multi', fieldValues: fvs }, 'proj');
  t.true(result);
  t.deepEqual(client.setProjectSetting.firstCall.args, ['sonar.multi', { fieldValues: fvs }, 'proj']);
});

test('dispatchSettingToApi dispatches empty string value (not skipped)', async t => {
  const client = { setProjectSetting: sinon.stub().resolves() };
  const result = await dispatchSettingToApi(client, { key: 'sonar.test.inclusions', value: '' }, 'proj');
  t.true(result);
  t.deepEqual(client.setProjectSetting.firstCall.args, ['sonar.test.inclusions', { value: '' }, 'proj']);
});

test('dispatchSettingToApi prefers value over values', async t => {
  const client = { setProjectSetting: sinon.stub().resolves() };
  const result = await dispatchSettingToApi(client, { key: 'k', value: 'scalar', values: ['a'] }, 'proj');
  t.true(result);
  t.deepEqual(client.setProjectSetting.firstCall.args, ['k', { value: 'scalar' }, 'proj']);
});

test('dispatchSettingToApi returns false for empty setting', async t => {
  const client = { setProjectSetting: sinon.stub().resolves() };
  const result = await dispatchSettingToApi(client, { key: 'sonar.empty' }, 'proj');
  t.false(result);
  t.is(client.setProjectSetting.callCount, 0);
});

test('dispatchSettingToApi returns false for empty values array', async t => {
  const client = { setProjectSetting: sinon.stub().resolves() };
  const result = await dispatchSettingToApi(client, { key: 'sonar.empty', values: [] }, 'proj');
  t.false(result);
  t.is(client.setProjectSetting.callCount, 0);
});

test('dispatchSettingToApi returns false for empty fieldValues array', async t => {
  const client = { setProjectSetting: sinon.stub().resolves() };
  const result = await dispatchSettingToApi(client, { key: 'sonar.empty', fieldValues: [] }, 'proj');
  t.false(result);
  t.is(client.setProjectSetting.callCount, 0);
});
