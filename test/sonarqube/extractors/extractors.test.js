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
import { mapSeverity, extractImpacts } from '../../../src/sonarqube/extractors/rule-helpers.js';
import { SonarQubeClient } from '../../../src/sonarqube/api-client.js';
import * as quality from '../../../src/sonarqube/api/quality.js';
import * as serverConfig from '../../../src/sonarqube/api/server-config.js';
import * as permissions from '../../../src/sonarqube/api/permissions.js';

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

// === hotspots-to-issues.js ===
import { extractHotspotsAsIssues } from '../../../src/sonarqube/extractors/hotspots-to-issues.js';

test('extractHotspotsAsIssues returns empty array when no hotspots', async t => {
  const client = mockClient();
  const result = await extractHotspotsAsIssues(client);
  t.deepEqual(result, []);
});

test('extractHotspotsAsIssues converts hotspots to issue format', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      {
        key: 'h1',
        ruleKey: 'javascript:S5247',
        component: 'proj:src/index.js',
        project: 'proj',
        vulnerabilityProbability: 'HIGH',
        status: 'TO_REVIEW',
        line: 21,
        message: 'Make sure disabling auto-escaping is safe here.',
        author: 'dev@example.com',
        creationDate: '2024-01-01T00:00:00+0000',
        updateDate: '2024-01-02T00:00:00+0000',
        textRange: { startLine: 21, endLine: 21, startOffset: 10, endOffset: 20 },
        flows: [{ locations: [{ component: 'proj:src/index.js', textRange: { startLine: 21, endLine: 21, startOffset: 23, endOffset: 33 } }] }]
      },
      {
        key: 'h2',
        ruleKey: 'javascript:S2245',
        component: 'proj:src/utils.js',
        project: 'proj',
        vulnerabilityProbability: 'LOW',
        status: 'TO_REVIEW',
        line: 5,
        message: 'Using pseudorandom number generators is security-sensitive.',
        textRange: { startLine: 5, endLine: 5, startOffset: 0, endOffset: 10 }
      }
    ])
  });
  const result = await extractHotspotsAsIssues(client);
  t.is(result.length, 2);

  // First hotspot — HIGH probability → CRITICAL severity
  t.is(result[0].rule, 'javascript:S5247');
  t.is(result[0].severity, 'CRITICAL');
  t.is(result[0].component, 'proj:src/index.js');
  t.is(result[0].message, 'Make sure disabling auto-escaping is safe here.');
  t.is(result[0].type, 'SECURITY_HOTSPOT');
  t.is(result[0].line, 21);
  t.deepEqual(result[0].textRange, { startLine: 21, endLine: 21, startOffset: 10, endOffset: 20 });
  t.is(result[0].flows.length, 1);
  t.is(result[0].author, 'dev@example.com');

  // Second hotspot — LOW probability → MINOR severity
  t.is(result[1].rule, 'javascript:S2245');
  t.is(result[1].severity, 'MINOR');
  t.is(result[1].type, 'SECURITY_HOTSPOT');
  t.falsy(result[1].author);
});

test('extractHotspotsAsIssues passes branch filter', async t => {
  const client = mockClient({ getHotspots: sinon.stub().resolves([]) });
  await extractHotspotsAsIssues(client, 'develop');
  t.is(client.getHotspots.firstCall.args[0].branch, 'develop');
});

test('extractHotspotsAsIssues maps MEDIUM probability to MAJOR severity', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      { key: 'h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', vulnerabilityProbability: 'MEDIUM', status: 'TO_REVIEW', line: 1, message: 'Check' }
    ])
  });
  const result = await extractHotspotsAsIssues(client);
  t.is(result[0].severity, 'MAJOR');
});

test('extractHotspotsAsIssues defaults unknown probability to MAJOR', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      { key: 'h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', status: 'TO_REVIEW', line: 1, message: 'Check' }
    ])
  });
  const result = await extractHotspotsAsIssues(client);
  t.is(result[0].severity, 'MAJOR');
});

test('extractHotspotsAsIssues handles missing optional fields', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      { key: 'h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', status: 'TO_REVIEW', line: 10, message: 'msg' }
    ])
  });
  const result = await extractHotspotsAsIssues(client);
  t.is(result[0].textRange, null);
  t.deepEqual(result[0].flows, []);
  t.falsy(result[0].author);
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

test('DataExtractor.extractAll includes hotspots in issues array', async t => {
  const client = mockClient({
    getMetrics: sinon.stub().resolves([]),
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getIssues: sinon.stub().resolves([{ key: 'i1', rule: 'javascript:S1234', component: 'proj:src/a.js', message: 'issue' }]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
    getHotspots: sinon.stub().resolves([
      { key: 'h1', ruleKey: 'javascript:S5247', component: 'proj:src/b.js', project: 'proj', vulnerabilityProbability: 'HIGH', status: 'TO_REVIEW', line: 10, message: 'hotspot msg' }
    ])
  });
  const config = { transfer: { mode: 'full' } };
  const extractor = new DataExtractor(client, config);
  const result = await extractor.extractAll();

  // Should have 1 regular issue + 1 hotspot
  t.is(result.issues.length, 2);
  const hotspot = result.issues.find(i => i.type === 'SECURITY_HOTSPOT');
  t.truthy(hotspot);
  t.is(hotspot.rule, 'javascript:S5247');
  t.is(hotspot.component, 'proj:src/b.js');
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
  const mainData = {
    project: { branches: [{ name: 'main', isMain: true }] },
    metrics: [{ key: 'ncloc' }],
    activeRules: []
  };
  const result = await extractor.extractBranch('develop', mainData);
  // extractBranch returns same shape as extractAll - verify it has the expected fields
  t.truthy(result.project);
  t.truthy(result.metrics);
  t.truthy(result.issues);
  t.truthy(result.components);
  t.truthy(result.sources);
});

test('DataExtractor.extractBranch includes hotspots in issues', async t => {
  const client = mockClient({
    getMetrics: sinon.stub().resolves([{ key: 'ncloc' }]),
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getIssues: sinon.stub().resolves([{ key: 'i1' }]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
    getHotspots: sinon.stub().resolves([
      { key: 'h1', ruleKey: 'java:S2245', component: 'proj:src/Util.java', project: 'proj', vulnerabilityProbability: 'MEDIUM', status: 'TO_REVIEW', line: 3, message: 'random' }
    ])
  });
  const config = { transfer: { mode: 'full' } };
  const extractor = new DataExtractor(client, config);
  const mainData = { project: { branches: [] }, metrics: [{ key: 'ncloc' }], activeRules: [] };
  const result = await extractor.extractBranch('feature', mainData);

  t.is(result.issues.length, 2);
  t.is(result.issues[1].type, 'SECURITY_HOTSPOT');
  t.is(result.issues[1].rule, 'java:S2245');
  // Verify branch was passed to getHotspots
  t.is(client.getHotspots.firstCall.args[0].branch, 'feature');
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

// --- Extractor error paths (catch blocks) ---

test('extractChangesets handles error in file processing', async t => {
  // A file with lines.length = -1 causes new Array(-1).fill(0) to throw RangeError
  const badFile = { key: 'bad-file', lines: { length: -1 } };
  const goodFile = { key: 'good-file', lines: ['line1'] };
  const result = await extractChangesets(null, [badFile, goodFile], []);
  // badFile should be skipped (caught), goodFile should succeed
  t.is(result.size, 1);
  t.truthy(result.get('good-file'));
  t.falsy(result.get('bad-file'));
});

test('extractSymbols handles error in file processing', async t => {
  // Use a getter on 'key' that throws only on the first access (in the try block)
  // and returns a fallback string on subsequent accesses (in the catch block's logger.warn)
  let symAccessCount = 0;
  const badSymFile = {};
  Object.defineProperty(badSymFile, 'key', {
    get() {
      symAccessCount++;
      if (symAccessCount === 1) throw new Error('key access error');
      return 'bad-sym-file';
    },
    enumerable: true
  });
  const goodFile = { key: 'good-file' };
  const result = await extractSymbols(null, [badSymFile, goodFile]);
  // badFile should be skipped (caught), goodFile should succeed
  t.is(result.size, 1);
  t.truthy(result.get('good-file'));
});

test('extractSyntaxHighlighting handles error in file processing', async t => {
  // Use a getter on 'key' that throws only on the first access (in the try block)
  // and returns a fallback string on subsequent accesses (in the catch block's logger.warn)
  let hlAccessCount = 0;
  const badHlFile = {};
  Object.defineProperty(badHlFile, 'key', {
    get() {
      hlAccessCount++;
      if (hlAccessCount === 1) throw new Error('key access error');
      return 'bad-hl-file';
    },
    enumerable: true
  });
  const goodFile = { key: 'good-file' };
  const result = await extractSyntaxHighlighting(null, [badHlFile, goodFile]);
  // badFile should be skipped (caught), goodFile should succeed
  t.is(result.size, 1);
  t.truthy(result.get('good-file'));
});

// =============================================================================
// BRANCH COVERAGE TESTS
// =============================================================================

// --- api-client.js: || fallback branches ---

// Helper: creates a SonarQubeClient with a mock internal axios client
function createClientWithMockAxios(getMock) {
  const client = new SonarQubeClient({ url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' });
  client.client = { get: getMock, interceptors: { response: { use: () => {} } } };
  return client;
}

test('api-client getProject: response.data.components is undefined => falls back to []', async t => {
  const client = createClientWithMockAxios(sinon.stub().resolves({ data: {} }));
  const err = await t.throwsAsync(() => client.getProject());
  t.regex(err.message, /Project not found/);
});

test('api-client getBranches: response.data.branches is undefined => falls back to []', async t => {
  const client = createClientWithMockAxios(sinon.stub().resolves({ data: {} }));
  const result = await client.getBranches();
  t.deepEqual(result, []);
});

test('api-client getQualityGate: response.data.qualityGate is undefined => returns null', async t => {
  const client = createClientWithMockAxios(sinon.stub().resolves({ data: {} }));
  const result = await client.getQualityGate();
  t.is(result, null);
});

test('api-client getMeasures: response.data.component is undefined => returns {}', async t => {
  const client = createClientWithMockAxios(sinon.stub().resolves({ data: {} }));
  const result = await client.getMeasures(null, ['coverage']);
  t.deepEqual(result, {});
});

test('api-client getQualityProfiles: response.data.profiles is undefined => returns []', async t => {
  const client = createClientWithMockAxios(sinon.stub().resolves({ data: {} }));
  const result = await client.getQualityProfiles();
  t.deepEqual(result, []);
});

test('api-client getLatestAnalysisRevision: response.data.analyses is undefined => returns null', async t => {
  const client = createClientWithMockAxios(sinon.stub().resolves({ data: {} }));
  const result = await client.getLatestAnalysisRevision();
  t.is(result, null);
});

test('api-client getLatestAnalysisRevision: analyses exist but no revision => returns null', async t => {
  const client = createClientWithMockAxios(sinon.stub().resolves({
    data: { analyses: [{ date: '2024-01-01' }] }
  }));
  const result = await client.getLatestAnalysisRevision();
  t.is(result, null);
});

// --- api/quality.js: || fallback branches ---

function mockAxiosClient(stub) {
  return { get: stub };
}

test('quality.getQualityGatePermissions: users response has no users => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().resolves({ data: {} })         // search_users - no users
    .onSecondCall().resolves({ data: { groups: [{ name: 'g1' }] } })
  );
  const result = await quality.getQualityGatePermissions(client, 'gate');
  t.deepEqual(result.users, []);
  t.is(result.groups.length, 1);
});

test('quality.getQualityGatePermissions: groups response has no groups => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().resolves({ data: { users: [{ login: 'u1' }] } })
    .onSecondCall().resolves({ data: {} })         // search_groups - no groups
  );
  const result = await quality.getQualityGatePermissions(client, 'gate');
  t.is(result.users.length, 1);
  t.deepEqual(result.groups, []);
});

test('quality.getAllQualityProfiles: response.data.profiles is undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub().resolves({ data: {} }));
  const result = await quality.getAllQualityProfiles(client);
  t.deepEqual(result, []);
});

test('quality.getQualityProfilePermissions: users undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().resolves({ data: {} })
    .onSecondCall().resolves({ data: { groups: [{ name: 'g1' }] } })
  );
  const result = await quality.getQualityProfilePermissions(client, 'js', 'Sonar way');
  t.deepEqual(result.users, []);
  t.is(result.groups.length, 1);
});

test('quality.getQualityProfilePermissions: groups undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().resolves({ data: { users: [{ login: 'u1' }] } })
    .onSecondCall().resolves({ data: {} })
  );
  const result = await quality.getQualityProfilePermissions(client, 'js', 'Sonar way');
  t.is(result.users.length, 1);
  t.deepEqual(result.groups, []);
});

// --- api/server-config.js: || fallback branches ---

test('serverConfig.getProjectSettings: settings undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub().resolves({ data: {} }));
  const result = await serverConfig.getProjectSettings(client, 'proj');
  t.deepEqual(result, []);
});

test('serverConfig.getProjectTags: tags undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub().resolves({ data: {} }));
  const result = await serverConfig.getProjectTags(client);
  t.deepEqual(result, []);
});

test('serverConfig.getProjectLinks: links undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub().resolves({ data: {} }));
  const result = await serverConfig.getProjectLinks(client, 'proj');
  t.deepEqual(result, []);
});

test('serverConfig.getNewCodePeriods: newCodePeriods undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().resolves({ data: { type: 'PREVIOUS_VERSION' } }) // show
    .onSecondCall().resolves({ data: {} })                           // list - no newCodePeriods
  );
  const result = await serverConfig.getNewCodePeriods(client, 'proj');
  t.deepEqual(result.branchOverrides, []);
});

test('serverConfig.getInstalledPlugins: plugins undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub().resolves({ data: {} }));
  const result = await serverConfig.getInstalledPlugins(client);
  t.deepEqual(result, []);
});

test('serverConfig.getWebhooks: webhooks undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub().resolves({ data: {} }));
  const result = await serverConfig.getWebhooks(client, 'proj');
  t.deepEqual(result, []);
});

test('serverConfig.getWebhooks: without projectKey appends server-level scope', async t => {
  const client = mockAxiosClient(sinon.stub().resolves({ data: { webhooks: [{ key: 'w1' }] } }));
  const result = await serverConfig.getWebhooks(client);
  t.is(result.length, 1);
});

// --- api/permissions.js: views undefined => falls back to [] ---

test('permissions.getPortfolios: views undefined => falls back to []', async t => {
  const client = mockAxiosClient(sinon.stub().resolves({ data: {} }));
  const result = await permissions.getPortfolios(client);
  t.deepEqual(result, []);
});

// --- rule-helpers.js: null/undefined severity and quality branches ---

test('mapSeverity: null severity => default 3 (MAJOR)', t => {
  t.is(mapSeverity(null), 3);
});

test('mapSeverity: undefined severity => default 3 (MAJOR)', t => {
  t.is(mapSeverity(undefined), 3);
});

test('mapSeverity: unknown string => default 3 (MAJOR)', t => {
  t.is(mapSeverity('UNKNOWN'), 3);
});

test('extractImpacts: rule with impacts as non-array => infers from type', t => {
  const rule = { impacts: 'not-an-array', type: 'CODE_SMELL', severity: 'MAJOR' };
  const result = extractImpacts(rule);
  t.is(result.length, 1);
  t.is(result[0].softwareQuality, 1); // MAINTAINABILITY
});

test('extractImpacts: rule with no impacts and no type => empty', t => {
  const rule = {};
  const result = extractImpacts(rule);
  t.deepEqual(result, []);
});

test('extractImpacts: null softwareQuality in impact => defaults to 1', t => {
  const rule = { impacts: [{ softwareQuality: null, severity: 'HIGH' }] };
  const result = extractImpacts(rule);
  t.is(result[0].softwareQuality, 1);
});

test('extractImpacts: null severity in impact => defaults to 2', t => {
  const rule = { impacts: [{ softwareQuality: 'SECURITY', severity: null }] };
  const result = extractImpacts(rule);
  t.is(result[0].severity, 2);
});

test('extractImpacts: unknown softwareQuality string => defaults to 1', t => {
  const rule = { impacts: [{ softwareQuality: 'UNKNOWN', severity: 'LOW' }] };
  const result = extractImpacts(rule);
  t.is(result[0].softwareQuality, 1);
});

test('extractImpacts: unknown severity string in impact => defaults to 2', t => {
  const rule = { impacts: [{ softwareQuality: 'RELIABILITY', severity: 'UNKNOWN' }] };
  const result = extractImpacts(rule);
  t.is(result[0].severity, 2);
});

test('extractImpacts: unknown type in inferImpactsFromType => empty', t => {
  const rule = { type: 'UNKNOWN_TYPE', severity: 'MAJOR' };
  const result = extractImpacts(rule);
  t.deepEqual(result, []);
});

test('extractImpacts: null rule severity in mapImpactSeverityFromRuleSeverity => defaults to 2', t => {
  const rule = { type: 'BUG', severity: null };
  const result = extractImpacts(rule);
  t.is(result[0].severity, 2);
});

test('extractImpacts: unknown rule severity in mapImpactSeverityFromRuleSeverity => defaults to 2', t => {
  const rule = { type: 'VULNERABILITY', severity: 'UNKNOWN' };
  const result = extractImpacts(rule);
  t.is(result[0].severity, 2);
});

// --- extractors/permissions.js: || fallback branches for missing fields ---

test('extractGlobalPermissions: group with no description and no permissions => defaults', async t => {
  const client = mockClient({
    getGlobalPermissions: sinon.stub().resolves([
      { name: 'group1' }
    ])
  });
  const result = await extractGlobalPermissions(client);
  t.is(result[0].description, '');
  t.deepEqual(result[0].permissions, []);
});

test('extractProjectPermissions: group with no description and no permissions => defaults', async t => {
  const client = mockClient({
    getProjectPermissions: sinon.stub().resolves([
      { name: 'group1' }
    ])
  });
  const result = await extractProjectPermissions(client, 'proj');
  t.is(result[0].description, '');
  t.deepEqual(result[0].permissions, []);
});

test('extractPermissionTemplates: templates with missing optional fields => defaults', async t => {
  const client = mockClient({
    getPermissionTemplates: sinon.stub().resolves({
      permissionTemplates: [{ id: '1', name: 'Tmpl' }],
      defaultTemplates: [{ templateId: '1', qualifier: 'TRK' }]
    })
  });
  const result = await extractPermissionTemplates(client);
  t.is(result.templates[0].description, '');
  t.is(result.templates[0].projectKeyPattern, '');
  t.deepEqual(result.templates[0].permissions, []);
});

// --- hotspots.js: detail fields undefined => fallback branches ---

test('extractHotspots: details with undefined rule, comment, changelog => falls back', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      { key: 'h1', component: 'c1', project: 'proj', status: 'TO_REVIEW', message: 'msg' }
    ]),
    getHotspotDetails: sinon.stub().resolves({})  // no rule, no comment, no changelog
  });
  const result = await extractHotspots(client, null, { concurrency: 1 });
  t.deepEqual(result[0].rule, {});
  t.deepEqual(result[0].comments, []);
  t.deepEqual(result[0].changelog, []);
});

test('extractHotspots: hotspot with missing optional fields in error path => null defaults', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      { key: 'h1', component: 'c1', status: 'TO_REVIEW', message: 'msg' }
    ]),
    getHotspotDetails: sinon.stub().rejects(new Error('fail'))
  });
  const result = await extractHotspots(client, null, { concurrency: 1 });
  t.is(result[0].resolution, null);
  t.is(result[0].assignee, null);
});

// --- rules.js: buildActiveRule branches ---

test('extractActiveRules: rule params with value instead of defaultValue', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repo: 'javascript', severity: 'MAJOR',
        params: [{ key: 'max', value: '20' }] }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.is(result[0].paramsByKey.max, '20');
});

test('extractActiveRules: rule params with neither defaultValue nor value => empty string', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repo: 'javascript', severity: 'MAJOR',
        params: [{ key: 'max' }] }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.is(result[0].paramsByKey.max, '');
});

test('extractActiveRules: rule with no repo and no repository => unknown', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', severity: 'MAJOR' }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.is(result[0].ruleRepository, 'unknown');
});

test('extractActiveRules: rule with createdAt and updatedAt timestamps', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repo: 'javascript', severity: 'MAJOR',
        createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.is(result[0].createdAt, new Date('2024-01-01T00:00:00Z').getTime());
  t.is(result[0].updatedAt, new Date('2024-06-01T00:00:00Z').getTime());
});

test('extractActiveRules: rule without createdAt/updatedAt => uses Date.now()', async t => {
  const before = Date.now();
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repo: 'javascript', severity: 'MAJOR' }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  const after = Date.now();
  t.true(result[0].createdAt >= before && result[0].createdAt <= after);
  t.true(result[0].updatedAt >= before && result[0].updatedAt <= after);
});

test('extractActiveRules: rule with null params => empty paramsMap', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repo: 'javascript', severity: 'MAJOR', params: null }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.deepEqual(result[0].paramsByKey, {});
});

test('extractActiveRules: rule with non-array params => empty paramsMap', async t => {
  const client = mockClient({
    getQualityProfiles: sinon.stub().resolves([
      { key: 'p1', name: 'Profile', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'S1', repo: 'javascript', severity: 'MAJOR', params: 'not-array' }
    ])
  });
  const result = await extractActiveRules(client, [{ language: 'js' }]);
  t.deepEqual(result[0].paramsByKey, {});
});

// --- new-code-periods.js: branch override with unknown type => null settings ---

test('extractNewCodePeriods: branch override with unknown type => null settings', async t => {
  const client = mockClient({
    getNewCodePeriods: sinon.stub().resolves({
      projectLevel: null,
      branchOverrides: [
        { branchKey: 'main', type: 'SPECIFIC_ANALYSIS', value: 'abc123' }
      ]
    })
  });
  const result = await extractNewCodePeriods(client);
  t.is(result.branchOverrides[0].settings, null);
});

test('extractNewCodePeriods: branch override with no value => null value', async t => {
  const client = mockClient({
    getNewCodePeriods: sinon.stub().resolves({
      projectLevel: null,
      branchOverrides: [
        { branchKey: 'main', type: 'PREVIOUS_VERSION' }
      ]
    })
  });
  const result = await extractNewCodePeriods(client);
  t.is(result.branchOverrides[0].value, null);
  t.truthy(result.branchOverrides[0].settings);
});

// --- devops-bindings.js: binding fields undefined => fallback branches ---

test('extractProjectBinding: binding with missing optional fields => null/false defaults', async t => {
  const client = mockClient({
    getProjectBinding: sinon.stub().resolves({
      alm: 'github', key: 'gh'
      // repository, slug, url, summaryCommentEnabled, monorepo all missing
    })
  });
  const result = await extractProjectBinding(client, 'proj');
  t.is(result.repository, null);
  t.is(result.slug, null);
  t.is(result.url, null);
  t.is(result.summaryCommentEnabled, false);
  t.is(result.monorepo, false);
});

test('extractAllProjectBindings: rejected promise in settled mode => skipped', async t => {
  const client = mockClient({
    getProjectBinding: sinon.stub().rejects(new Error('binding fail'))
  });
  const projects = [{ key: 'p1' }];
  const result = await extractAllProjectBindings(client, projects, { concurrency: 1 });
  t.is(result.size, 0);
});

// --- index.js: MAX_SOURCE_FILES and performanceConfig branches ---

test('DataExtractor.extractAll with MAX_SOURCE_FILES env var', async t => {
  const orig = process.env.MAX_SOURCE_FILES;
  process.env.MAX_SOURCE_FILES = '5';
  try {
    const client = mockClient({
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
    t.truthy(result.sources);
  } finally {
    if (orig === undefined) delete process.env.MAX_SOURCE_FILES;
    else process.env.MAX_SOURCE_FILES = orig;
  }
});

test('DataExtractor.extractAll without performanceConfig.sourceExtraction => uses default concurrency', async t => {
  const client = mockClient({
    getMetrics: sinon.stub().resolves([]),
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getIssues: sinon.stub().resolves([]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
    getQualityProfiles: sinon.stub().resolves([]),
  });
  const config = { transfer: { mode: 'full' } };
  // No performanceConfig at all (undefined)
  const extractor = new DataExtractor(client, config);
  const result = await extractor.extractAll();
  t.truthy(result.sources);
});

test('DataExtractor.extractBranch with MAX_SOURCE_FILES env var', async t => {
  const orig = process.env.MAX_SOURCE_FILES;
  process.env.MAX_SOURCE_FILES = '3';
  try {
    const client = mockClient({
      getComponentTree: sinon.stub().resolves([]),
      getSourceFiles: sinon.stub().resolves([]),
      getIssues: sinon.stub().resolves([]),
      getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
    });
    const config = { transfer: { mode: 'full' } };
    const extractor = new DataExtractor(client, config);
    const mainData = {
      project: { branches: [{ name: 'main' }] },
      metrics: [],
      activeRules: []
    };
    const result = await extractor.extractBranch('develop', mainData);
    t.truthy(result.sources);
  } finally {
    if (orig === undefined) delete process.env.MAX_SOURCE_FILES;
    else process.env.MAX_SOURCE_FILES = orig;
  }
});

test('DataExtractor.extractBranch without performanceConfig.sourceExtraction => uses default', async t => {
  const client = mockClient({
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getIssues: sinon.stub().resolves([]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
  });
  const config = { transfer: { mode: 'full' } };
  const extractor = new DataExtractor(client, config);
  const mainData = {
    project: { branches: [{ name: 'main' }] },
    metrics: [],
    activeRules: []
  };
  const result = await extractor.extractBranch('develop', mainData);
  t.truthy(result.sources);
});

test('DataExtractor.extractBranch with sourceExtraction.concurrency uses provided value', async t => {
  const client = mockClient({
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getIssues: sinon.stub().resolves([]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
  });
  const config = { transfer: { mode: 'full' } };
  // Provide a truthy concurrency value so line 155 left-side branch is exercised
  const extractor = new DataExtractor(client, config, null, { sourceExtraction: { concurrency: 5 } });
  const mainData = {
    project: { branches: [{ name: 'main' }] },
    metrics: [],
    activeRules: []
  };
  const result = await extractor.extractBranch('feature', mainData);
  t.truthy(result.sources);
});

// --- quality-gates.js: conditions undefined => fallback to [] ---

test('extractQualityGates: gate details with undefined conditions => []', async t => {
  const client = mockClient({
    getQualityGates: sinon.stub().resolves({
      qualitygates: [{ name: 'Gate', isDefault: false }]
    }),
    getQualityGateDetails: sinon.stub().resolves({}),  // no conditions
    getQualityGatePermissions: sinon.stub().resolves({ users: [], groups: [] })
  });
  const result = await extractQualityGates(client);
  t.deepEqual(result[0].conditions, []);
  t.is(result[0].isBuiltIn, false);
});

// --- sources.js: file.path is undefined => falls back to file.key in debug log ---

test('extractSources: file without path uses key as fallback', async t => {
  const client = mockClient({
    getSourceFiles: sinon.stub().resolves([
      { key: 'proj:src/a.js' }  // no path property
    ]),
    getSourceCode: sinon.stub().resolves('const a = 1;')
  });
  const result = await extractSources(client, null, 0, { concurrency: 1 });
  t.is(result.length, 1);
  t.is(result[0].key, 'proj:src/a.js');
});

// --- server-info.js: missing all System fields => uses version/status fallback ---

test('extractServerInfo: no System at all, no version, no status => all unknown/null', async t => {
  const client = mockClient({
    getSystemInfo: sinon.stub().resolves({}),  // no System, no version, no status
    getInstalledPlugins: sinon.stub().resolves([{ key: 'p1', name: 'Plugin', version: '1.0' }]),
    getWebhooks: sinon.stub().resolves([]),
    getProjectSettings: sinon.stub().resolves([])
  });
  const result = await extractServerInfo(client);
  t.is(result.system.version, 'unknown');
  t.is(result.system.edition, 'unknown');
  t.is(result.system.status, 'unknown');
  t.is(result.system.id, null);
  t.is(result.system.database, null);
});

test('extractServerInfo: plugin with no description => empty string', async t => {
  const client = mockClient({
    getSystemInfo: sinon.stub().resolves({ System: { Version: '10.0' } }),
    getInstalledPlugins: sinon.stub().resolves([{ key: 'p1', name: 'Plugin', version: '1.0' }]),
    getWebhooks: sinon.stub().resolves([]),
    getProjectSettings: sinon.stub().resolves([])
  });
  const result = await extractServerInfo(client);
  t.is(result.plugins[0].description, '');
});

// --- webhooks.js: webhook with missing hasSecret and latestDelivery => defaults ---

test('extractWebhooks: webhook with no hasSecret and no latestDelivery => defaults', async t => {
  const client = mockClient({
    getWebhooks: sinon.stub().resolves([
      { key: 'wh1', name: 'Hook', url: 'http://test.com' }
    ])
  });
  const result = await extractWebhooks(client);
  t.is(result[0].hasSecret, false);
  t.is(result[0].latestDelivery, null);
});

// --- portfolios.js: use selectedProjects when projects is undefined ---

test('extractPortfolios: details with selectedProjects instead of projects', async t => {
  const client = mockClient({
    getPortfolios: sinon.stub().resolves([{ key: 'v1', name: 'P1', qualifier: 'VW' }]),
    getPortfolioDetails: sinon.stub().resolves({
      selectedProjects: [{ projectKey: 'pk1', name: 'P1' }],
      selectionMode: 'MANUAL',
      subViews: []
    })
  });
  const result = await extractPortfolios(client);
  t.is(result[0].projects.length, 1);
  t.is(result[0].projects[0].key, 'pk1');
});

test('extractPortfolios: portfolio with desc and no description', async t => {
  const client = mockClient({
    getPortfolios: sinon.stub().resolves([{ key: 'v1', name: 'P1', qualifier: 'VW', desc: 'Short desc' }]),
    getPortfolioDetails: sinon.stub().resolves({
      projects: [],
      subViews: []
    })
  });
  const result = await extractPortfolios(client);
  t.is(result[0].description, 'Short desc');
});

test('extractPortfolios: portfolio with no desc, no description, no visibility', async t => {
  const client = mockClient({
    getPortfolios: sinon.stub().resolves([{ key: 'v1', name: 'P1', qualifier: 'VW' }]),
    getPortfolioDetails: sinon.stub().resolves(null)
  });
  const result = await extractPortfolios(client);
  t.is(result[0].description, '');
  t.is(result[0].visibility, 'public');
});

test('extractPortfolios: project with selectedBranches', async t => {
  const client = mockClient({
    getPortfolios: sinon.stub().resolves([{ key: 'v1', name: 'P1', qualifier: 'VW' }]),
    getPortfolioDetails: sinon.stub().resolves({
      projects: [{ key: 'pk1', name: 'P1', selectedBranches: ['main', 'develop'] }],
      subViews: [{ key: 'sv1' }]
    })
  });
  const result = await extractPortfolios(client);
  t.deepEqual(result[0].projects[0].selectedBranches, ['main', 'develop']);
  t.is(result[0].subViews.length, 1);
});

// --- hotspots.js: hotspot fields with missing optional properties in success path ---

test('extractHotspots: hotspot with all optional fields present', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      {
        key: 'h1', component: 'c1', project: 'proj', securityCategory: 'sql-injection',
        vulnerabilityProbability: 'HIGH', status: 'REVIEWED', resolution: 'SAFE',
        line: 10, message: 'Check', assignee: 'user1', author: 'dev1',
        creationDate: '2024-01-01', updateDate: '2024-06-01'
      }
    ]),
    getHotspotDetails: sinon.stub().resolves({
      rule: { key: 'java:S1234' },
      comment: [{ text: 'c1' }],
      changelog: [{ date: '2024-01-01' }]
    })
  });
  const result = await extractHotspots(client, null, { concurrency: 1 });
  t.is(result[0].resolution, 'SAFE');
  t.is(result[0].assignee, 'user1');
  t.is(result[0].author, 'dev1');
  t.is(result[0].changelog.length, 1);
});

test('extractHotspots: hotspot with no resolution, assignee, author => null defaults', async t => {
  const client = mockClient({
    getHotspots: sinon.stub().resolves([
      {
        key: 'h1', component: 'c1', project: 'proj', securityCategory: 'xss',
        vulnerabilityProbability: 'LOW', status: 'TO_REVIEW',
        line: 5, message: 'Check', creationDate: '2024-01-01', updateDate: '2024-06-01'
        // no resolution, assignee, author
      }
    ]),
    getHotspotDetails: sinon.stub().resolves({
      rule: { key: 'java:S5678' },
      comment: [],
      changelog: []
    })
  });
  const result = await extractHotspots(client, null, { concurrency: 1 });
  t.is(result[0].resolution, null);
  t.is(result[0].assignee, null);
  t.is(result[0].author, null);
});

// --- server-info.js: webhook with no hasSecret => false ---

test('extractServerInfo: webhook with no hasSecret => false', async t => {
  const client = mockClient({
    getSystemInfo: sinon.stub().resolves({ System: { Version: '10.0' } }),
    getInstalledPlugins: sinon.stub().resolves([]),
    getWebhooks: sinon.stub().resolves([{ key: 'w1', name: 'Hook', url: 'http://test.com' }]),
    getProjectSettings: sinon.stub().resolves([])
  });
  const result = await extractServerInfo(client);
  t.is(result.webhooks[0].hasSecret, false);
});

// --- quality-gates.js: no default gate => logs 'none' ---

test('extractQualityGates: no default gate => logs none', async t => {
  const client = mockClient({
    getQualityGates: sinon.stub().resolves({
      qualitygates: [{ name: 'Custom Gate' }]  // no isDefault
    }),
    getQualityGateDetails: sinon.stub().resolves({ conditions: [] }),
    getQualityGatePermissions: sinon.stub().resolves({ users: [], groups: [] })
  });
  const result = await extractQualityGates(client);
  t.is(result[0].isDefault, false);
  t.is(result[0].isBuiltIn, false);
});

// --- server-config.js: getNewCodePeriods show/list catch branches ---

test('serverConfig.getNewCodePeriods: show throws => projectLevel null', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().rejects(new Error('404'))       // show throws
    .onSecondCall().resolves({ data: { newCodePeriods: [] } })
  );
  const result = await serverConfig.getNewCodePeriods(client, 'proj');
  t.is(result.projectLevel, null);
});

test('serverConfig.getNewCodePeriods: list throws => branchOverrides empty', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().resolves({ data: { type: 'PREVIOUS_VERSION' } })
    .onSecondCall().rejects(new Error('list fail'))
  );
  const result = await serverConfig.getNewCodePeriods(client, 'proj');
  t.deepEqual(result.branchOverrides, []);
});

// --- server-config.js: getAlmSettings catch branch ---

test('serverConfig.getAlmSettings: throws => returns {}', async t => {
  const client = mockAxiosClient(sinon.stub().rejects(new Error('fail')));
  const result = await serverConfig.getAlmSettings(client);
  t.deepEqual(result, {});
});

// --- server-config.js: getProjectBinding catch branch ---

test('serverConfig.getProjectBinding: throws => returns null', async t => {
  const client = mockAxiosClient(sinon.stub().rejects(new Error('fail')));
  const result = await serverConfig.getProjectBinding(client, 'proj');
  t.is(result, null);
});

// --- server-config.js: getSystemInfo catch branch (falls back to status) ---

test('serverConfig.getSystemInfo: info throws => falls back to system/status', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().rejects(new Error('admin required'))
    .onSecondCall().resolves({ data: { status: 'UP', version: '9.9' } })
  );
  const result = await serverConfig.getSystemInfo(client);
  t.is(result.status, 'UP');
});

// --- server-config.js: getInstalledPlugins catch branch ---

test('serverConfig.getInstalledPlugins: throws => returns []', async t => {
  const client = mockAxiosClient(sinon.stub().rejects(new Error('fail')));
  const result = await serverConfig.getInstalledPlugins(client);
  t.deepEqual(result, []);
});

// --- server-config.js: getWebhooks catch branch ---

test('serverConfig.getWebhooks: throws => returns []', async t => {
  const client = mockAxiosClient(sinon.stub().rejects(new Error('fail')));
  const result = await serverConfig.getWebhooks(client, 'proj');
  t.deepEqual(result, []);
});

// --- api/permissions.js: getPortfolios catch branch ---

test('permissions.getPortfolios: throws => returns []', async t => {
  const client = mockAxiosClient(sinon.stub().rejects(new Error('enterprise only')));
  const result = await permissions.getPortfolios(client);
  t.deepEqual(result, []);
});

// --- api/permissions.js: getPortfolioDetails catch branch ---

test('permissions.getPortfolioDetails: throws => returns null', async t => {
  const client = mockAxiosClient(sinon.stub().rejects(new Error('not found')));
  const result = await permissions.getPortfolioDetails(client, 'key1');
  t.is(result, null);
});

// --- api/quality.js: getQualityGatePermissions catch branches ---

test('quality.getQualityGatePermissions: search_users throws => empty users', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().rejects(new Error('users fail'))
    .onSecondCall().resolves({ data: { groups: [{ name: 'g1' }] } })
  );
  const result = await quality.getQualityGatePermissions(client, 'gate');
  t.deepEqual(result.users, []);
  t.is(result.groups.length, 1);
});

test('quality.getQualityGatePermissions: search_groups throws => empty groups', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().resolves({ data: { users: [{ login: 'u1' }] } })
    .onSecondCall().rejects(new Error('groups fail'))
  );
  const result = await quality.getQualityGatePermissions(client, 'gate');
  t.is(result.users.length, 1);
  t.deepEqual(result.groups, []);
});

// --- api/quality.js: getQualityProfilePermissions catch branches ---

test('quality.getQualityProfilePermissions: search_users throws => empty users', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().rejects(new Error('users fail'))
    .onSecondCall().resolves({ data: { groups: [] } })
  );
  const result = await quality.getQualityProfilePermissions(client, 'js', 'Profile');
  t.deepEqual(result.users, []);
});

test('quality.getQualityProfilePermissions: search_groups throws => empty groups', async t => {
  const client = mockAxiosClient(sinon.stub()
    .onFirstCall().resolves({ data: { users: [] } })
    .onSecondCall().rejects(new Error('groups fail'))
  );
  const result = await quality.getQualityProfilePermissions(client, 'js', 'Profile');
  t.deepEqual(result.groups, []);
});

// --- api-client.js: handleError branches (lines 34, 37-38) ---

test('api-client handleError: data.errors undefined AND data.message undefined => falls to error.message', t => {
  const client = new SonarQubeClient({ url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' });
  // Simulate an HTTP error response where data has no errors array and no message
  const error = new Error('Request failed with status code 500');
  error.response = {
    status: 500,
    data: {},  // no errors, no message
    config: { url: '/api/some/endpoint' }
  };
  const thrown = t.throws(() => client.handleError(error));
  // Line 34: data.errors?.[0]?.msg is undefined, data.message is undefined => falls to error.message
  t.true(thrown.message.includes('Request failed with status code 500'));
  t.true(thrown.message.includes('500'));
});

test('api-client handleError: network error with no baseURL on client and no error.config.baseURL => "unknown"', t => {
  // Create a client then clear its baseURL to make it falsy
  const client = new SonarQubeClient({ url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' });
  client.baseURL = '';  // falsy
  const error = new Error('Network Error');
  error.request = {};
  error.config = {};  // no baseURL
  // Also no error.code
  const thrown = t.throws(() => client.handleError(error));
  // Line 37: this.baseURL is '' (falsy), error.config?.baseURL is undefined => 'unknown'
  t.true(thrown.message.includes('unknown'));
  // Line 38: error.code is undefined => 'UNKNOWN'
  t.true(thrown.message.includes('UNKNOWN'));
});

test('api-client handleError: network error with error.config.baseURL fallback', t => {
  const client = new SonarQubeClient({ url: 'http://localhost:9000', token: 'tok', projectKey: 'proj' });
  client.baseURL = '';  // falsy
  const error = new Error('ECONNREFUSED');
  error.request = {};
  error.config = { baseURL: 'http://fallback-host:9000' };
  error.code = 'ECONNREFUSED';
  const thrown = t.throws(() => client.handleError(error));
  // Line 37: this.baseURL is '' (falsy) => uses error.config.baseURL
  t.true(thrown.message.includes('http://fallback-host:9000'));
  t.true(thrown.message.includes('Connection refused'));
});

// --- devops-bindings.js: concurrency default (line 55) ---

test('extractAllProjectBindings: without concurrency option uses default 10', async t => {
  const client = mockClient({
    getProjectBinding: sinon.stub().resolves({ alm: 'github', key: 'gh', repository: 'org/repo' })
  });
  const projects = [{ key: 'p1' }];
  // Pass empty options object (no concurrency property)
  const result = await extractAllProjectBindings(client, projects, {});
  // Line 55: options.concurrency is undefined => falls to || 10
  t.is(result.size, 1);
  t.truthy(result.get('p1'));
});

test('extractAllProjectBindings: with no options parameter uses default concurrency', async t => {
  const client = mockClient({
    getProjectBinding: sinon.stub().resolves({ alm: 'github', key: 'gh', repository: 'org/repo' })
  });
  const projects = [{ key: 'p1' }];
  // Omit options parameter entirely (default is {})
  const result = await extractAllProjectBindings(client, projects);
  t.is(result.size, 1);
  t.truthy(result.get('p1'));
});

// --- index.js: MAX_SOURCE_FILES not set and sourceExtraction.concurrency fallback ---

test('DataExtractor.extractAll without MAX_SOURCE_FILES env var uses default 0', async t => {
  const orig = process.env.MAX_SOURCE_FILES;
  delete process.env.MAX_SOURCE_FILES;
  try {
    const client = mockClient({
      getMetrics: sinon.stub().resolves([]),
      getComponentTree: sinon.stub().resolves([]),
      getSourceFiles: sinon.stub().resolves([]),
      getIssues: sinon.stub().resolves([]),
      getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
      getQualityProfiles: sinon.stub().resolves([]),
    });
    const config = { transfer: { mode: 'full' } };
    // performanceConfig with no sourceExtraction property
    const extractor = new DataExtractor(client, config, null, {});
    const result = await extractor.extractAll();
    // Line 87: MAX_SOURCE_FILES not set => false branch => maxFiles = 0
    // Line 89: sourceExtraction is undefined => ?.concurrency is undefined => || 10
    t.truthy(result.sources);
  } finally {
    if (orig === undefined) delete process.env.MAX_SOURCE_FILES;
    else process.env.MAX_SOURCE_FILES = orig;
  }
});

test('DataExtractor.extractAll with sourceExtraction but no concurrency uses default 10', async t => {
  const client = mockClient({
    getMetrics: sinon.stub().resolves([]),
    getComponentTree: sinon.stub().resolves([]),
    getSourceFiles: sinon.stub().resolves([]),
    getIssues: sinon.stub().resolves([]),
    getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
    getQualityProfiles: sinon.stub().resolves([]),
  });
  const config = { transfer: { mode: 'full' } };
  // performanceConfig.sourceExtraction exists but has no concurrency property
  const extractor = new DataExtractor(client, config, null, { sourceExtraction: {} });
  const result = await extractor.extractAll();
  // Line 89: sourceExtraction.concurrency is undefined => || 10
  t.truthy(result.sources);
});

test('DataExtractor.extractBranch without MAX_SOURCE_FILES env var uses default 0', async t => {
  const orig = process.env.MAX_SOURCE_FILES;
  delete process.env.MAX_SOURCE_FILES;
  try {
    const client = mockClient({
      getComponentTree: sinon.stub().resolves([]),
      getSourceFiles: sinon.stub().resolves([]),
      getIssues: sinon.stub().resolves([]),
      getMeasures: sinon.stub().resolves({ key: 'proj', measures: [] }),
    });
    const config = { transfer: { mode: 'full' } };
    const extractor = new DataExtractor(client, config, null, {});
    const mainData = {
      project: { branches: [{ name: 'main' }] },
      metrics: [],
      activeRules: []
    };
    const result = await extractor.extractBranch('develop', mainData);
    // Line 153: MAX_SOURCE_FILES not set => false branch => maxFiles = 0
    t.truthy(result.sources);
  } finally {
    if (orig === undefined) delete process.env.MAX_SOURCE_FILES;
    else process.env.MAX_SOURCE_FILES = orig;
  }
});
