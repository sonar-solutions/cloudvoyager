import test from 'ava';
import sinon from 'sinon';

// Quality Gates
import { migrateQualityGates, assignQualityGatesToProjects } from '../../../src/sonarcloud/migrators/quality-gates.js';

// Quality Profiles
import { migrateQualityProfiles } from '../../../src/sonarcloud/migrators/quality-profiles.js';

// Quality Profile Diff
import { generateQualityProfileDiff } from '../../../src/sonarcloud/migrators/quality-profile-diff.js';

// Groups
import { migrateGroups } from '../../../src/sonarcloud/migrators/groups.js';

// Permissions
import { migrateGlobalPermissions, migrateProjectPermissions, migratePermissionTemplates } from '../../../src/sonarcloud/migrators/permissions.js';

// Project Config
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from '../../../src/sonarcloud/migrators/project-config.js';

// Portfolios
import { migratePortfolios } from '../../../src/sonarcloud/migrators/portfolios.js';

// Issue Sync
import { syncIssues } from '../../../src/sonarcloud/migrators/issue-sync.js';

// Hotspot Sync
import { syncHotspots } from '../../../src/sonarcloud/migrators/hotspot-sync.js';

test.afterEach(() => sinon.restore());

// ============================================================================
// Mock Client Factory
// ============================================================================

function mockClient(overrides = {}) {
  return {
    // Quality Gates
    createQualityGate: sinon.stub().resolves({ id: '1', name: 'Gate' }),
    createQualityGateCondition: sinon.stub().resolves({}),
    setDefaultQualityGate: sinon.stub().resolves({}),
    assignQualityGateToProject: sinon.stub().resolves({}),

    // Permissions (shared by gates, profiles, global, project)
    addGroupPermission: sinon.stub().resolves({}),
    addProjectGroupPermission: sinon.stub().resolves({}),

    // Quality Profiles
    restoreQualityProfile: sinon.stub().resolves({}),
    setDefaultQualityProfile: sinon.stub().resolves({}),
    addQualityProfileGroupPermission: sinon.stub().resolves({}),
    addQualityProfileUserPermission: sinon.stub().resolves({}),
    searchQualityProfiles: sinon.stub().resolves([]),
    getActiveRules: sinon.stub().resolves([]),

    // Groups
    createGroup: sinon.stub().resolves({ name: 'group', id: '1' }),

    // Permission Templates
    createPermissionTemplate: sinon.stub().resolves({ id: 'tpl1' }),
    addGroupToTemplate: sinon.stub().resolves({}),
    setDefaultTemplate: sinon.stub().resolves({}),

    // Project Config
    setProjectSetting: sinon.stub().resolves({}),
    setProjectTags: sinon.stub().resolves({}),
    createProjectLink: sinon.stub().resolves({}),
    setGithubBinding: sinon.stub().resolves({}),
    setGitlabBinding: sinon.stub().resolves({}),
    setAzureBinding: sinon.stub().resolves({}),
    setBitbucketBinding: sinon.stub().resolves({}),

    // Portfolios
    createPortfolio: sinon.stub().resolves({ key: 'portfolio-key' }),
    addProjectToPortfolio: sinon.stub().resolves({}),

    // Issues
    searchIssues: sinon.stub().resolves([]),
    transitionIssue: sinon.stub().resolves({}),
    assignIssue: sinon.stub().resolves({}),
    addIssueComment: sinon.stub().resolves({}),
    setIssueTags: sinon.stub().resolves({}),

    // Hotspots
    searchHotspots: sinon.stub().resolves([]),
    changeHotspotStatus: sinon.stub().resolves({}),
    addHotspotComment: sinon.stub().resolves({}),

    ...overrides
  };
}

// ============================================================================
// quality-gates.js - migrateQualityGates
// ============================================================================

test('migrateQualityGates migrates custom gates and skips built-in', async t => {
  const client = mockClient();
  const gates = [
    {
      name: 'Custom Gate',
      isBuiltIn: false,
      isDefault: false,
      conditions: [{ metric: 'coverage', op: 'LT', error: '80' }],
      permissions: { groups: [], users: [] }
    },
    {
      name: 'Sonar way',
      isBuiltIn: true,
      isDefault: true,
      conditions: [],
      permissions: { groups: [], users: [] }
    }
  ];

  const result = await migrateQualityGates(gates, client);

  t.true(result instanceof Map);
  t.is(result.size, 1);
  t.is(result.get('Custom Gate'), '1');
  t.is(client.createQualityGate.callCount, 1);
  t.is(client.createQualityGate.firstCall.args[0], 'Custom Gate');
});

test('migrateQualityGates creates conditions for each gate', async t => {
  const client = mockClient();
  const gates = [
    {
      name: 'Gate1',
      isBuiltIn: false,
      isDefault: false,
      conditions: [
        { metric: 'coverage', op: 'LT', error: '80' },
        { metric: 'bugs', op: 'GT', error: '0' }
      ],
      permissions: { groups: [] }
    }
  ];

  await migrateQualityGates(gates, client);

  t.is(client.createQualityGateCondition.callCount, 2);
  t.deepEqual(client.createQualityGateCondition.firstCall.args, ['1', 'coverage', 'LT', '80']);
  t.deepEqual(client.createQualityGateCondition.secondCall.args, ['1', 'bugs', 'GT', '0']);
});

test('migrateQualityGates sets default gate', async t => {
  const client = mockClient();
  const gates = [
    {
      name: 'Default Gate',
      isBuiltIn: false,
      isDefault: true,
      conditions: [],
      permissions: { groups: [] }
    }
  ];

  await migrateQualityGates(gates, client);

  t.is(client.setDefaultQualityGate.callCount, 1);
  t.is(client.setDefaultQualityGate.firstCall.args[0], '1');
});

test('migrateQualityGates does not set default for non-default gate', async t => {
  const client = mockClient();
  const gates = [
    {
      name: 'Non-Default',
      isBuiltIn: false,
      isDefault: false,
      conditions: [],
      permissions: { groups: [] }
    }
  ];

  await migrateQualityGates(gates, client);

  t.is(client.setDefaultQualityGate.callCount, 0);
});

test('migrateQualityGates sets gate permissions for selected groups', async t => {
  const client = mockClient();
  const gates = [
    {
      name: 'Gate1',
      isBuiltIn: false,
      isDefault: false,
      conditions: [],
      permissions: {
        groups: [
          { name: 'devs', selected: true },
          { name: 'viewers', selected: false },
          { name: 'admins', selected: true }
        ]
      }
    }
  ];

  await migrateQualityGates(gates, client);

  t.is(client.addGroupPermission.callCount, 2);
  t.is(client.addGroupPermission.firstCall.args[0], 'devs');
  t.is(client.addGroupPermission.firstCall.args[1], 'gateadmin');
});

test('migrateQualityGates handles gate creation failure gracefully', async t => {
  const client = mockClient({
    createQualityGate: sinon.stub().rejects(new Error('already exists'))
  });
  const gates = [
    {
      name: 'Failing Gate',
      isBuiltIn: false,
      conditions: [],
      permissions: { groups: [] }
    }
  ];

  const result = await migrateQualityGates(gates, client);

  t.is(result.size, 0);
});

test('migrateQualityGates handles condition creation failure gracefully', async t => {
  const client = mockClient({
    createQualityGateCondition: sinon.stub().rejects(new Error('invalid metric'))
  });
  const gates = [
    {
      name: 'Gate1',
      isBuiltIn: false,
      isDefault: false,
      conditions: [{ metric: 'bad_metric', op: 'LT', error: '80' }],
      permissions: { groups: [] }
    }
  ];

  const result = await migrateQualityGates(gates, client);

  // Gate still gets mapped despite condition failure
  t.is(result.size, 1);
});

test('migrateQualityGates handles setDefault failure gracefully', async t => {
  const client = mockClient({
    setDefaultQualityGate: sinon.stub().rejects(new Error('permission denied'))
  });
  const gates = [
    {
      name: 'Gate1',
      isBuiltIn: false,
      isDefault: true,
      conditions: [],
      permissions: { groups: [] }
    }
  ];

  const result = await migrateQualityGates(gates, client);

  t.is(result.size, 1);
});

test('migrateQualityGates handles gate permission failure gracefully', async t => {
  const client = mockClient({
    addGroupPermission: sinon.stub().rejects(new Error('group not found'))
  });
  const gates = [
    {
      name: 'Gate1',
      isBuiltIn: false,
      isDefault: false,
      conditions: [],
      permissions: {
        groups: [{ name: 'nonexistent', selected: true }]
      }
    }
  ];

  const result = await migrateQualityGates(gates, client);

  t.is(result.size, 1);
});

test('migrateQualityGates returns empty map for empty input', async t => {
  const client = mockClient();
  const result = await migrateQualityGates([], client);

  t.is(result.size, 0);
  t.is(client.createQualityGate.callCount, 0);
});

test('migrateQualityGates returns empty map for all built-in gates', async t => {
  const client = mockClient();
  const gates = [
    { name: 'Sonar way', isBuiltIn: true, conditions: [], permissions: { groups: [] } }
  ];
  const result = await migrateQualityGates(gates, client);

  t.is(result.size, 0);
});

// ============================================================================
// quality-gates.js - assignQualityGatesToProjects
// ============================================================================

test('assignQualityGatesToProjects assigns gates from mapping', async t => {
  const client = mockClient();
  const gateMapping = new Map([['Custom Gate', '42']]);
  const assignments = [
    { projectKey: 'proj1', gateName: 'Custom Gate' },
    { projectKey: 'proj2', gateName: 'Custom Gate' }
  ];

  await assignQualityGatesToProjects(gateMapping, assignments, client);

  t.is(client.assignQualityGateToProject.callCount, 2);
  t.deepEqual(client.assignQualityGateToProject.firstCall.args, ['42', 'proj1']);
  t.deepEqual(client.assignQualityGateToProject.secondCall.args, ['42', 'proj2']);
});

test('assignQualityGatesToProjects skips unmapped gates', async t => {
  const client = mockClient();
  const gateMapping = new Map([['Custom Gate', '42']]);
  const assignments = [
    { projectKey: 'proj1', gateName: 'Unknown Gate' }
  ];

  await assignQualityGatesToProjects(gateMapping, assignments, client);

  t.is(client.assignQualityGateToProject.callCount, 0);
});

test('assignQualityGatesToProjects handles assignment failure gracefully', async t => {
  const client = mockClient({
    assignQualityGateToProject: sinon.stub().rejects(new Error('project not found'))
  });
  const gateMapping = new Map([['Gate', '1']]);
  const assignments = [{ projectKey: 'proj', gateName: 'Gate' }];

  // Should not throw
  await t.notThrowsAsync(() => assignQualityGatesToProjects(gateMapping, assignments, client));
});

test('assignQualityGatesToProjects handles empty assignments', async t => {
  const client = mockClient();
  const gateMapping = new Map([['Gate', '1']]);

  await assignQualityGatesToProjects(gateMapping, [], client);

  t.is(client.assignQualityGateToProject.callCount, 0);
});

// ============================================================================
// quality-profiles.js - migrateQualityProfiles
// ============================================================================

test('migrateQualityProfiles restores custom profiles', async t => {
  const client = mockClient();
  const profiles = [
    {
      key: 'p1',
      name: 'Custom JS',
      language: 'js',
      isBuiltIn: false,
      isDefault: false,
      parentKey: null,
      backupXml: '<xml>custom</xml>',
      permissions: { groups: [], users: [] }
    }
  ];

  const result = await migrateQualityProfiles(profiles, client);

  t.true(result.profileMapping instanceof Map);
  t.is(result.profileMapping.get('p1'), 'Custom JS');
  t.is(client.restoreQualityProfile.callCount, 1);
  t.is(client.restoreQualityProfile.firstCall.args[0], '<xml>custom</xml>');
});

test('migrateQualityProfiles restores built-in profiles with migrated suffix', async t => {
  const client = mockClient();
  const profiles = [
    {
      key: 'bp1',
      name: 'Sonar way',
      language: 'js',
      isBuiltIn: true,
      isDefault: false,
      parentKey: null,
      backupXml: '<profile><name>Sonar way</name><rules/></profile>',
      permissions: { groups: [], users: [] }
    }
  ];

  const result = await migrateQualityProfiles(profiles, client);

  t.is(result.profileMapping.get('bp1'), 'Sonar way (SonarQube Migrated)');
  t.is(result.builtInProfileMapping.get('js'), 'Sonar way (SonarQube Migrated)');
  // The XML passed to restore should have the renamed name
  const restoredXml = client.restoreQualityProfile.firstCall.args[0];
  t.true(restoredXml.includes('Sonar way (SonarQube Migrated)'));
  t.false(restoredXml.includes('<name>Sonar way</name>'));
});

test('migrateQualityProfiles skips built-in profiles without backup XML', async t => {
  const client = mockClient();
  const profiles = [
    {
      key: 'bp1',
      name: 'Sonar way',
      language: 'js',
      isBuiltIn: true,
      isDefault: false,
      backupXml: null,
      permissions: { groups: [], users: [] }
    }
  ];

  const result = await migrateQualityProfiles(profiles, client);

  t.is(result.profileMapping.size, 0);
  t.is(result.builtInProfileMapping.size, 0);
  t.is(client.restoreQualityProfile.callCount, 0);
});

test('migrateQualityProfiles sets default for custom profiles', async t => {
  const client = mockClient();
  const profiles = [
    {
      key: 'p1',
      name: 'Custom JS',
      language: 'js',
      isBuiltIn: false,
      isDefault: true,
      parentKey: null,
      backupXml: '<xml/>',
      permissions: { groups: [], users: [] }
    }
  ];

  await migrateQualityProfiles(profiles, client);

  t.is(client.setDefaultQualityProfile.callCount, 1);
  t.deepEqual(client.setDefaultQualityProfile.firstCall.args, ['js', 'Custom JS']);
});

test('migrateQualityProfiles does not set default for built-in profiles', async t => {
  const client = mockClient();
  const profiles = [
    {
      key: 'bp1',
      name: 'Sonar way',
      language: 'js',
      isBuiltIn: true,
      isDefault: true,
      backupXml: '<profile><name>Sonar way</name></profile>',
      permissions: { groups: [], users: [] }
    }
  ];

  await migrateQualityProfiles(profiles, client);

  // Built-in profiles are not set as org defaults
  t.is(client.setDefaultQualityProfile.callCount, 0);
});

test('migrateQualityProfiles sets group permissions for custom profiles', async t => {
  const client = mockClient();
  const profiles = [
    {
      key: 'p1',
      name: 'Custom JS',
      language: 'js',
      isBuiltIn: false,
      isDefault: false,
      parentKey: null,
      backupXml: '<xml/>',
      permissions: {
        groups: [
          { name: 'devs', selected: true },
          { name: 'viewers', selected: false }
        ],
        users: []
      }
    }
  ];

  await migrateQualityProfiles(profiles, client);

  t.is(client.addQualityProfileGroupPermission.callCount, 1);
  t.deepEqual(client.addQualityProfileGroupPermission.firstCall.args, ['Custom JS', 'js', 'devs']);
});

test('migrateQualityProfiles sets user permissions for custom profiles', async t => {
  const client = mockClient();
  const profiles = [
    {
      key: 'p1',
      name: 'Custom JS',
      language: 'js',
      isBuiltIn: false,
      isDefault: false,
      parentKey: null,
      backupXml: '<xml/>',
      permissions: {
        groups: [],
        users: [
          { login: 'alice', selected: true },
          { login: 'bob', selected: false }
        ]
      }
    }
  ];

  await migrateQualityProfiles(profiles, client);

  t.is(client.addQualityProfileUserPermission.callCount, 1);
  t.deepEqual(client.addQualityProfileUserPermission.firstCall.args, ['Custom JS', 'js', 'alice']);
});

test('migrateQualityProfiles handles restore failure gracefully', async t => {
  const client = mockClient({
    restoreQualityProfile: sinon.stub().rejects(new Error('restore failed'))
  });
  const profiles = [
    {
      key: 'p1',
      name: 'Failing Profile',
      language: 'js',
      isBuiltIn: false,
      isDefault: false,
      parentKey: null,
      backupXml: '<xml/>',
      permissions: { groups: [], users: [] }
    }
  ];

  const result = await migrateQualityProfiles(profiles, client);

  t.is(result.profileMapping.size, 0);
});

test('migrateQualityProfiles handles built-in restore failure gracefully', async t => {
  const client = mockClient({
    restoreQualityProfile: sinon.stub().rejects(new Error('restore failed'))
  });
  const profiles = [
    {
      key: 'bp1',
      name: 'Sonar way',
      language: 'js',
      isBuiltIn: true,
      isDefault: false,
      backupXml: '<profile><name>Sonar way</name></profile>',
      permissions: { groups: [], users: [] }
    }
  ];

  const result = await migrateQualityProfiles(profiles, client);

  t.is(result.builtInProfileMapping.size, 0);
});

test('migrateQualityProfiles skips custom profiles without backup XML', async t => {
  const client = mockClient();
  const profiles = [
    {
      key: 'p1',
      name: 'No Backup',
      language: 'js',
      isBuiltIn: false,
      isDefault: false,
      parentKey: null,
      backupXml: null,
      permissions: { groups: [], users: [] }
    }
  ];

  const result = await migrateQualityProfiles(profiles, client);

  t.is(result.profileMapping.size, 0);
  t.is(client.restoreQualityProfile.callCount, 0);
});

test('migrateQualityProfiles restores inheritance chains in order', async t => {
  const client = mockClient();
  const restoreOrder = [];
  client.restoreQualityProfile = sinon.stub().callsFake(async (xml) => {
    restoreOrder.push(xml);
  });

  const profiles = [
    {
      key: 'child',
      name: 'Child',
      language: 'js',
      isBuiltIn: false,
      isDefault: false,
      parentKey: 'parent',
      backupXml: '<child/>',
      permissions: { groups: [], users: [] }
    },
    {
      key: 'parent',
      name: 'Parent',
      language: 'js',
      isBuiltIn: false,
      isDefault: false,
      parentKey: null,
      backupXml: '<parent/>',
      permissions: { groups: [], users: [] }
    }
  ];

  await migrateQualityProfiles(profiles, client);

  // Parent should be restored before child due to inheritance chain ordering
  t.is(restoreOrder[0], '<parent/>');
  t.is(restoreOrder[1], '<child/>');
});

test('migrateQualityProfiles returns empty maps for empty input', async t => {
  const client = mockClient();
  const result = await migrateQualityProfiles([], client);

  t.is(result.profileMapping.size, 0);
  t.is(result.builtInProfileMapping.size, 0);
});

test('migrateQualityProfiles handles setDefault failure gracefully', async t => {
  const client = mockClient({
    setDefaultQualityProfile: sinon.stub().rejects(new Error('fail'))
  });
  const profiles = [
    {
      key: 'p1',
      name: 'Default',
      language: 'js',
      isBuiltIn: false,
      isDefault: true,
      parentKey: null,
      backupXml: '<xml/>',
      permissions: { groups: [], users: [] }
    }
  ];

  // Should not throw
  const result = await migrateQualityProfiles(profiles, client);
  t.is(result.profileMapping.size, 1);
});

test('migrateQualityProfiles handles permission failures gracefully', async t => {
  const client = mockClient({
    addQualityProfileGroupPermission: sinon.stub().rejects(new Error('fail')),
    addQualityProfileUserPermission: sinon.stub().rejects(new Error('fail'))
  });
  const profiles = [
    {
      key: 'p1',
      name: 'Custom',
      language: 'js',
      isBuiltIn: false,
      isDefault: false,
      parentKey: null,
      backupXml: '<xml/>',
      permissions: {
        groups: [{ name: 'devs', selected: true }],
        users: [{ login: 'alice', selected: true }]
      }
    }
  ];

  // Should not throw
  const result = await migrateQualityProfiles(profiles, client);
  t.is(result.profileMapping.size, 1);
});

// ============================================================================
// quality-profile-diff.js - generateQualityProfileDiff
// ============================================================================

test('generateQualityProfileDiff compares profiles and reports missing/added rules', async t => {
  const scClient = mockClient({
    searchQualityProfiles: sinon.stub().resolves([
      { key: 'sc-p1', name: 'Custom JS', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'js:S1001', name: 'Rule 1', type: 'BUG', severity: 'MAJOR' },
      { key: 'js:S1002', name: 'Rule 2', type: 'BUG', severity: 'MINOR' }
    ])
  });
  const sqClient = {
    getActiveRules: sinon.stub().resolves([
      { key: 'js:S1001', name: 'Rule 1', type: 'BUG', severity: 'MAJOR' },
      { key: 'js:S1003', name: 'Rule 3', type: 'CODE_SMELL', severity: 'INFO' }
    ])
  };

  const extractedProfiles = [
    { key: 'sq-p1', name: 'Custom JS', language: 'js' }
  ];

  const report = await generateQualityProfileDiff(extractedProfiles, sqClient, scClient);

  t.truthy(report.generatedAt);
  t.is(report.summary.languagesCompared, 1);
  t.is(report.summary.totalMissingRules, 1); // S1003 in SQ but not SC
  t.is(report.summary.totalAddedRules, 1);   // S1002 in SC but not SQ
  t.truthy(report.languages.js);
  t.is(report.languages.js.missingRules.length, 1);
  t.is(report.languages.js.addedRules.length, 1);
});

test('generateQualityProfileDiff matches migrated built-in profile with suffix', async t => {
  const scClient = mockClient({
    searchQualityProfiles: sinon.stub().resolves([
      { key: 'sc-p1', name: 'Sonar way (SonarQube Migrated)', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([
      { key: 'js:S1001', name: 'Rule 1' }
    ])
  });
  const sqClient = {
    getActiveRules: sinon.stub().resolves([
      { key: 'js:S1001', name: 'Rule 1' }
    ])
  };

  const extractedProfiles = [
    { key: 'sq-p1', name: 'Sonar way', language: 'js' }
  ];

  const report = await generateQualityProfileDiff(extractedProfiles, sqClient, scClient);

  t.is(report.summary.languagesCompared, 1);
  t.is(report.summary.totalMissingRules, 0);
  t.is(report.summary.totalAddedRules, 0);
});

test('generateQualityProfileDiff skips profiles with no SC counterpart', async t => {
  const scClient = mockClient({
    searchQualityProfiles: sinon.stub().resolves([])
  });
  const sqClient = {
    getActiveRules: sinon.stub().resolves([])
  };

  const extractedProfiles = [
    { key: 'sq-p1', name: 'Unknown Profile', language: 'js' }
  ];

  const report = await generateQualityProfileDiff(extractedProfiles, sqClient, scClient);

  t.is(report.summary.languagesCompared, 0);
  t.deepEqual(report.languages, {});
});

test('generateQualityProfileDiff handles diff error gracefully', async t => {
  const scClient = mockClient({
    searchQualityProfiles: sinon.stub().resolves([
      { key: 'sc-p1', name: 'Custom JS', language: 'js' }
    ]),
    getActiveRules: sinon.stub().rejects(new Error('API error'))
  });
  const sqClient = {
    getActiveRules: sinon.stub().resolves([])
  };

  const extractedProfiles = [
    { key: 'sq-p1', name: 'Custom JS', language: 'js' }
  ];

  const report = await generateQualityProfileDiff(extractedProfiles, sqClient, scClient);

  t.is(report.summary.languagesCompared, 0);
});

test('generateQualityProfileDiff handles multiple profiles per language', async t => {
  const scClient = mockClient({
    searchQualityProfiles: sinon.stub().resolves([
      { key: 'sc-p1', name: 'Profile A', language: 'js' },
      { key: 'sc-p2', name: 'Profile B', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves([])
  });
  const sqClient = {
    getActiveRules: sinon.stub().resolves([])
  };

  const extractedProfiles = [
    { key: 'sq-p1', name: 'Profile A', language: 'js' },
    { key: 'sq-p2', name: 'Profile B', language: 'js' }
  ];

  const report = await generateQualityProfileDiff(extractedProfiles, sqClient, scClient);

  t.is(report.summary.languagesCompared, 2);
  // Second profile should use qualified key
  t.truthy(report.languages['js']);
  t.truthy(report.languages['js:Profile B']);
});

test('generateQualityProfileDiff reports perfectly matching profiles', async t => {
  const rules = [
    { key: 'js:S1001', name: 'Rule 1', type: 'BUG', severity: 'MAJOR' }
  ];
  const scClient = mockClient({
    searchQualityProfiles: sinon.stub().resolves([
      { key: 'sc-p1', name: 'Profile A', language: 'js' }
    ]),
    getActiveRules: sinon.stub().resolves(rules)
  });
  const sqClient = {
    getActiveRules: sinon.stub().resolves(rules)
  };

  const extractedProfiles = [
    { key: 'sq-p1', name: 'Profile A', language: 'js' }
  ];

  const report = await generateQualityProfileDiff(extractedProfiles, sqClient, scClient);

  t.is(report.summary.totalMissingRules, 0);
  t.is(report.summary.totalAddedRules, 0);
});

test('generateQualityProfileDiff returns empty report for empty profiles', async t => {
  const scClient = mockClient();
  const sqClient = { getActiveRules: sinon.stub().resolves([]) };

  const report = await generateQualityProfileDiff([], sqClient, scClient);

  t.is(report.summary.languagesCompared, 0);
});

// ============================================================================
// groups.js - migrateGroups
// ============================================================================

test('migrateGroups creates custom groups and skips system groups', async t => {
  const client = mockClient();
  const groups = [
    { name: 'custom-devs', description: 'Custom dev group' },
    { name: 'Anyone', description: 'System group' },
    { name: 'sonar-users', description: 'System group' },
    { name: 'sonar-administrators', description: 'System group' }
  ];

  const result = await migrateGroups(groups, client);

  t.is(result.size, 1);
  t.truthy(result.get('custom-devs'));
  t.is(client.createGroup.callCount, 1);
  t.deepEqual(client.createGroup.firstCall.args, ['custom-devs', 'Custom dev group']);
});

test('migrateGroups handles already-existing group', async t => {
  const client = mockClient({
    createGroup: sinon.stub().rejects(new Error('Group already exists'))
  });
  const groups = [
    { name: 'existing-group', description: 'Already exists' }
  ];

  const result = await migrateGroups(groups, client);

  t.is(result.size, 1);
  t.deepEqual(result.get('existing-group'), { name: 'existing-group' });
});

test('migrateGroups handles creation failure', async t => {
  const client = mockClient({
    createGroup: sinon.stub().rejects(new Error('permission denied'))
  });
  const groups = [
    { name: 'failing-group', description: 'Will fail' }
  ];

  const result = await migrateGroups(groups, client);

  t.is(result.size, 0);
});

test('migrateGroups returns empty map for empty input', async t => {
  const client = mockClient();
  const result = await migrateGroups([], client);

  t.is(result.size, 0);
  t.is(client.createGroup.callCount, 0);
});

test('migrateGroups returns empty map for only system groups', async t => {
  const client = mockClient();
  const groups = [
    { name: 'Anyone' },
    { name: 'sonar-users' },
    { name: 'sonar-administrators' }
  ];

  const result = await migrateGroups(groups, client);

  t.is(result.size, 0);
  t.is(client.createGroup.callCount, 0);
});

// ============================================================================
// permissions.js - migrateGlobalPermissions
// ============================================================================

test('migrateGlobalPermissions adds permissions for each group', async t => {
  const client = mockClient();
  const permissions = [
    { name: 'admins', permissions: ['admin', 'profileadmin'] },
    { name: 'devs', permissions: ['codeviewer'] }
  ];

  await migrateGlobalPermissions(permissions, client);

  t.is(client.addGroupPermission.callCount, 3);
  t.deepEqual(client.addGroupPermission.firstCall.args, ['admins', 'admin']);
  t.deepEqual(client.addGroupPermission.secondCall.args, ['admins', 'profileadmin']);
  t.deepEqual(client.addGroupPermission.thirdCall.args, ['devs', 'codeviewer']);
});

test('migrateGlobalPermissions handles permission failure gracefully', async t => {
  const client = mockClient({
    addGroupPermission: sinon.stub().rejects(new Error('forbidden'))
  });
  const permissions = [
    { name: 'admins', permissions: ['admin'] }
  ];

  // Should not throw
  await t.notThrowsAsync(() => migrateGlobalPermissions(permissions, client));
});

test('migrateGlobalPermissions handles empty permissions', async t => {
  const client = mockClient();
  await migrateGlobalPermissions([], client);

  t.is(client.addGroupPermission.callCount, 0);
});

test('migrateGlobalPermissions handles group with empty permission list', async t => {
  const client = mockClient();
  await migrateGlobalPermissions([{ name: 'group', permissions: [] }], client);

  t.is(client.addGroupPermission.callCount, 0);
});

// ============================================================================
// permissions.js - migrateProjectPermissions
// ============================================================================

test('migrateProjectPermissions adds project-level permissions', async t => {
  const client = mockClient();
  const projectPermissions = [
    { name: 'devs', permissions: ['codeviewer', 'issueadmin'] },
    { name: 'qa', permissions: ['user'] }
  ];

  await migrateProjectPermissions('proj-key', projectPermissions, client);

  t.is(client.addProjectGroupPermission.callCount, 3);
  t.deepEqual(client.addProjectGroupPermission.firstCall.args, ['devs', 'proj-key', 'codeviewer']);
  t.deepEqual(client.addProjectGroupPermission.secondCall.args, ['devs', 'proj-key', 'issueadmin']);
});

test('migrateProjectPermissions handles failure gracefully', async t => {
  const client = mockClient({
    addProjectGroupPermission: sinon.stub().rejects(new Error('fail'))
  });
  const perms = [{ name: 'group', permissions: ['admin'] }];

  await t.notThrowsAsync(() => migrateProjectPermissions('proj', perms, client));
});

test('migrateProjectPermissions handles empty permissions', async t => {
  const client = mockClient();
  await migrateProjectPermissions('proj', [], client);

  t.is(client.addProjectGroupPermission.callCount, 0);
});

// ============================================================================
// permissions.js - migratePermissionTemplates
// ============================================================================

test('migratePermissionTemplates creates templates and applies defaults', async t => {
  const client = mockClient();
  const templateData = {
    templates: [
      {
        id: 'sq-t1',
        name: 'Default Template',
        description: 'Main template',
        projectKeyPattern: '.*',
        permissions: [
          {
            key: 'admin',
            groupsCount: 1,
            groups: ['admins']
          }
        ]
      }
    ],
    defaultTemplates: [
      { templateId: 'sq-t1', qualifier: 'TRK' }
    ]
  };

  const result = await migratePermissionTemplates(templateData, client);

  t.is(result.size, 1);
  t.is(result.get('sq-t1'), 'tpl1');
  t.is(client.createPermissionTemplate.callCount, 1);
  t.deepEqual(client.createPermissionTemplate.firstCall.args, ['Default Template', 'Main template', '.*']);
  t.is(client.addGroupToTemplate.callCount, 1);
  t.deepEqual(client.addGroupToTemplate.firstCall.args, ['tpl1', 'admins', 'admin']);
  t.is(client.setDefaultTemplate.callCount, 1);
  t.deepEqual(client.setDefaultTemplate.firstCall.args, ['tpl1', 'TRK']);
});

test('migratePermissionTemplates handles template creation failure', async t => {
  const client = mockClient({
    createPermissionTemplate: sinon.stub().rejects(new Error('already exists'))
  });
  const templateData = {
    templates: [
      { id: 't1', name: 'Template', description: '', projectKeyPattern: '', permissions: [] }
    ],
    defaultTemplates: []
  };

  const result = await migratePermissionTemplates(templateData, client);

  t.is(result.size, 0);
});

test('migratePermissionTemplates skips permissions with groupsCount <= 0', async t => {
  const client = mockClient();
  const templateData = {
    templates: [
      {
        id: 't1',
        name: 'Template',
        description: '',
        projectKeyPattern: '',
        permissions: [
          { key: 'admin', groupsCount: 0, groups: [] }
        ]
      }
    ],
    defaultTemplates: []
  };

  await migratePermissionTemplates(templateData, client);

  t.is(client.addGroupToTemplate.callCount, 0);
});

test('migratePermissionTemplates skips unmapped default templates', async t => {
  const client = mockClient();
  const templateData = {
    templates: [],
    defaultTemplates: [
      { templateId: 'unmapped-id', qualifier: 'TRK' }
    ]
  };

  await migratePermissionTemplates(templateData, client);

  t.is(client.setDefaultTemplate.callCount, 0);
});

test('migratePermissionTemplates handles setDefault failure gracefully', async t => {
  const client = mockClient({
    setDefaultTemplate: sinon.stub().rejects(new Error('fail'))
  });
  const templateData = {
    templates: [
      { id: 't1', name: 'Template', description: '', projectKeyPattern: '', permissions: [] }
    ],
    defaultTemplates: [
      { templateId: 't1', qualifier: 'TRK' }
    ]
  };

  // Should not throw
  await t.notThrowsAsync(() => migratePermissionTemplates(templateData, client));
});

test('migratePermissionTemplates handles addGroupToTemplate failure gracefully', async t => {
  const client = mockClient({
    addGroupToTemplate: sinon.stub().rejects(new Error('fail'))
  });
  const templateData = {
    templates: [
      {
        id: 't1',
        name: 'Template',
        description: '',
        projectKeyPattern: '',
        permissions: [
          { key: 'admin', groupsCount: 1, groups: ['admins'] }
        ]
      }
    ],
    defaultTemplates: []
  };

  // Should not throw - template still gets created
  const result = await migratePermissionTemplates(templateData, client);
  t.is(result.size, 1);
});

test('migratePermissionTemplates handles empty input', async t => {
  const client = mockClient();
  const result = await migratePermissionTemplates({ templates: [], defaultTemplates: [] }, client);

  t.is(result.size, 0);
  t.is(client.createPermissionTemplate.callCount, 0);
});

// ============================================================================
// project-config.js - migrateProjectSettings
// ============================================================================

test('migrateProjectSettings sets settings with value field', async t => {
  const client = mockClient();
  const settings = [
    { key: 'sonar.coverage.exclusions', value: '**/*.test.js' }
  ];

  await migrateProjectSettings('proj', settings, client);

  t.is(client.setProjectSetting.callCount, 1);
  t.deepEqual(client.setProjectSetting.firstCall.args, ['sonar.coverage.exclusions', '**/*.test.js', 'proj']);
});

test('migrateProjectSettings joins values array', async t => {
  const client = mockClient();
  const settings = [
    { key: 'sonar.exclusions', values: ['**/*.test.js', '**/*.spec.js'] }
  ];

  await migrateProjectSettings('proj', settings, client);

  t.is(client.setProjectSetting.callCount, 1);
  t.is(client.setProjectSetting.firstCall.args[1], '**/*.test.js,**/*.spec.js');
});

test('migrateProjectSettings skips settings with no value', async t => {
  const client = mockClient();
  const settings = [
    { key: 'sonar.empty' },
    { key: 'sonar.empty.values', values: [] }
  ];

  await migrateProjectSettings('proj', settings, client);

  t.is(client.setProjectSetting.callCount, 0);
});

test('migrateProjectSettings handles setting failure gracefully', async t => {
  const client = mockClient({
    setProjectSetting: sinon.stub().rejects(new Error('fail'))
  });
  const settings = [
    { key: 'sonar.setting', value: 'val' }
  ];

  await t.notThrowsAsync(() => migrateProjectSettings('proj', settings, client));
});

test('migrateProjectSettings handles empty settings', async t => {
  const client = mockClient();
  await migrateProjectSettings('proj', [], client);

  t.is(client.setProjectSetting.callCount, 0);
});

// ============================================================================
// project-config.js - migrateProjectTags
// ============================================================================

test('migrateProjectTags sets tags on project', async t => {
  const client = mockClient();
  await migrateProjectTags('proj', ['tag1', 'tag2'], client);

  t.is(client.setProjectTags.callCount, 1);
  t.deepEqual(client.setProjectTags.firstCall.args, ['proj', ['tag1', 'tag2']]);
});

test('migrateProjectTags skips null tags', async t => {
  const client = mockClient();
  await migrateProjectTags('proj', null, client);

  t.is(client.setProjectTags.callCount, 0);
});

test('migrateProjectTags skips empty tags', async t => {
  const client = mockClient();
  await migrateProjectTags('proj', [], client);

  t.is(client.setProjectTags.callCount, 0);
});

test('migrateProjectTags handles failure gracefully', async t => {
  const client = mockClient({
    setProjectTags: sinon.stub().rejects(new Error('fail'))
  });

  await t.notThrowsAsync(() => migrateProjectTags('proj', ['tag1'], client));
});

// ============================================================================
// project-config.js - migrateProjectLinks
// ============================================================================

test('migrateProjectLinks creates links', async t => {
  const client = mockClient();
  const links = [
    { name: 'Homepage', url: 'https://example.com' },
    { name: 'CI', url: 'https://ci.example.com' }
  ];

  await migrateProjectLinks('proj', links, client);

  t.is(client.createProjectLink.callCount, 2);
  t.deepEqual(client.createProjectLink.firstCall.args, ['proj', 'Homepage', 'https://example.com']);
});

test('migrateProjectLinks skips null links', async t => {
  const client = mockClient();
  await migrateProjectLinks('proj', null, client);

  t.is(client.createProjectLink.callCount, 0);
});

test('migrateProjectLinks skips empty links', async t => {
  const client = mockClient();
  await migrateProjectLinks('proj', [], client);

  t.is(client.createProjectLink.callCount, 0);
});

test('migrateProjectLinks handles link creation failure gracefully', async t => {
  const client = mockClient({
    createProjectLink: sinon.stub().rejects(new Error('fail'))
  });
  const links = [{ name: 'Link', url: 'https://example.com' }];

  await t.notThrowsAsync(() => migrateProjectLinks('proj', links, client));
});

// ============================================================================
// project-config.js - migrateNewCodePeriods
// ============================================================================

test('migrateNewCodePeriods sets project-level settings', async t => {
  const client = mockClient();
  const newCodeData = {
    projectLevel: {
      type: 'NUMBER_OF_DAYS',
      settings: [
        { key: 'sonar.leak.period', value: '30' },
        { key: 'sonar.leak.period.type', value: 'days' }
      ]
    },
    branchOverrides: []
  };

  await migrateNewCodePeriods('proj', newCodeData, client);

  t.is(client.setProjectSetting.callCount, 2);
  t.deepEqual(client.setProjectSetting.firstCall.args, ['sonar.leak.period', '30', 'proj']);
});

test('migrateNewCodePeriods falls back to main branch override', async t => {
  const client = mockClient();
  const newCodeData = {
    projectLevel: null,
    branchOverrides: [
      {
        branchKey: 'main',
        type: 'NUMBER_OF_DAYS',
        settings: [{ key: 'sonar.leak.period', value: '14' }]
      }
    ]
  };

  await migrateNewCodePeriods('proj', newCodeData, client);

  t.is(client.setProjectSetting.callCount, 1);
  t.is(client.setProjectSetting.firstCall.args[1], '14');
});

test('migrateNewCodePeriods falls back to master branch override', async t => {
  const client = mockClient();
  const newCodeData = {
    projectLevel: null,
    branchOverrides: [
      {
        branchKey: 'master',
        type: 'PREVIOUS_VERSION',
        settings: [{ key: 'sonar.leak.period', value: 'previous_version' }]
      }
    ]
  };

  await migrateNewCodePeriods('proj', newCodeData, client);

  t.is(client.setProjectSetting.callCount, 1);
});

test('migrateNewCodePeriods falls back to first branch override if no main/master', async t => {
  const client = mockClient();
  const newCodeData = {
    projectLevel: null,
    branchOverrides: [
      {
        branchKey: 'develop',
        type: 'NUMBER_OF_DAYS',
        settings: [{ key: 'sonar.leak.period', value: '7' }]
      }
    ]
  };

  await migrateNewCodePeriods('proj', newCodeData, client);

  t.is(client.setProjectSetting.callCount, 1);
});

test('migrateNewCodePeriods returns skipped for unsupported types', async t => {
  const client = mockClient();
  const newCodeData = {
    projectLevel: { type: 'REFERENCE_BRANCH', settings: null },
    branchOverrides: []
  };

  const result = await migrateNewCodePeriods('proj', newCodeData, client);

  t.truthy(result.skipped);
  t.true(result.detail.includes('unsupported type'));
  t.is(client.setProjectSetting.callCount, 0);
});

test('migrateNewCodePeriods returns early for null data', async t => {
  const client = mockClient();
  const result = await migrateNewCodePeriods('proj', null, client);

  t.is(result, undefined);
  t.is(client.setProjectSetting.callCount, 0);
});

test('migrateNewCodePeriods returns early for empty data', async t => {
  const client = mockClient();
  const result = await migrateNewCodePeriods('proj', { projectLevel: null, branchOverrides: [] }, client);

  t.is(result, undefined);
  t.is(client.setProjectSetting.callCount, 0);
});

test('migrateNewCodePeriods throws on setting failure', async t => {
  const client = mockClient({
    setProjectSetting: sinon.stub().rejects(new Error('API error'))
  });
  const newCodeData = {
    projectLevel: {
      type: 'NUMBER_OF_DAYS',
      settings: [{ key: 'sonar.leak.period', value: '30' }]
    },
    branchOverrides: []
  };

  await t.throwsAsync(
    () => migrateNewCodePeriods('proj', newCodeData, client),
    { message: 'API error' }
  );
});

test('migrateNewCodePeriods prefers project-level over branch override', async t => {
  const client = mockClient();
  const newCodeData = {
    projectLevel: {
      type: 'NUMBER_OF_DAYS',
      settings: [{ key: 'sonar.leak.period', value: '30' }]
    },
    branchOverrides: [
      {
        branchKey: 'main',
        type: 'NUMBER_OF_DAYS',
        settings: [{ key: 'sonar.leak.period', value: '14' }]
      }
    ]
  };

  await migrateNewCodePeriods('proj', newCodeData, client);

  t.is(client.setProjectSetting.firstCall.args[1], '30');
});

// ============================================================================
// project-config.js - migrateDevOpsBinding
// ============================================================================

test('migrateDevOpsBinding sets github binding', async t => {
  const client = mockClient();
  const binding = { alm: 'github', key: 'gh1', repository: 'org/repo', monorepo: false };

  await migrateDevOpsBinding('proj', binding, client);

  t.is(client.setGithubBinding.callCount, 1);
  t.deepEqual(client.setGithubBinding.firstCall.args, ['proj', 'gh1', 'org/repo', false]);
});

test('migrateDevOpsBinding sets gitlab binding', async t => {
  const client = mockClient();
  const binding = { alm: 'gitlab', key: 'gl1', repository: '12345' };

  await migrateDevOpsBinding('proj', binding, client);

  t.is(client.setGitlabBinding.callCount, 1);
  t.deepEqual(client.setGitlabBinding.firstCall.args, ['proj', 'gl1', '12345']);
});

test('migrateDevOpsBinding sets azure binding', async t => {
  const client = mockClient();
  const binding = { alm: 'azure', key: 'az1', repository: 'my-repo', slug: 'my-project' };

  await migrateDevOpsBinding('proj', binding, client);

  t.is(client.setAzureBinding.callCount, 1);
  t.deepEqual(client.setAzureBinding.firstCall.args, ['proj', 'az1', 'my-repo', 'my-project']);
});

test('migrateDevOpsBinding sets bitbucket binding', async t => {
  const client = mockClient();
  const binding = { alm: 'bitbucket', key: 'bb1', repository: 'repo', slug: 'proj' };

  await migrateDevOpsBinding('proj', binding, client);

  t.is(client.setBitbucketBinding.callCount, 1);
  t.deepEqual(client.setBitbucketBinding.firstCall.args, ['proj', 'bb1', 'repo', 'proj']);
});

test('migrateDevOpsBinding sets bitbucketcloud binding', async t => {
  const client = mockClient();
  const binding = { alm: 'bitbucketcloud', key: 'bbc1', repository: 'repo', slug: 'proj' };

  await migrateDevOpsBinding('proj', binding, client);

  t.is(client.setBitbucketBinding.callCount, 1);
});

test('migrateDevOpsBinding handles unknown ALM type gracefully', async t => {
  const client = mockClient();
  const binding = { alm: 'unknown-alm', key: 'x' };

  await t.notThrowsAsync(() => migrateDevOpsBinding('proj', binding, client));

  t.is(client.setGithubBinding.callCount, 0);
  t.is(client.setGitlabBinding.callCount, 0);
  t.is(client.setAzureBinding.callCount, 0);
  t.is(client.setBitbucketBinding.callCount, 0);
});

test('migrateDevOpsBinding returns early for null binding', async t => {
  const client = mockClient();
  await migrateDevOpsBinding('proj', null, client);

  t.is(client.setGithubBinding.callCount, 0);
});

test('migrateDevOpsBinding handles binding failure gracefully', async t => {
  const client = mockClient({
    setGithubBinding: sinon.stub().rejects(new Error('binding failed'))
  });
  const binding = { alm: 'github', key: 'gh1', repository: 'org/repo', monorepo: false };

  await t.notThrowsAsync(() => migrateDevOpsBinding('proj', binding, client));
});

// ============================================================================
// portfolios.js - migratePortfolios
// ============================================================================

test('migratePortfolios creates portfolios and adds projects', async t => {
  const client = mockClient();
  const portfolios = [
    {
      key: 'port1',
      name: 'Portfolio 1',
      description: 'A portfolio',
      visibility: 'private',
      projects: [
        { key: 'proj1' },
        { key: 'proj2' }
      ]
    }
  ];
  const projectKeyMapping = new Map([['proj1', 'sc-proj1']]);

  const result = await migratePortfolios(portfolios, projectKeyMapping, client);

  t.is(result.size, 1);
  t.is(result.get('port1'), 'portfolio-key');
  t.is(client.createPortfolio.callCount, 1);
  t.deepEqual(client.createPortfolio.firstCall.args, ['Portfolio 1', 'A portfolio', 'private', 'port1']);
  t.is(client.addProjectToPortfolio.callCount, 2);
  // proj1 maps to sc-proj1, proj2 has no mapping so uses original key
  t.deepEqual(client.addProjectToPortfolio.firstCall.args, ['portfolio-key', 'sc-proj1']);
  t.deepEqual(client.addProjectToPortfolio.secondCall.args, ['portfolio-key', 'proj2']);
});

test('migratePortfolios handles portfolio creation failure', async t => {
  const client = mockClient({
    createPortfolio: sinon.stub().rejects(new Error('portfolio limit'))
  });
  const portfolios = [
    { key: 'port1', name: 'Portfolio', description: '', visibility: 'public', projects: [] }
  ];

  const result = await migratePortfolios(portfolios, new Map(), client);

  t.is(result.size, 0);
});

test('migratePortfolios handles project addition failure gracefully', async t => {
  const client = mockClient({
    addProjectToPortfolio: sinon.stub().rejects(new Error('project not found'))
  });
  const portfolios = [
    { key: 'port1', name: 'Portfolio', description: '', visibility: 'public', projects: [{ key: 'proj1' }] }
  ];

  const result = await migratePortfolios(portfolios, new Map(), client);

  // Portfolio still gets mapped despite project add failure
  t.is(result.size, 1);
});

test('migratePortfolios returns empty map for empty input', async t => {
  const client = mockClient();
  const result = await migratePortfolios([], new Map(), client);

  t.is(result.size, 0);
  t.is(client.createPortfolio.callCount, 0);
});

test('migratePortfolios uses portfolio.key as fallback when created.key is undefined', async t => {
  const client = mockClient({
    createPortfolio: sinon.stub().resolves({})
  });
  const portfolios = [
    { key: 'port1', name: 'Portfolio', description: '', visibility: 'public', projects: [] }
  ];

  const result = await migratePortfolios(portfolios, new Map(), client);

  t.is(result.get('port1'), 'port1');
});

// ============================================================================
// issue-sync.js - syncIssues
// ============================================================================

test('syncIssues matches issues by rule+component+line and syncs metadata', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 10, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 10,
      status: 'CONFIRMED',
      resolution: null,
      assignee: 'alice',
      comments: [{ login: 'bob', createdAt: '2024-01-01', markdown: 'Fix this' }],
      tags: ['security', 'bug']
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.matched, 1);
  t.is(stats.transitioned, 1);
  t.is(stats.assigned, 1);
  t.is(stats.commented, 1);
  t.is(stats.tagged, 1);
  t.is(stats.failed, 0);
  t.is(client.transitionIssue.firstCall.args[1], 'confirm');
  t.is(client.assignIssue.firstCall.args[1], 'alice');
  t.true(client.addIssueComment.firstCall.args[1].includes('Migrated from SonarQube'));
  t.deepEqual(client.setIssueTags.firstCall.args, ['sc-i1', ['security', 'bug']]);
});

test('syncIssues handles FALSE-POSITIVE resolution', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'RESOLVED',
      resolution: 'FALSE-POSITIVE'
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.transitioned, 1);
  t.is(client.transitionIssue.firstCall.args[1], 'falsepositive');
});

test('syncIssues handles WONTFIX resolution', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'RESOLVED',
      resolution: 'WONTFIX'
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.transitioned, 1);
  t.is(client.transitionIssue.firstCall.args[1], 'wontfix');
});

test('syncIssues handles RESOLVED status', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'RESOLVED',
      resolution: null
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.transitioned, 1);
  t.is(client.transitionIssue.firstCall.args[1], 'resolve');
});

test('syncIssues handles CLOSED status', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'CLOSED',
      resolution: null
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.transitioned, 1);
  t.is(client.transitionIssue.firstCall.args[1], 'resolve');
});

test('syncIssues handles ACCEPTED status', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'ACCEPTED',
      resolution: null
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.transitioned, 1);
  t.is(client.transitionIssue.firstCall.args[1], 'accept');
});

test('syncIssues does not transition when statuses match', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'OPEN',
      resolution: null
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.transitioned, 0);
  t.is(client.transitionIssue.callCount, 0);
});

test('syncIssues does not assign when assignees match', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN', assignee: 'alice' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'OPEN',
      assignee: 'alice'
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.assigned, 0);
  t.is(client.assignIssue.callCount, 0);
});

test('syncIssues does not assign when SQ assignee is null', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'OPEN',
      assignee: null
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.assigned, 0);
});

test('syncIssues skips tags when SQ issue has no tags', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'OPEN',
      tags: []
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.tagged, 0);
  t.is(client.setIssueTags.callCount, 0);
});

test('syncIssues returns zero stats when no matches', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 10, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S9999',
      component: 'proj:src/b.js',
      line: 99,
      status: 'CONFIRMED'
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.matched, 0);
  t.is(stats.transitioned, 0);
});

test('syncIssues returns zero stats for empty SC and SQ issues', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([])
  });

  const stats = await syncIssues('proj', [], client, { concurrency: 1 });

  t.is(stats.matched, 0);
  t.is(stats.transitioned, 0);
  t.is(stats.failed, 0);
});

test('syncIssues handles transition failure gracefully', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ]),
    transitionIssue: sinon.stub().rejects(new Error('transition fail'))
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'CONFIRMED'
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.transitioned, 0);
  // Transition failure is caught internally, not counted as overall failure
  t.is(stats.matched, 1);
});

test('syncIssues handles assign failure gracefully', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ]),
    assignIssue: sinon.stub().rejects(new Error('assign fail'))
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'OPEN',
      assignee: 'alice'
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.assigned, 0);
  t.is(stats.matched, 1);
});

test('syncIssues handles comment failure gracefully', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ]),
    addIssueComment: sinon.stub().rejects(new Error('comment fail'))
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'OPEN',
      comments: [{ login: 'bob', markdown: 'text' }]
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.commented, 0);
});

test('syncIssues handles tags failure gracefully', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ]),
    setIssueTags: sinon.stub().rejects(new Error('tags fail'))
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'OPEN',
      tags: ['tag1']
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.tagged, 0);
});

test('syncIssues uses default concurrency of 5', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([])
  });

  // Call without options to exercise default
  const stats = await syncIssues('proj', [], client);

  t.is(stats.matched, 0);
});

test('syncIssues matches by textRange.startLine when line is absent', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', textRange: { startLine: 15 }, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      textRange: { startLine: 15 },
      status: 'CONFIRMED'
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.matched, 1);
});

test('syncIssues skips issues without rule or component', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: null, component: 'proj:src/a.js', line: 5, status: 'OPEN' },
      { key: 'sc-i2', rule: 'js:S1001', component: '', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    { key: 'sq-i1', rule: null, component: 'proj:src/a.js', line: 5, status: 'CONFIRMED' },
    { key: 'sq-i2', rule: 'js:S1001', component: '', line: 5, status: 'CONFIRMED' }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.matched, 0);
});

test('syncIssues handles multiple SC issues at same location', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' },
      { key: 'sc-i2', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    { key: 'sq-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'CONFIRMED' },
    { key: 'sq-i2', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'CONFIRMED' }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.matched, 2);
});

test('syncIssues does not transition for unmapped status', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'REOPENED',
      resolution: null
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  // REOPENED is not in STATUS_TRANSITION_MAP, so no transition
  t.is(stats.transitioned, 0);
  t.is(client.transitionIssue.callCount, 0);
});

test('syncIssues syncs multiple comments', async t => {
  const client = mockClient({
    searchIssues: sinon.stub().resolves([
      { key: 'sc-i1', rule: 'js:S1001', component: 'proj:src/a.js', line: 5, status: 'OPEN' }
    ])
  });
  const sqIssues = [
    {
      key: 'sq-i1',
      rule: 'js:S1001',
      component: 'proj:src/a.js',
      line: 5,
      status: 'OPEN',
      comments: [
        { login: 'alice', markdown: 'Comment 1' },
        { login: 'bob', markdown: 'Comment 2' },
        { login: 'charlie', htmlText: 'Comment 3' }
      ]
    }
  ];

  const stats = await syncIssues('proj', sqIssues, client, { concurrency: 1 });

  t.is(stats.commented, 3);
  t.is(client.addIssueComment.callCount, 3);
});

// ============================================================================
// hotspot-sync.js - syncHotspots
// ============================================================================

test('syncHotspots matches hotspots and syncs status and comments', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 20, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 20,
      status: 'REVIEWED',
      resolution: 'SAFE',
      comments: [
        { login: 'alice', createdAt: '2024-01-01', markdown: 'Reviewed and safe' }
      ]
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.matched, 1);
  t.is(stats.statusChanged, 1);
  t.is(stats.commented, 1);
  t.is(stats.failed, 0);
  t.deepEqual(client.changeHotspotStatus.firstCall.args, ['sc-h1', 'REVIEWED', 'SAFE']);
  t.true(client.addHotspotComment.firstCall.args[1].includes('Migrated from SonarQube'));
});

test('syncHotspots maps ACKNOWLEDGED resolution when status is not REVIEWED', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'ACKNOWLEDGED',
      resolution: 'ACKNOWLEDGED'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.statusChanged, 1);
  t.deepEqual(client.changeHotspotStatus.firstCall.args, ['sc-h1', 'REVIEWED', 'ACKNOWLEDGED']);
});

test('syncHotspots maps REVIEWED status to SAFE resolution', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'REVIEWED',
      resolution: 'ACKNOWLEDGED'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  // When status is REVIEWED, mapHotspotResolution returns SAFE regardless of resolution field
  t.is(stats.statusChanged, 1);
  t.deepEqual(client.changeHotspotStatus.firstCall.args, ['sc-h1', 'REVIEWED', 'SAFE']);
});

test('syncHotspots maps FIXED resolution when status is not REVIEWED', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'FIXED',
      resolution: 'FIXED'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.statusChanged, 1);
  t.deepEqual(client.changeHotspotStatus.firstCall.args, ['sc-h1', 'REVIEWED', 'FIXED']);
});

test('syncHotspots skips status change when SC is not TO_REVIEW', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'REVIEWED' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'REVIEWED',
      resolution: 'SAFE'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.statusChanged, 0);
  t.is(client.changeHotspotStatus.callCount, 0);
});

test('syncHotspots skips status change when SQ is TO_REVIEW', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'TO_REVIEW',
      resolution: null
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.statusChanged, 0);
});

test('syncHotspots skips status change for unmappable resolution', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  // To get null from mapHotspotResolution, status must not be 'REVIEWED'/'SAFE'
  // and resolution must not be 'ACKNOWLEDGED' or 'FIXED'
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'SOME_OTHER_STATUS',
      resolution: 'UNKNOWN_RESOLUTION'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.statusChanged, 0);
  t.is(client.changeHotspotStatus.callCount, 0);
});

test('syncHotspots returns zero stats when no matches', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/A.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S9999',
      component: 'proj:src/B.java',
      line: 99,
      status: 'REVIEWED',
      resolution: 'SAFE'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.matched, 0);
  t.is(stats.statusChanged, 0);
});

test('syncHotspots returns zero stats for empty inputs', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([])
  });

  const stats = await syncHotspots('proj', [], client, { concurrency: 1 });

  t.is(stats.matched, 0);
  t.is(stats.statusChanged, 0);
  t.is(stats.commented, 0);
  t.is(stats.failed, 0);
});

test('syncHotspots handles status change failure gracefully', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ]),
    changeHotspotStatus: sinon.stub().rejects(new Error('503 Service Unavailable'))
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'REVIEWED',
      resolution: 'SAFE'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.statusChanged, 0);
});

test('syncHotspots handles comment failure gracefully', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ]),
    addHotspotComment: sinon.stub().rejects(new Error('comment fail'))
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'TO_REVIEW',
      comments: [{ login: 'alice', markdown: 'text' }]
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.commented, 0);
});

test('syncHotspots uses default concurrency of 3', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([])
  });

  const stats = await syncHotspots('proj', [], client);

  t.is(stats.matched, 0);
});

test('syncHotspots matches by textRange.startLine when line is absent', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', textRange: { startLine: 25 }, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      textRange: { startLine: 25 },
      status: 'REVIEWED',
      resolution: 'SAFE'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.matched, 1);
});

test('syncHotspots skips hotspots without ruleKey or component', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: '', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: '',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'REVIEWED',
      resolution: 'SAFE'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.matched, 0);
});

test('syncHotspots matches using rule.key fallback', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', rule: { key: 'java:S1234' }, component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      rule: { key: 'java:S1234' },
      component: 'proj:src/Main.java',
      line: 10,
      status: 'REVIEWED',
      resolution: 'SAFE'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.matched, 1);
});

test('syncHotspots matches using securityCategory fallback', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', securityCategory: 'sql-injection', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      securityCategory: 'sql-injection',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'REVIEWED',
      resolution: 'SAFE'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.matched, 1);
});

test('syncHotspots syncs multiple comments', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'TO_REVIEW',
      comments: [
        { login: 'alice', markdown: 'Comment 1' },
        { login: 'bob', htmlText: 'Comment 2' }
      ]
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.commented, 2);
  t.is(client.addHotspotComment.callCount, 2);
});

test('syncHotspots handles multiple hotspots at same location', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' },
      { key: 'sc-h2', ruleKey: 'java:S1234', component: 'proj:src/Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'REVIEWED',
      resolution: 'SAFE'
    },
    {
      key: 'sq-h2',
      ruleKey: 'java:S1234',
      component: 'proj:src/Main.java',
      line: 10,
      status: 'REVIEWED',
      resolution: 'FIXED'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.matched, 2);
  t.is(stats.statusChanged, 2);
});

test('syncHotspots handles component without colon', async t => {
  const client = mockClient({
    searchHotspots: sinon.stub().resolves([
      { key: 'sc-h1', ruleKey: 'java:S1234', component: 'Main.java', line: 10, status: 'TO_REVIEW' }
    ])
  });
  const sqHotspots = [
    {
      key: 'sq-h1',
      ruleKey: 'java:S1234',
      component: 'Main.java',
      line: 10,
      status: 'REVIEWED',
      resolution: 'SAFE'
    }
  ];

  const stats = await syncHotspots('proj', sqHotspots, client, { concurrency: 1 });

  t.is(stats.matched, 1);
});
