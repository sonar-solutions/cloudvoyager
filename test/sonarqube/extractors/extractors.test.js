import test from 'ava';
import sinon from 'sinon';
import { extractProjectData } from '../../../src/sonarqube/extractors/projects.js';
import { extractIssues } from '../../../src/sonarqube/extractors/issues.js';
import { extractMetrics, getCommonMetricKeys, COMMON_METRICS } from '../../../src/sonarqube/extractors/metrics.js';
import { extractMeasures, extractComponentMeasures } from '../../../src/sonarqube/extractors/measures.js';
import { extractSources } from '../../../src/sonarqube/extractors/sources.js';
import { extractQualityGates, extractProjectQualityGate } from '../../../src/sonarqube/extractors/quality-gates.js';
import { extractQualityProfiles, buildInheritanceChains } from '../../../src/sonarqube/extractors/quality-profiles.js';
import { extractActiveRules } from '../../../src/sonarqube/extractors/rules.js';
import { extractGroups } from '../../../src/sonarqube/extractors/groups.js';
import { extractGlobalPermissions, extractProjectPermissions, extractPermissionTemplates } from '../../../src/sonarqube/extractors/permissions.js';
import { extractPortfolios } from '../../../src/sonarqube/extractors/portfolios.js';
import { extractHotspots } from '../../../src/sonarqube/extractors/hotspots.js';
import { extractChangesets } from '../../../src/sonarqube/extractors/changesets.js';
import { extractSymbols } from '../../../src/sonarqube/extractors/symbols.js';
import { extractSyntaxHighlighting } from '../../../src/sonarqube/extractors/syntax-highlighting.js';
import { extractProjectSettings } from '../../../src/sonarqube/extractors/project-settings.js';
import { extractProjectTags } from '../../../src/sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from '../../../src/sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from '../../../src/sonarqube/extractors/new-code-periods.js';
import { extractWebhooks } from '../../../src/sonarqube/extractors/webhooks.js';
import { extractAlmSettings, extractProjectBinding, extractAllProjectBindings } from '../../../src/sonarqube/extractors/devops-bindings.js';
import { extractServerInfo } from '../../../src/sonarqube/extractors/server-info.js';
import { DataExtractor } from '../../../src/sonarqube/extractors/index.js';

test.afterEach(() => sinon.restore());

function mockClient(overrides = {}) {
  return {
    getProject: sinon.stub().resolves({ key: 'proj', name: 'Project' }),
    getBranches: sinon.stub().resolves([{ name: 'main', isMain: true }]),
    getQualityGate: sinon.stub().resolves({ name: 'Sonar way' }),
    getMetrics: sinon.stub().resolves([{ key: 'coverage', name: 'Coverage' }]),
    getIssues: sinon.stub().resolves([]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getSourceCode: sinon.stub().resolves('console.log("hello");'),
    getQualityProfiles: sinon.stub().resolves([]),
    getActiveRules: sinon.stub().resolves([]),
    getLatestAnalysisRevision: sinon.stub().resolves('abc123'),
    getHotspots: sinon.stub().resolves([]),
    getHotspotDetails: sinon.stub().resolves({}),
    getGroups: sinon.stub().resolves([]),
    getGlobalPermissions: sinon.stub().resolves([]),
    getProjectPermissions: sinon.stub().resolves([]),
    getPermissionTemplates: sinon.stub().resolves({ permissionTemplates: [], defaultTemplates: [] }),
    getPortfolios: sinon.stub().resolves([]),
    getPortfolioDetails: sinon.stub().resolves(null),
    getQualityGates: sinon.stub().resolves({ qualitygates: [] }),
    getQualityGateDetails: sinon.stub().resolves({ conditions: [] }),
    getQualityGatePermissions: sinon.stub().resolves({ users: [], groups: [] }),
    getAllQualityProfiles: sinon.stub().resolves([]),
    getQualityProfileBackup: sinon.stub().resolves('<xml/>'),
    getQualityProfilePermissions: sinon.stub().resolves({ users: [], groups: [] }),
    getProjectSettings: sinon.stub().resolves([]),
    getProjectTags: sinon.stub().resolves([]),
    getProjectLinks: sinon.stub().resolves([]),
    getNewCodePeriods: sinon.stub().resolves({ projectLevel: null, branchOverrides: [] }),
    getWebhooks: sinon.stub().resolves([]),
    getAlmSettings: sinon.stub().resolves({}),
    getProjectBinding: sinon.stub().resolves(null),
    getSystemInfo: sinon.stub().resolves({ System: { Version: '9.9' } }),
    getInstalledPlugins: sinon.stub().resolves([]),
    listAllProjects: sinon.stub().resolves([]),
    ...overrides
  };
}

// === projects.js ===
test('extractProjectData extracts project, branches, quality gate', async t => {
  const client = mockClient();
  const result = await extractProjectData(client);
  t.is(result.project.key, 'proj');
  t.is(result.branches.length, 1);
  t.is(result.qualityGate.name, 'Sonar way');
});

test('extractProjectData handles null quality gate', async t => {
  const client = mockClient({ getQualityGate: sinon.stub().resolves(null) });
  const result = await extractProjectData(client);
  t.is(result.qualityGate, null);
});

// === issues.js ===
test('extractIssues extracts and maps issues', async t => {
  const client = mockClient({
    getIssues: sinon.stub().resolves([
      { key: 'I1', rule: 'js:S1234', severity: 'MAJOR', status: 'OPEN', message: 'Fix' }
    ])
  });
  const result = await extractIssues(client);
  t.is(result.length, 1);
  t.is(result[0].key, 'I1');
});

test('extractIssues with branch filter', async t => {
  const client = mockClient();
  await extractIssues(client, null, 'develop');
  t.is(client.getIssues.firstCall.args[0].branch, 'develop');
});

test('extractIssues with incremental state', async t => {
  const client = mockClient();
  const state = { lastSync: '2024-01-01T00:00:00Z' };
  await extractIssues(client, state);
  t.is(client.getIssues.firstCall.args[0].createdAfter, '2024-01-01T00:00:00Z');
});

test('extractIssues logs severity breakdown', async t => {
  const client = mockClient({
    getIssues: sinon.stub().resolves([
      { key: 'I1', severity: 'MAJOR' },
      { key: 'I2', severity: 'MINOR' },
      { key: 'I3', severity: 'MAJOR' }
    ])
  });
  const result = await extractIssues(client);
  t.is(result.length, 3);
});

// === metrics.js ===
test('extractMetrics extracts metric definitions', async t => {
  const client = mockClient({
    getMetrics: sinon.stub().resolves([
      { key: 'coverage', name: 'Coverage', type: 'PERCENT' },
      { key: 'ncloc', name: 'Lines of Code', type: 'INT' }
    ])
  });
  const result = await extractMetrics(client);
  t.is(result.length, 2);
  t.is(result[0].key, 'coverage');
});

test('getCommonMetricKeys filters to available common metrics', t => {
  const allMetrics = [
    { key: 'coverage' }, { key: 'ncloc' }, { key: 'custom_metric' }
  ];
  const keys = getCommonMetricKeys(allMetrics);
  t.true(keys.includes('coverage'));
  t.true(keys.includes('ncloc'));
  t.false(keys.includes('custom_metric'));
});

test('COMMON_METRICS is an array of strings', t => {
  t.true(Array.isArray(COMMON_METRICS));
  t.true(COMMON_METRICS.length > 0);
  t.true(COMMON_METRICS.includes('coverage'));
});

// === measures.js ===
test('extractMeasures extracts project measures', async t => {
  const client = mockClient({
    getMeasures: sinon.stub().resolves({
      key: 'proj',
      measures: [{ metric: 'coverage', value: '85' }]
    })
  });
  const result = await extractMeasures(client, ['coverage']);
  t.is(result.component, 'proj');
  t.is(result.measures.length, 1);
});

test('extractMeasures handles empty measures', async t => {
  const client = mockClient();
  const result = await extractMeasures(client, ['coverage']);
  t.is(result.measures.length, 0);
});

test('extractComponentMeasures extracts component tree', async t => {
  const client = mockClient({
    getComponentTree: sinon.stub().resolves([
      { key: 'proj:src/a.js', name: 'a.js', qualifier: 'FIL', language: 'js' },
      { key: 'proj:src', name: 'src', qualifier: 'DIR' }
    ])
  });
  const result = await extractComponentMeasures(client, ['coverage']);
  t.is(result.length, 2);
});

// === sources.js ===
test('extractSources extracts source files', async t => {
  const client = mockClient({
    getSourceFiles: sinon.stub().resolves([
      { key: 'proj:src/a.js', path: 'src/a.js', language: 'js' }
    ]),
    getSourceCode: sinon.stub().resolves('const a = 1;')
  });
  const result = await extractSources(client, null, 0, { concurrency: 2 });
  t.is(result.length, 1);
  t.is(result[0].key, 'proj:src/a.js');
});

test('extractSources limits files when maxFiles set', async t => {
  const client = mockClient({
    getSourceFiles: sinon.stub().resolves([
      { key: 'f1', path: 'f1' }, { key: 'f2', path: 'f2' }, { key: 'f3', path: 'f3' }
    ]),
    getSourceCode: sinon.stub().resolves('code')
  });
  const result = await extractSources(client, null, 2, { concurrency: 1 });
  t.is(result.length, 2);
});

test('extractSources handles failed file fetches', async t => {
  const client = mockClient({
    getSourceFiles: sinon.stub().resolves([
      { key: 'f1', path: 'f1' }, { key: 'f2', path: 'f2' }
    ]),
    getSourceCode: sinon.stub()
      .onFirstCall().resolves('code')
      .onSecondCall().rejects(new Error('fetch failed'))
  });
  const result = await extractSources(client, null, 0, { concurrency: 1 });
  t.is(result.length, 1);
});

test('extractSources with branch', async t => {
  const client = mockClient({
    getSourceFiles: sinon.stub().resolves([]),
    getSourceCode: sinon.stub().resolves('code')
  });
  await extractSources(client, 'develop');
  t.is(client.getSourceFiles.firstCall.args[0], 'develop');
});

// === quality-gates.js ===
test('extractQualityGates extracts gates with details', async t => {
  const client = mockClient({
    getQualityGates: sinon.stub().resolves({
      qualitygates: [{ name: 'My Gate', isDefault: true, isBuiltIn: false }]
    }),
    getQualityGateDetails: sinon.stub().resolves({
      conditions: [{ id: 1, metric: 'coverage', op: 'LT', error: '80' }]
    }),
    getQualityGatePermissions: sinon.stub().resolves({ users: [], groups: [] })
  });
  const result = await extractQualityGates(client);
  t.is(result.length, 1);
  t.is(result[0].name, 'My Gate');
  t.true(result[0].isDefault);
  t.is(result[0].conditions.length, 1);
});

test('extractProjectQualityGate returns gate', async t => {
  const client = mockClient();
  const result = await extractProjectQualityGate(client);
  t.is(result.name, 'Sonar way');
});

test('extractProjectQualityGate returns null on error', async t => {
  const client = mockClient({ getQualityGate: sinon.stub().rejects(new Error('fail')) });
  const result = await extractProjectQualityGate(client);
  t.is(result, null);
});

// === quality-profiles.js ===
test('extractQualityProfiles extracts profiles with backup', async t => {
  const client = mockClient({
    getAllQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Sonar way', language: 'js', languageName: 'JavaScript', isDefault: true, isBuiltIn: true, activeRuleCount: 100 }
    ]),
    getQualityProfileBackup: sinon.stub().resolves('<xml>backup</xml>'),
    getQualityProfilePermissions: sinon.stub().resolves({ users: [{ login: 'u1' }], groups: [] })
  });
  const result = await extractQualityProfiles(client);
  t.is(result.length, 1);
  t.is(result[0].backupXml, '<xml>backup</xml>');
  t.is(result[0].permissions.users.length, 1);
});

test('extractQualityProfiles handles backup failure', async t => {
  const client = mockClient({
    getAllQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getQualityProfileBackup: sinon.stub().rejects(new Error('backup failed')),
    getQualityProfilePermissions: sinon.stub().resolves({ users: [], groups: [] })
  });
  const result = await extractQualityProfiles(client);
  t.is(result[0].backupXml, null);
});

test('buildInheritanceChains builds chains', t => {
  const profiles = [
    { key: 'child', name: 'Child', parentKey: 'parent' },
    { key: 'parent', name: 'Parent', parentKey: null },
    { key: 'standalone', name: 'Standalone', parentKey: null }
  ];
  const chains = buildInheritanceChains(profiles);
  t.is(chains.length, 1);
  t.is(chains[0][0].key, 'parent');
  t.is(chains[0][1].key, 'child');
});

test('buildInheritanceChains returns empty for no inheritance', t => {
  const profiles = [
    { key: 'p1', parentKey: null },
    { key: 'p2', parentKey: null }
  ];
  const chains = buildInheritanceChains(profiles);
  t.is(chains.length, 0);
});

// === rules.js ===
test('extractActiveRules extracts rules from profiles', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Sonar way', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1234', repo: 'javascript', severity: 'MAJOR', params: [{ key: 'max', defaultValue: '10' }] }
    ])
  });
  const components = [{ language: 'js' }];
  const result = await extractActiveRules(client, components);
  t.is(result.length, 1);
  t.is(result[0].ruleKey, 'S1234');
  t.is(result[0].ruleRepository, 'javascript');
});

test('extractActiveRules handles empty profiles', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([])
  });
  const result = await extractActiveRules(client);
  t.deepEqual(result, []);
});

test('extractActiveRules skips unused language profiles', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Java', language: 'java' }
    ]),
    getActiveRules: sinon.stub().resolves([])
  });
  const components = [{ language: 'js' }];
  const result = await extractActiveRules(client, components);
  t.is(result.length, 0);
  t.is(client.getActiveRules.callCount, 0);
});

test('extractActiveRules includes js/ts/web for javascript projects', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'TS', language: 'ts' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repo: 'typescript', severity: 'MINOR' }
    ])
  });
  const components = [{ language: 'js' }];
  const result = await extractActiveRules(client, components);
  t.is(result.length, 1);
});

test('extractActiveRules handles rules with impacts', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      {
        key: 'S1', repo: 'javascript', severity: 'MAJOR',
        impacts: [{ softwareQuality: 'MAINTAINABILITY', severity: 'HIGH' }]
      }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.is(result[0].impacts.length, 1);
  t.is(result[0].impacts[0].softwareQuality, 1);
  t.is(result[0].impacts[0].severity, 3);
});

test('extractActiveRules infers impacts from rule type', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repo: 'javascript', severity: 'CRITICAL', type: 'BUG' }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.is(result[0].impacts.length, 1);
  t.is(result[0].impacts[0].softwareQuality, 2); // RELIABILITY
  t.is(result[0].impacts[0].severity, 3); // HIGH
});

test('extractActiveRules returns empty impacts for unknown type', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repo: 'javascript', severity: 'INFO' }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.deepEqual(result[0].impacts, []);
});

test('extractActiveRules deduplicates rules', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile1', language: 'js' },
      { key: 'p2', name: 'Profile2', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1234', repo: 'javascript', severity: 'MAJOR' }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.is(result.length, 1);
});

test('extractActiveRules uses repository fallback', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repository: 'javascript', severity: 'MAJOR' }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.is(result[0].ruleRepository, 'javascript');
});

test('extractActiveRules re-throws errors', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().rejects(new Error('API fail'))
  });
  await t.throwsAsync(() => extractActiveRules(client), { message: 'API fail' });
});

// === groups.js ===
test('extractGroups extracts groups', async t => {
  const client = mockClient({
    getGroups: sinon.stub().resolves([
      { id: 1, name: 'admins', description: 'Admin group', membersCount: 5, default: false }
    ])
  });
  const result = await extractGroups(client);
  t.is(result.length, 1);
  t.is(result[0].name, 'admins');
  t.is(result[0].membersCount, 5);
});

test('extractGroups handles missing optional fields', async t => {
  const client = mockClient({
    getGroups: sinon.stub().resolves([{ id: 1, name: 'group1' }])
  });
  const result = await extractGroups(client);
  t.is(result[0].description, '');
  t.is(result[0].membersCount, 0);
  t.is(result[0].default, false);
});

// === permissions.js ===
test('extractGlobalPermissions extracts permissions', async t => {
  const client = mockClient({
    getGlobalPermissions: sinon.stub().resolves([
      { name: 'admins', description: 'Admin', permissions: ['admin'] }
    ])
  });
  const result = await extractGlobalPermissions(client);
  t.is(result.length, 1);
  t.deepEqual(result[0].permissions, ['admin']);
});

test('extractProjectPermissions extracts project perms', async t => {
  const client = mockClient({
    getProjectPermissions: sinon.stub().resolves([
      { name: 'devs', permissions: ['codeviewer'] }
    ])
  });
  const result = await extractProjectPermissions(client, 'proj');
  t.is(result.length, 1);
});

test('extractPermissionTemplates extracts templates', async t => {
  const client = mockClient({
    getPermissionTemplates: sinon.stub().resolves({
      permissionTemplates: [{ id: '1', name: 'Default', permissions: [] }],
      defaultTemplates: [{ templateId: '1', qualifier: 'TRK' }]
    })
  });
  const result = await extractPermissionTemplates(client);
  t.is(result.templates.length, 1);
  t.is(result.defaultTemplates.length, 1);
});

test('extractPermissionTemplates handles missing fields', async t => {
  const client = mockClient({
    getPermissionTemplates: sinon.stub().resolves({})
  });
  const result = await extractPermissionTemplates(client);
  t.is(result.templates.length, 0);
  t.is(result.defaultTemplates.length, 0);
});

// === portfolios.js ===
test('extractPortfolios returns empty for no portfolios', async t => {
  const client = mockClient();
  const result = await extractPortfolios(client);
  t.deepEqual(result, []);
});

test('extractPortfolios extracts portfolio details', async t => {
  const client = mockClient({
    getPortfolios: sinon.stub().resolves([{ key: 'v1', name: 'Portfolio1', qualifier: 'VW' }]),
    getPortfolioDetails: sinon.stub().resolves({
      projects: [{ key: 'p1', name: 'Project1' }],
      subViews: []
    })
  });
  const result = await extractPortfolios(client);
  t.is(result.length, 1);
  t.is(result[0].projects.length, 1);
});

test('extractPortfolios handles null details', async t => {
  const client = mockClient({
    getPortfolios: sinon.stub().resolves([{ key: 'v1', name: 'P1', qualifier: 'VW' }]),
    getPortfolioDetails: sinon.stub().resolves(null)
  });
  const result = await extractPortfolios(client);
  t.is(result.length, 1);
  t.deepEqual(result[0].projects, []);
});

// === hotspots.js ===
test('extractHotspots returns empty for no hotspots', async t => {
  const client = mockClient();
  const result = await extractHotspots(client);
  t.deepEqual(result, []);
});

test('extractHotspots extracts hotspot details', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      { key: 'h1', component: 'c1', project: 'proj', status: 'TO_REVIEW', message: 'Check this' }
    ]),
    getHotspotDetails: sinon.stub().resolves({
      rule: { key: 'java:S1234' },
      comment: [{ text: 'Comment' }]
    })
  });
  const result = await extractHotspots(client, null, { concurrency: 1 });
  t.is(result.length, 1);
  t.is(result[0].key, 'h1');
  t.is(result[0].comments.length, 1);
});

test('extractHotspots handles detail fetch failure', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      { key: 'h1', component: 'c1', status: 'TO_REVIEW', message: 'Check' }
    ]),
    getHotspotDetails: sinon.stub().rejects(new Error('fail'))
  });
  const result = await extractHotspots(client, null, { concurrency: 1 });
  t.is(result.length, 1);
  t.deepEqual(result[0].comments, []);
});

test('extractHotspots with branch', async t => {
  const client = mockClient({ getHotspots: sinon.stub().resolves([]) });
  await extractHotspots(client, 'develop');
  t.is(client.getHotspots.firstCall.args[0].branch, 'develop');
});

// === changesets.js ===
test('extractChangesets creates changeset data', async t => {
  const sourceFiles = [
    { key: 'f1', lines: ['line1', 'line2'] },
    { key: 'f2', lines: ['a'] }
  ];
  const result = await extractChangesets(null, sourceFiles, []);
  t.is(result.size, 2);
  t.is(result.get('f1').changesetIndexByLine.length, 2);
  t.is(result.get('f2').changesetIndexByLine.length, 1);
});

test('extractChangesets handles files without lines', async t => {
  const sourceFiles = [{ key: 'f1' }];
  const result = await extractChangesets(null, sourceFiles, []);
  t.is(result.get('f1').changesetIndexByLine.length, 1);
});

// === symbols.js ===
test('extractSymbols creates empty symbol data', async t => {
  const sourceFiles = [{ key: 'f1' }, { key: 'f2' }];
  const result = await extractSymbols(null, sourceFiles);
  t.is(result.size, 2);
  t.deepEqual(result.get('f1').symbols, []);
});

// === syntax-highlighting.js ===
test('extractSyntaxHighlighting creates empty highlighting data', async t => {
  const sourceFiles = [{ key: 'f1' }];
  const result = await extractSyntaxHighlighting(null, sourceFiles);
  t.is(result.size, 1);
  t.deepEqual(result.get('f1').rules, []);
});

// === project-settings.js ===
test('extractProjectSettings filters non-inherited settings', async t => {
  const client = mockClient({
    getProjectSettings: sinon.stub().resolves([
      { key: 'sonar.coverage.exclusions', value: '**/*.test.js', inherited: false },
      { key: 'sonar.language', value: 'js', inherited: true }
    ])
  });
  const result = await extractProjectSettings(client);
  t.is(result.length, 1);
  t.is(result[0].key, 'sonar.coverage.exclusions');
});

// === project-tags.js ===
test('extractProjectTags returns tags', async t => {
  const client = mockClient({
    getProjectTags: sinon.stub().resolves(['tag1', 'tag2'])
  });
  const result = await extractProjectTags(client);
  t.deepEqual(result, ['tag1', 'tag2']);
});

// === project-links.js ===
test('extractProjectLinks maps link properties', async t => {
  const client = mockClient({
    getProjectLinks: sinon.stub().resolves([
      { id: '1', name: 'Homepage', type: 'custom', url: 'http://example.com' }
    ])
  });
  const result = await extractProjectLinks(client);
  t.is(result.length, 1);
  t.is(result[0].name, 'Homepage');
  t.is(result[0].url, 'http://example.com');
});

// === new-code-periods.js ===
test('extractNewCodePeriods extracts NUMBER_OF_DAYS', async t => {
  const client = mockClient({
    getNewCodePeriods: sinon.stub().resolves({
      projectLevel: { type: 'NUMBER_OF_DAYS', value: '30' },
      branchOverrides: []
    })
  });
  const result = await extractNewCodePeriods(client);
  t.is(result.projectLevel.type, 'NUMBER_OF_DAYS');
  t.truthy(result.projectLevel.settings);
  t.is(result.projectLevel.settings.length, 2);
});

test('extractNewCodePeriods extracts PREVIOUS_VERSION', async t => {
  const client = mockClient({
    getNewCodePeriods: sinon.stub().resolves({
      projectLevel: { type: 'PREVIOUS_VERSION' },
      branchOverrides: []
    })
  });
  const result = await extractNewCodePeriods(client);
  t.is(result.projectLevel.type, 'PREVIOUS_VERSION');
  t.truthy(result.projectLevel.settings);
});

test('extractNewCodePeriods handles unknown type', async t => {
  const client = mockClient({
    getNewCodePeriods: sinon.stub().resolves({
      projectLevel: { type: 'SPECIFIC_ANALYSIS', value: 'some-analysis' },
      branchOverrides: []
    })
  });
  const result = await extractNewCodePeriods(client);
  t.is(result.projectLevel.settings, null);
});

test('extractNewCodePeriods handles null project level', async t => {
  const client = mockClient();
  const result = await extractNewCodePeriods(client);
  t.is(result.projectLevel, null);
});

test('extractNewCodePeriods extracts branch overrides', async t => {
  const client = mockClient({
    getNewCodePeriods: sinon.stub().resolves({
      projectLevel: null,
      branchOverrides: [
        { branchKey: 'main', type: 'NUMBER_OF_DAYS', value: '14' }
      ]
    })
  });
  const result = await extractNewCodePeriods(client);
  t.is(result.branchOverrides.length, 1);
  t.is(result.branchOverrides[0].branchKey, 'main');
});

test('extractNewCodePeriods handles inherited project level', async t => {
  const client = mockClient({
    getNewCodePeriods: sinon.stub().resolves({
      projectLevel: { type: 'PREVIOUS_VERSION', inherited: true },
      branchOverrides: []
    })
  });
  const result = await extractNewCodePeriods(client);
  t.is(result.projectLevel.type, 'PREVIOUS_VERSION');
});

// === webhooks.js ===
test('extractWebhooks extracts webhooks', async t => {
  const client = mockClient({
    getWebhooks: sinon.stub().resolves([
      { key: 'wh1', name: 'Hook', url: 'http://example.com', hasSecret: true }
    ])
  });
  const result = await extractWebhooks(client);
  t.is(result.length, 1);
  t.is(result[0].name, 'Hook');
  t.true(result[0].hasSecret);
});

test('extractWebhooks with project key', async t => {
  const client = mockClient({
    getWebhooks: sinon.stub().resolves([])
  });
  await extractWebhooks(client, 'my-project');
  t.is(client.getWebhooks.firstCall.args[0], 'my-project');
});

// === devops-bindings.js ===
test('extractAlmSettings extracts settings', async t => {
  const client = mockClient({
    getAlmSettings: sinon.stub().resolves({
      github: [{ key: 'gh1' }],
      gitlab: [],
      azure: [],
      bitbucket: [],
      bitbucketcloud: []
    })
  });
  const result = await extractAlmSettings(client);
  t.is(result.github.length, 1);
  t.deepEqual(result.gitlab, []);
});

test('extractAlmSettings handles missing platforms', async t => {
  const client = mockClient({ getAlmSettings: sinon.stub().resolves({}) });
  const result = await extractAlmSettings(client);
  t.deepEqual(result.github, []);
  t.deepEqual(result.gitlab, []);
});

test('extractProjectBinding returns binding', async t => {
  const client = mockClient({
    getProjectBinding: sinon.stub().resolves({
      alm: 'github', key: 'gh', repository: 'org/repo'
    })
  });
  const result = await extractProjectBinding(client, 'proj');
  t.is(result.alm, 'github');
  t.is(result.repository, 'org/repo');
});

test('extractProjectBinding returns null when no binding', async t => {
  const client = mockClient();
  const result = await extractProjectBinding(client, 'proj');
  t.is(result, null);
});

test('extractAllProjectBindings returns bindings map', async t => {
  const client = mockClient({
    getProjectBinding: sinon.stub()
      .onFirstCall().resolves({ alm: 'github', key: 'gh', repository: 'org/repo1' })
      .onSecondCall().resolves(null)
  });
  const projects = [{ key: 'p1' }, { key: 'p2' }];
  const result = await extractAllProjectBindings(client, projects, { concurrency: 1 });
  t.is(result.size, 1);
  t.truthy(result.get('p1'));
});

// === server-info.js ===
test('extractServerInfo extracts all server info', async t => {
  const client = mockClient({
    getSystemInfo: sinon.stub().resolves({ System: { Version: '9.9', Edition: 'Enterprise', Status: 'UP', 'Server ID': 'abc', Database: 'PostgreSQL' } }),
    getInstalledPlugins: sinon.stub().resolves([{ key: 'javascript', name: 'JavaScript', version: '10.0' }]),
    getWebhooks: sinon.stub().resolves([{ key: 'wh1', name: 'Hook', url: 'http://test.com' }]),
    getProjectSettings: sinon.stub().resolves([{ key: 'sonar.global', value: 'val' }])
  });
  const result = await extractServerInfo(client);
  t.is(result.system.version, '9.9');
  t.is(result.system.edition, 'Enterprise');
  t.is(result.plugins.length, 1);
  t.is(result.webhooks.length, 1);
});

test('extractServerInfo handles settings failure', async t => {
  const client = mockClient({
    getProjectSettings: sinon.stub().rejects(new Error('forbidden'))
  });
  const result = await extractServerInfo(client);
  t.deepEqual(result.settings, []);
});

test('extractServerInfo handles missing System fields', async t => {
  const client = mockClient({
    getSystemInfo: sinon.stub().resolves({ version: '9.8', status: 'UP' })
  });
  const result = await extractServerInfo(client);
  t.is(result.system.version, '9.8');
  t.is(result.system.edition, 'unknown');
});

// === DataExtractor (index.js) ===
test('DataExtractor constructor sets properties', t => {
  const client = mockClient();
  const config = { transfer: { mode: 'full' } };
  const state = { lastSync: null };
  const perfConfig = { sourceExtraction: { concurrency: 5 } };
  const extractor = new DataExtractor(client, config, state, perfConfig);
  t.is(extractor.client, client);
  t.is(extractor.config, config);
  t.is(extractor.state, state);
  t.is(extractor.performanceConfig, perfConfig);
});

test('DataExtractor.extractAll orchestrates extraction', async t => {
  const client = mockClient({
    getMetrics: sinon.stub().resolves([{ key: 'ncloc', name: 'Lines' }]),
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getIssues: sinon.stub().resolves([]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [{ metric: 'ncloc', value: '100' }] }),
    getQualityProfiles: sinon.stub().resolves([]),
    getSourceCode: sinon.stub().resolves('code')
  });
  const config = { transfer: { mode: 'full' } };
  const extractor = new DataExtractor(client, config);
  const result = await extractor.extractAll();

  t.truthy(result.project);
  t.truthy(result.metrics);
  t.truthy(result.issues);
  t.truthy(result.measures);
  t.truthy(result.sources);
  t.truthy(result.activeRules);
  t.truthy(result.metadata.extractedAt);
  t.is(result.metadata.mode, 'full');
  t.is(result.metadata.scmRevisionId, 'abc123');
});

test('DataExtractor.extractAll without SCM revision', async t => {
  const client = mockClient({
    getLatestAnalysisRevision: sinon.stub().resolves(null),
    getMetrics: sinon.stub().resolves([]),
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getIssues: sinon.stub().resolves([]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
    getQualityProfiles: sinon.stub().resolves([]),
  });
  const config = { transfer: { mode: 'full' } };
  const extractor = new DataExtractor(client, config);
  const result = await extractor.extractAll();
  t.falsy(result.metadata.scmRevisionId);
});

test('DataExtractor.extractAll propagates errors', async t => {
  const client = mockClient({
    getProject: sinon.stub().rejects(new Error('connection failed'))
  });
  const config = { transfer: { mode: 'full' } };
  const extractor = new DataExtractor(client, config);
  await t.throwsAsync(() => extractor.extractAll(), { message: 'connection failed' });
});

test('DataExtractor.extractBranch extracts branch-specific data', async t => {
  const client = mockClient({
    getMetrics: sinon.stub().resolves([{ key: 'ncloc' }]),
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getIssues: sinon.stub().resolves([]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
  });
  const config = { transfer: { mode: 'full' } };
  const extractor = new DataExtractor(client, config);
  const result = await extractor.extractBranch('develop');
  t.is(result.branch, 'develop');
});

test('DataExtractor.logExtractionSummary does not throw', t => {
  const extractor = new DataExtractor(mockClient(), { transfer: { mode: 'full' } });
  const data = {
    project: { project: { name: 'Test' }, branches: [] },
    metrics: [],
    activeRules: [],
    issues: [],
    measures: { measures: [] },
    components: [],
    sources: []
  };
  t.notThrows(() => extractor.logExtractionSummary(data));
});
