import test from 'ava';
import sinon from 'sinon';
import { mapProjectsToOrganizations, mapResourcesToOrganizations } from '../../src/mapping/org-mapper.js';
import { generateMappingCsvs } from '../../src/mapping/csv-generator.js';
import { writeFile, mkdir } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function makeProject(key, name) {
  return { key, name: name || key };
}

function makeBinding(alm, repository, extras = {}) {
  return { alm, repository, ...extras };
}

function makeTargetOrg(key, extras = {}) {
  return { key, ...extras };
}

// ---------------------------------------------------------------------------
// mapProjectsToOrganizations -- single target org
// ---------------------------------------------------------------------------

test('mapProjectsToOrganizations: single org assigns all projects', t => {
  const projects = [makeProject('proj-a'), makeProject('proj-b')];
  const bindings = new Map([
    ['proj-a', makeBinding('github', 'my-org/repo-a')],
    ['proj-b', makeBinding('github', 'my-org/repo-b')]
  ]);
  const targetOrgs = [makeTargetOrg('sc-org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);

  t.is(result.orgAssignments.length, 1);
  t.is(result.orgAssignments[0].org.key, 'sc-org');
  t.is(result.orgAssignments[0].projects.length, 2);
  t.is(result.unboundProjects.length, 0);
});

test('mapProjectsToOrganizations: single org includes unbound projects', t => {
  const projects = [makeProject('proj-a'), makeProject('proj-b')];
  const bindings = new Map([
    ['proj-a', makeBinding('github', 'org/repo')]
  ]);
  const targetOrgs = [makeTargetOrg('sc-org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);

  // Single-org mode: ALL projects go to that org
  t.is(result.orgAssignments[0].projects.length, 2);
  t.is(result.unboundProjects.length, 1);
  t.is(result.unboundProjects[0].key, 'proj-b');
});

test('mapProjectsToOrganizations: single org with no bindings at all', t => {
  const projects = [makeProject('p1'), makeProject('p2')];
  const bindings = new Map();
  const targetOrgs = [makeTargetOrg('only-org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);

  t.is(result.bindingGroups.length, 0);
  t.is(result.unboundProjects.length, 2);
  t.is(result.orgAssignments[0].projects.length, 2);
});

// ---------------------------------------------------------------------------
// mapProjectsToOrganizations -- multiple target orgs
// ---------------------------------------------------------------------------

test('mapProjectsToOrganizations: multi-org assigns by binding group key match', t => {
  const projects = [
    makeProject('proj-a'),
    makeProject('proj-b'),
    makeProject('proj-c')
  ];
  const bindings = new Map([
    ['proj-a', makeBinding('github', 'alpha-team/repo1')],
    ['proj-b', makeBinding('github', 'beta-team/repo2')],
    ['proj-c', makeBinding('github', 'alpha-team/repo3')]
  ]);
  const targetOrgs = [
    makeTargetOrg('alpha-team'),
    makeTargetOrg('beta-team')
  ];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);

  const alphaAssignment = result.orgAssignments.find(a => a.org.key === 'alpha-team');
  const betaAssignment = result.orgAssignments.find(a => a.org.key === 'beta-team');

  // "github:alpha-team" includes "alpha-team" -> matches alpha-team org
  t.is(alphaAssignment.projects.length, 2);
  t.is(betaAssignment.projects.length, 1);
});

test('mapProjectsToOrganizations: multi-org assigns unbound to first org', t => {
  const projects = [makeProject('proj-a'), makeProject('unbound-proj')];
  const bindings = new Map([
    ['proj-a', makeBinding('github', 'team/repo')]
  ]);
  const targetOrgs = [makeTargetOrg('first-org'), makeTargetOrg('second-org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);

  const firstAssignment = result.orgAssignments.find(a => a.org.key === 'first-org');
  // Unbound project lands in first org
  t.true(firstAssignment.projects.some(p => p.key === 'unbound-proj'));
});

test('mapProjectsToOrganizations: multi-org non-matching binding falls to first org', t => {
  const projects = [makeProject('proj-x')];
  const bindings = new Map([
    ['proj-x', makeBinding('github', 'unknown-org/repo')]
  ]);
  const targetOrgs = [makeTargetOrg('org-one'), makeTargetOrg('org-two')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);

  const firstAssignment = result.orgAssignments.find(a => a.org.key === 'org-one');
  t.is(firstAssignment.projects.length, 1);
  t.is(firstAssignment.projects[0].key, 'proj-x');
});

// ---------------------------------------------------------------------------
// Binding group key generation (tested via mapProjectsToOrganizations)
// ---------------------------------------------------------------------------

test('binding group key: GitHub org/repo extracts org', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('github', 'my-github-org/my-repo')]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'github:my-github-org');
});

test('binding group key: GitHub single-part repo uses whole value', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('github', 'monorepo')]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'github:monorepo');
});

test('binding group key: GitLab group/subgroup/project extracts group', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('gitlab', 'team/sub/project')]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'gitlab:team');
});

test('binding group key: GitLab single-part uses whole value', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('gitlab', 'standalone')]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'gitlab:standalone');
});

test('binding group key: Azure uses repository field', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('azure', 'my-az-project')]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'azure:my-az-project');
});

test('binding group key: Azure falls back to slug then default', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('azure', '', { slug: 'az-slug' })]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  // buildBindingGroupKey: for azure, it uses binding.repository || binding.slug || 'default'
  // repository is '' which is falsy, so slug is used
  t.is(result.bindingGroups[0].identifier, 'azure:az-slug');
});

test('binding group key: Azure with no repo or slug uses default', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', { alm: 'azure' }]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'azure:default');
});

test('binding group key: Bitbucket workspace/repo extracts workspace', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('bitbucket', 'workspace/repo', { slug: 'workspace/repo' })]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'bitbucket:workspace');
});

test('binding group key: Bitbucket Cloud workspace/repo extracts workspace', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('bitbucketcloud', '', { slug: 'my-workspace/my-repo' })]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'bitbucket:my-workspace');
});

test('binding group key: unknown ALM uses alm:repo format', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('svn', 'my-svn-repo')]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'svn:my-svn-repo');
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('mapProjectsToOrganizations: empty projects array', t => {
  const result = mapProjectsToOrganizations([], new Map(), [makeTargetOrg('org')]);
  t.is(result.orgAssignments.length, 1);
  t.is(result.orgAssignments[0].projects.length, 0);
  t.is(result.bindingGroups.length, 0);
  t.is(result.unboundProjects.length, 0);
});

test('mapProjectsToOrganizations: projects with same binding group', t => {
  const projects = [makeProject('p1'), makeProject('p2')];
  const bindings = new Map([
    ['p1', makeBinding('github', 'shared-org/repo1')],
    ['p2', makeBinding('github', 'shared-org/repo2')]
  ]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  // Both projects should be in the same binding group
  t.is(result.bindingGroups.length, 1);
  t.is(result.bindingGroups[0].projects.length, 2);
  t.is(result.bindingGroups[0].identifier, 'github:shared-org');
});

test('mapProjectsToOrganizations: binding group stores alm and url', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([
    ['p1', makeBinding('github', 'my-org/repo', { url: 'https://github.com' })]
  ]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].alm, 'github');
  t.is(result.bindingGroups[0].url, 'https://github.com');
});

test('mapProjectsToOrganizations: binding with no url defaults to empty string', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('github', 'org/repo')]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].url, '');
});

// ---------------------------------------------------------------------------
// mapResourcesToOrganizations
// ---------------------------------------------------------------------------

test('mapResourcesToOrganizations: maps quality gates to all orgs', t => {
  const extractedData = {
    qualityGates: [{ name: 'Sonar way' }, { name: 'Custom Gate' }],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [makeProject('p1')] },
    { org: { key: 'org-b' }, projects: [makeProject('p2')] }
  ];

  const result = mapResourcesToOrganizations(extractedData, orgAssignments);

  t.is(result.gatesByOrg.get('org-a').length, 2);
  t.is(result.gatesByOrg.get('org-b').length, 2);
});

test('mapResourcesToOrganizations: maps quality profiles to all orgs', t => {
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [
      { name: 'JS Profile', language: 'js' },
      { name: 'Java Profile', language: 'java' }
    ],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] },
    { org: { key: 'org-b' }, projects: [] }
  ];

  const result = mapResourcesToOrganizations(extractedData, orgAssignments);

  t.is(result.profilesByOrg.get('org-a').length, 2);
  t.is(result.profilesByOrg.get('org-b').length, 2);
});

test('mapResourcesToOrganizations: maps groups to all orgs', t => {
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [{ name: 'developers' }, { name: 'admins' }],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = mapResourcesToOrganizations(extractedData, orgAssignments);

  t.is(result.groupsByOrg.get('org-a').length, 2);
});

test('mapResourcesToOrganizations: maps templates to all orgs', t => {
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [{ name: 'Default template' }] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] },
    { org: { key: 'org-b' }, projects: [] }
  ];

  const result = mapResourcesToOrganizations(extractedData, orgAssignments);

  t.is(result.templatesByOrg.get('org-a').length, 1);
  t.is(result.templatesByOrg.get('org-b').length, 1);
});

test('mapResourcesToOrganizations: maps portfolios by contained projects', t => {
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [
      { key: 'pf1', name: 'Portfolio 1', projects: [{ key: 'p1' }, { key: 'p2' }] },
      { key: 'pf2', name: 'Portfolio 2', projects: [{ key: 'p3' }] }
    ],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [makeProject('p1')] },
    { org: { key: 'org-b' }, projects: [makeProject('p3')] }
  ];

  const result = mapResourcesToOrganizations(extractedData, orgAssignments);

  // Portfolio 1 has p1 which belongs to org-a
  t.is(result.portfoliosByOrg.get('org-a').length, 1);
  t.is(result.portfoliosByOrg.get('org-a')[0].key, 'pf1');
  // Portfolio 2 has p3 which belongs to org-b
  t.is(result.portfoliosByOrg.get('org-b').length, 1);
  t.is(result.portfoliosByOrg.get('org-b')[0].key, 'pf2');
});

test('mapResourcesToOrganizations: portfolio shared across orgs', t => {
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [
      { key: 'pf1', name: 'Shared Portfolio', projects: [{ key: 'p1' }, { key: 'p2' }] }
    ],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [makeProject('p1')] },
    { org: { key: 'org-b' }, projects: [makeProject('p2')] }
  ];

  const result = mapResourcesToOrganizations(extractedData, orgAssignments);

  // Both orgs should get the portfolio since each has a project in it
  t.is(result.portfoliosByOrg.get('org-a').length, 1);
  t.is(result.portfoliosByOrg.get('org-b').length, 1);
});

test('mapResourcesToOrganizations: handles missing optional fields', t => {
  const extractedData = {
    // All optional arrays missing
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [makeProject('p1')] }
  ];

  const result = mapResourcesToOrganizations(extractedData, orgAssignments);

  t.is(result.gatesByOrg.get('org-a').length, 0);
  t.is(result.profilesByOrg.get('org-a').length, 0);
  t.is(result.groupsByOrg.get('org-a').length, 0);
  t.is(result.portfoliosByOrg.get('org-a').length, 0);
  t.is(result.templatesByOrg.get('org-a').length, 0);
});

test('mapResourcesToOrganizations: handles missing permissionTemplates', t => {
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: []
    // permissionTemplates not set at all
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = mapResourcesToOrganizations(extractedData, orgAssignments);
  t.is(result.templatesByOrg.get('org-a').length, 0);
});

test('mapResourcesToOrganizations: empty org assignments', t => {
  const extractedData = {
    qualityGates: [{ name: 'gate' }],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };

  const result = mapResourcesToOrganizations(extractedData, []);
  t.is(result.gatesByOrg.size, 0);
});

// ---------------------------------------------------------------------------
// generateMappingCsvs
// ---------------------------------------------------------------------------

// We stub fs operations since we just want to validate CSV content generation.
// The function writes files via fs, so we intercept writeFile and mkdir.

test.afterEach(() => {
  sinon.restore();
});

test('generateMappingCsvs: generates all seven CSV files', async t => {
  const writtenFiles = new Map();

  // Stub fs module functions used by csv-generator
  // Since csv-generator imports from 'node:fs/promises', we can't easily stub it.
  // Instead, we test by calling the function and checking it doesn't throw,
  // using a temporary directory approach.

  const tmpDir = `/tmp/cloudvoyager-test-csvs-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  // Verify files were created
  const { readdir, readFile } = await import('node:fs/promises');
  const files = await readdir(tmpDir);

  t.true(files.includes('organizations.csv'));
  t.true(files.includes('projects.csv'));
  t.true(files.includes('group-mappings.csv'));
  t.true(files.includes('profile-mappings.csv'));
  t.true(files.includes('gate-mappings.csv'));
  t.true(files.includes('portfolio-mappings.csv'));
  t.true(files.includes('template-mappings.csv'));
  t.is(files.length, 8);

  // Cleanup
  const { rm } = await import('node:fs/promises');
  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: organizations.csv has correct header and rows', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-org-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/organizations.csv`, 'utf-8');
  const lines = content.trim().split('\n');

  t.is(lines[0], 'Include,Target Organization,Binding Group,ALM Platform,Projects Count');
  // Should have header + binding group row + unbound row
  t.true(lines.length >= 2);

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: projects.csv contains project data', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-proj-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/projects.csv`, 'utf-8');
  const lines = content.trim().split('\n');

  t.is(lines[0], 'Include,Project Key,Project Name,Target Organization,ALM Platform,Repository,Monorepo,Visibility,Last Analysis');
  // At least header + project rows
  t.true(lines.length >= 2);
  // Check one project is listed
  t.true(content.includes('proj-a'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: group-mappings.csv contains groups', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-groups-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/group-mappings.csv`, 'utf-8');
  const lines = content.trim().split('\n');

  t.is(lines[0], 'Include,Group Name,Description,Members Count,Is Default,Target Organization');
  t.true(content.includes('developers'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: profile-mappings.csv contains profiles', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-profiles-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/profile-mappings.csv`, 'utf-8');

  t.true(content.includes('Include,Profile Name,Language,Is Default,Is Built-In,Parent,Active Rules,Target Organization'));
  t.true(content.includes('Sonar way'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: gate-mappings.csv contains gates', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-gates-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/gate-mappings.csv`, 'utf-8');

  t.true(content.includes('Include,Gate Name,Is Default,Is Built-In,Condition Metric,Condition Operator,Condition Threshold,Target Organization'));
  t.true(content.includes('Sonar way'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: portfolio-mappings.csv contains portfolios', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-portfolios-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/portfolio-mappings.csv`, 'utf-8');

  t.true(content.includes('Include,Portfolio Key,Portfolio Name,Description,Visibility,Member Project Key,Member Project Name,Target Organization'));
  t.true(content.includes('pf1'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: template-mappings.csv contains templates', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-templates-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/template-mappings.csv`, 'utf-8');

  t.true(content.includes('Include,Template Name,Description,Key Pattern,Permission Key,Group Name,Target Organization'));
  t.true(content.includes('Default Template'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: handles empty resource mappings gracefully', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-empty-csv-${Date.now()}`;
  const mappingData = {
    orgAssignments: [],
    projectBindings: new Map(),
    projectMetadata: new Map(),
    resourceMappings: {}
  };

  await generateMappingCsvs(mappingData, tmpDir);

  const { readdir, rm } = await import('node:fs/promises');
  const files = await readdir(tmpDir);
  t.is(files.length, 8);

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: CSV escaping for values with commas', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-escape-csv-${Date.now()}`;
  const groupsByOrg = new Map([
    ['org-a', [{ name: 'Group, with comma', description: 'Has "quotes" too' }]]
  ]);
  const mappingData = {
    orgAssignments: [],
    projectBindings: new Map(),
    projectMetadata: new Map(),
    resourceMappings: {
      groupsByOrg,
      profilesByOrg: new Map(),
      gatesByOrg: new Map(),
      portfoliosByOrg: new Map(),
      templatesByOrg: new Map()
    }
  };

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/group-mappings.csv`, 'utf-8');

  // Commas in values should be wrapped in quotes
  t.true(content.includes('"Group, with comma"'));
  // Quotes in values should be doubled
  t.true(content.includes('"Has ""quotes"" too"'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: organizations.csv handles unbound projects in org', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-unbound-csv-${Date.now()}`;
  const mappingData = {
    orgAssignments: [
      {
        org: { key: 'my-org' },
        projects: [makeProject('p1'), makeProject('p2')],
        bindingGroups: [] // No binding groups -> both are "unbound"
      }
    ],
    projectBindings: new Map(),
    projectMetadata: new Map(),
    resourceMappings: {
      groupsByOrg: new Map(),
      profilesByOrg: new Map(),
      gatesByOrg: new Map(),
      portfoliosByOrg: new Map(),
      templatesByOrg: new Map()
    }
  };

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/organizations.csv`, 'utf-8');

  t.true(content.includes('(no binding)'));
  t.true(content.includes('none'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: projects.csv uses metadata name when available', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-meta-csv-${Date.now()}`;
  const projectMetadata = new Map([
    ['proj-a', { name: 'Fancy Display Name', visibility: 'private', lastAnalysisDate: '2026-01-15' }]
  ]);
  const projectBindings = new Map([
    ['proj-a', makeBinding('github', 'org/repo', { monorepo: true })]
  ]);
  const mappingData = {
    orgAssignments: [
      {
        org: { key: 'my-org' },
        projects: [makeProject('proj-a')],
        bindingGroups: []
      }
    ],
    projectBindings,
    projectMetadata,
    resourceMappings: {
      groupsByOrg: new Map(),
      profilesByOrg: new Map(),
      gatesByOrg: new Map(),
      portfoliosByOrg: new Map(),
      templatesByOrg: new Map()
    }
  };

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/projects.csv`, 'utf-8');

  t.true(content.includes('Fancy Display Name'));
  t.true(content.includes('private'));
  t.true(content.includes('2026-01-15'));
  t.true(content.includes('true')); // monorepo

  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: build a full mapping data object for CSV generation tests
// ---------------------------------------------------------------------------

function buildFullMappingData() {
  const groupsByOrg = new Map([
    ['sc-org', [{ name: 'developers', description: 'Dev team' }]]
  ]);
  const profilesByOrg = new Map([
    ['sc-org', [
      { name: 'Sonar way', language: 'js', isDefault: true, parentName: '', activeRuleCount: 120 }
    ]]
  ]);
  const gatesByOrg = new Map([
    ['sc-org', [
      { name: 'Sonar way', isDefault: true, isBuiltIn: true, conditions: [{ metric: 'coverage', op: 'LT', error: '80' }] }
    ]]
  ]);
  const portfoliosByOrg = new Map([
    ['sc-org', [
      { key: 'pf1', name: 'Main Portfolio', projects: [{ key: 'proj-a' }], visibility: 'public' }
    ]]
  ]);
  const templatesByOrg = new Map([
    ['sc-org', [
      { name: 'Default Template', description: 'Default permission template', projectKeyPattern: '.*' }
    ]]
  ]);

  const projectBindings = new Map([
    ['proj-a', makeBinding('github', 'my-org/repo-a', { monorepo: false })]
  ]);

  const projectMetadata = new Map([
    ['proj-a', { name: 'Project A', visibility: 'public', lastAnalysisDate: '2026-02-01' }]
  ]);

  return {
    orgAssignments: [
      {
        org: { key: 'sc-org' },
        projects: [makeProject('proj-a', 'Project A'), makeProject('proj-b', 'Project B')],
        bindingGroups: [
          {
            alm: 'github',
            identifier: 'github:my-org',
            url: 'https://github.com',
            projects: [makeProject('proj-a')]
          }
        ]
      }
    ],
    projectBindings,
    projectMetadata,
    resourceMappings: {
      groupsByOrg,
      profilesByOrg,
      gatesByOrg,
      portfoliosByOrg,
      templatesByOrg
    }
  };
}

// ---------------------------------------------------------------------------
// csv-reader: parseCsv tests
// ---------------------------------------------------------------------------

import { parseCsv, parseCsvFile, loadMappingCsvs, isIncluded } from '../../src/mapping/csv-reader.js';
import { applyCsvOverrides } from '../../src/mapping/csv-applier.js';
import { writeFile as fsWriteFile, rm, mkdir as fsMkdir, readdir as fsReaddir } from 'node:fs/promises';
import { join } from 'node:path';

test('parseCsv: empty string returns empty headers and rows', t => {
  const result = parseCsv('');
  t.deepEqual(result.headers, []);
  t.deepEqual(result.rows, []);
});

test('parseCsv: headers only (no data rows) returns headers and empty rows', t => {
  const result = parseCsv('Name,Age,City');
  t.deepEqual(result.headers, ['Name', 'Age', 'City']);
  t.deepEqual(result.rows, []);
});

test('parseCsv: simple CSV with headers and data', t => {
  const csv = 'Name,Age,City\nAlice,30,NYC\nBob,25,LA';
  const result = parseCsv(csv);
  t.deepEqual(result.headers, ['Name', 'Age', 'City']);
  t.is(result.rows.length, 2);
  t.deepEqual(result.rows[0], { Name: 'Alice', Age: '30', City: 'NYC' });
  t.deepEqual(result.rows[1], { Name: 'Bob', Age: '25', City: 'LA' });
});

test('parseCsv: quoted fields with commas inside', t => {
  const csv = 'Name,Description\nAlice,"Has a comma, here"\nBob,"Another, one"';
  const result = parseCsv(csv);
  t.is(result.rows.length, 2);
  t.is(result.rows[0].Description, 'Has a comma, here');
  t.is(result.rows[1].Description, 'Another, one');
});

test('parseCsv: escaped quotes (double-double-quote)', t => {
  const csv = 'Name,Quote\nAlice,"She said ""hello"""\nBob,"A ""quoted"" word"';
  const result = parseCsv(csv);
  t.is(result.rows[0].Quote, 'She said "hello"');
  t.is(result.rows[1].Quote, 'A "quoted" word');
});

test('parseCsv: CRLF line endings', t => {
  const csv = 'A,B\r\n1,2\r\n3,4';
  const result = parseCsv(csv);
  t.deepEqual(result.headers, ['A', 'B']);
  t.is(result.rows.length, 2);
  t.deepEqual(result.rows[0], { A: '1', B: '2' });
  t.deepEqual(result.rows[1], { A: '3', B: '4' });
});

test('parseCsv: CR-only line endings', t => {
  const csv = 'A,B\r1,2\r3,4';
  const result = parseCsv(csv);
  t.deepEqual(result.headers, ['A', 'B']);
  t.is(result.rows.length, 2);
  t.deepEqual(result.rows[0], { A: '1', B: '2' });
  t.deepEqual(result.rows[1], { A: '3', B: '4' });
});

test('parseCsv: empty lines between data are skipped', t => {
  const csv = 'A,B\n1,2\n\n3,4\n';
  const result = parseCsv(csv);
  t.is(result.rows.length, 2);
  t.deepEqual(result.rows[0], { A: '1', B: '2' });
  t.deepEqual(result.rows[1], { A: '3', B: '4' });
});

test('parseCsv: row with fewer fields than headers gets empty strings for missing fields', t => {
  const csv = 'A,B,C\n1';
  const result = parseCsv(csv);
  t.is(result.rows.length, 1);
  t.deepEqual(result.rows[0], { A: '1', B: '', C: '' });
});

// ---------------------------------------------------------------------------
// csv-reader: isIncluded tests
// ---------------------------------------------------------------------------

test('isIncluded: null returns true', t => {
  t.true(isIncluded(null));
});

test('isIncluded: undefined returns true', t => {
  t.true(isIncluded(undefined));
});

test('isIncluded: empty string returns true', t => {
  t.true(isIncluded(''));
});

test('isIncluded: "yes" returns true (case insensitive)', t => {
  t.true(isIncluded('yes'));
  t.true(isIncluded('YES'));
  t.true(isIncluded('Yes'));
});

test('isIncluded: "true" returns true (case insensitive)', t => {
  t.true(isIncluded('true'));
  t.true(isIncluded('TRUE'));
  t.true(isIncluded('True'));
});

test('isIncluded: "1" returns true', t => {
  t.true(isIncluded('1'));
});

test('isIncluded: "no" returns false', t => {
  t.false(isIncluded('no'));
  t.false(isIncluded('NO'));
  t.false(isIncluded('No'));
});

test('isIncluded: "false" returns false', t => {
  t.false(isIncluded('false'));
  t.false(isIncluded('FALSE'));
  t.false(isIncluded('False'));
});

test('isIncluded: "0" returns false', t => {
  t.false(isIncluded('0'));
});

test('isIncluded: "maybe" returns false', t => {
  t.false(isIncluded('maybe'));
});

// ---------------------------------------------------------------------------
// csv-reader: parseCsvFile tests
// ---------------------------------------------------------------------------

test('parseCsvFile: reads and parses a real file', async t => {
  const tmpPath = `/tmp/cloudvoyager-test-parseCsvFile-${Date.now()}.csv`;
  const csvContent = 'Name,Value\nfoo,1\nbar,2';
  await fsWriteFile(tmpPath, csvContent, 'utf-8');

  const result = await parseCsvFile(tmpPath);

  t.deepEqual(result.headers, ['Name', 'Value']);
  t.is(result.rows.length, 2);
  t.deepEqual(result.rows[0], { Name: 'foo', Value: '1' });
  t.deepEqual(result.rows[1], { Name: 'bar', Value: '2' });

  await rm(tmpPath, { force: true });
});

// ---------------------------------------------------------------------------
// csv-reader: loadMappingCsvs tests
// ---------------------------------------------------------------------------

test('loadMappingCsvs: returns empty Map for non-existent directory', async t => {
  const result = await loadMappingCsvs('/tmp/cloudvoyager-nonexistent-dir-' + Date.now());
  t.true(result instanceof Map);
  t.is(result.size, 0);
});

test('loadMappingCsvs: loads multiple CSV files from a directory', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-loadCsvs-${Date.now()}`;
  await fsMkdir(tmpDir, { recursive: true });

  await fsWriteFile(join(tmpDir, 'file1.csv'), 'A,B\n1,2', 'utf-8');
  await fsWriteFile(join(tmpDir, 'file2.csv'), 'X,Y\n3,4\n5,6', 'utf-8');
  // Non-CSV file should be ignored
  await fsWriteFile(join(tmpDir, 'readme.txt'), 'not a csv', 'utf-8');

  const result = await loadMappingCsvs(tmpDir);

  t.is(result.size, 2);
  t.true(result.has('file1.csv'));
  t.true(result.has('file2.csv'));
  t.is(result.get('file1.csv').rows.length, 1);
  t.is(result.get('file2.csv').rows.length, 2);

  await rm(tmpDir, { recursive: true, force: true });
});

test('loadMappingCsvs: skips files that fail to parse', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-loadCsvs-fail-${Date.now()}`;
  await fsMkdir(tmpDir, { recursive: true });

  // Create a valid CSV
  await fsWriteFile(join(tmpDir, 'good.csv'), 'A\n1', 'utf-8');
  // Create a subdirectory named .csv to cause a read error
  await fsMkdir(join(tmpDir, 'bad.csv'), { recursive: true });

  const result = await loadMappingCsvs(tmpDir);

  // Only the good CSV should be loaded; the bad one skipped with a warning
  t.is(result.size, 1);
  t.true(result.has('good.csv'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('loadMappingCsvs: skips CSVs with empty headers or rows', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-loadCsvs-empty-${Date.now()}`;
  await fsMkdir(tmpDir, { recursive: true });

  // CSV with headers only (no data rows)
  await fsWriteFile(join(tmpDir, 'headers-only.csv'), 'A,B,C', 'utf-8');
  // Empty CSV
  await fsWriteFile(join(tmpDir, 'empty.csv'), '', 'utf-8');
  // Valid CSV with data
  await fsWriteFile(join(tmpDir, 'valid.csv'), 'X\n1', 'utf-8');

  const result = await loadMappingCsvs(tmpDir);

  t.is(result.size, 1);
  t.true(result.has('valid.csv'));

  await rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// csv-applier: applyCsvOverrides tests
// ---------------------------------------------------------------------------

test('applyCsvOverrides: no CSVs returns unchanged clone', t => {
  const parsedCsvs = new Map();
  const extractedData = {
    qualityGates: [{ name: 'MyGate', conditions: [] }],
    qualityProfiles: [{ name: 'MyProfile', language: 'js' }],
    groups: [{ name: 'devs' }],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [{ key: 'p1', name: 'P1' }] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // Data should be cloned, not identical reference
  t.not(result.filteredExtractedData, extractedData);
  // But content should be equivalent
  t.deepEqual(result.filteredExtractedData.qualityGates, extractedData.qualityGates);
  t.deepEqual(result.filteredExtractedData.qualityProfiles, extractedData.qualityProfiles);
  t.deepEqual(result.filteredExtractedData.groups, extractedData.groups);
  // Assignments should be cloned too
  t.is(result.filteredOrgAssignments.length, 1);
  t.is(result.filteredOrgAssignments[0].projects.length, 1);
});

test('applyCsvOverrides: projects.csv filters out excluded projects', t => {
  const parsedCsvs = new Map([
    ['projects.csv', {
      headers: ['Include', 'Project Key', 'Project Name'],
      rows: [
        { Include: 'yes', 'Project Key': 'proj-a', 'Project Name': 'A' },
        { Include: 'no', 'Project Key': 'proj-b', 'Project Name': 'B' },
        { Include: '1', 'Project Key': 'proj-c', 'Project Name': 'C' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    {
      org: { key: 'org-a' },
      projects: [
        { key: 'proj-a', name: 'A' },
        { key: 'proj-b', name: 'B' },
        { key: 'proj-c', name: 'C' }
      ]
    }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredOrgAssignments[0].projects.length, 2);
  const keys = result.filteredOrgAssignments[0].projects.map(p => p.key);
  t.true(keys.includes('proj-a'));
  t.true(keys.includes('proj-c'));
  t.false(keys.includes('proj-b'));
});

test('applyCsvOverrides: gate-mappings.csv excludes entire gates', t => {
  const parsedCsvs = new Map([
    ['gate-mappings.csv', {
      headers: ['Include', 'Gate Name', 'Condition Metric', 'Condition Operator', 'Condition Threshold'],
      rows: [
        // Header row for KeepGate (include, no Condition Metric)
        { Include: 'yes', 'Gate Name': 'KeepGate', 'Condition Metric': '', 'Condition Operator': '', 'Condition Threshold': '' },
        { Include: 'yes', 'Gate Name': 'KeepGate', 'Condition Metric': 'coverage', 'Condition Operator': 'LT', 'Condition Threshold': '80' },
        // Header row for DropGate (excluded)
        { Include: 'no', 'Gate Name': 'DropGate', 'Condition Metric': '', 'Condition Operator': '', 'Condition Threshold': '' },
        { Include: 'yes', 'Gate Name': 'DropGate', 'Condition Metric': 'bugs', 'Condition Operator': 'GT', 'Condition Threshold': '0' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [
      { name: 'KeepGate', conditions: [{ metric: 'coverage', op: 'LT', error: '80' }] },
      { name: 'DropGate', conditions: [{ metric: 'bugs', op: 'GT', error: '0' }] }
    ],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.qualityGates.length, 1);
  t.is(result.filteredExtractedData.qualityGates[0].name, 'KeepGate');
});

test('applyCsvOverrides: gate-mappings.csv modifies gate conditions', t => {
  const parsedCsvs = new Map([
    ['gate-mappings.csv', {
      headers: ['Include', 'Gate Name', 'Condition Metric', 'Condition Operator', 'Condition Threshold'],
      rows: [
        // Header row for gate
        { Include: 'yes', 'Gate Name': 'MyGate', 'Condition Metric': '', 'Condition Operator': '', 'Condition Threshold': '' },
        // Keep coverage condition
        { Include: 'yes', 'Gate Name': 'MyGate', 'Condition Metric': 'coverage', 'Condition Operator': 'LT', 'Condition Threshold': '90' },
        // Exclude bugs condition
        { Include: 'no', 'Gate Name': 'MyGate', 'Condition Metric': 'bugs', 'Condition Operator': 'GT', 'Condition Threshold': '0' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [
      { name: 'MyGate', conditions: [
        { metric: 'coverage', op: 'LT', error: '80' },
        { metric: 'bugs', op: 'GT', error: '0' }
      ]}
    ],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  const gate = result.filteredExtractedData.qualityGates[0];
  t.is(gate.name, 'MyGate');
  t.is(gate.conditions.length, 1);
  t.is(gate.conditions[0].metric, 'coverage');
  t.is(gate.conditions[0].error, '90'); // threshold updated from CSV
});

test('applyCsvOverrides: gate-mappings.csv keeps gates not listed in CSV as-is', t => {
  const parsedCsvs = new Map([
    ['gate-mappings.csv', {
      headers: ['Include', 'Gate Name', 'Condition Metric', 'Condition Operator', 'Condition Threshold'],
      rows: [
        { Include: 'no', 'Gate Name': 'DropGate', 'Condition Metric': '', 'Condition Operator': '', 'Condition Threshold': '' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [
      { name: 'UnlistedGate', conditions: [{ metric: 'coverage', op: 'LT', error: '80' }] },
      { name: 'DropGate', conditions: [] }
    ],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.qualityGates.length, 1);
  t.is(result.filteredExtractedData.qualityGates[0].name, 'UnlistedGate');
});

test('applyCsvOverrides: gate-mappings.csv handles null qualityGates', t => {
  const parsedCsvs = new Map([
    ['gate-mappings.csv', {
      headers: ['Include', 'Gate Name'],
      rows: []
    }]
  ]);
  const extractedData = {
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.qualityGates, undefined);
});

test('applyCsvOverrides: profile-mappings.csv excludes profiles', t => {
  const parsedCsvs = new Map([
    ['profile-mappings.csv', {
      headers: ['Include', 'Profile Name', 'Language'],
      rows: [
        { Include: 'yes', 'Profile Name': 'Sonar way', Language: 'js' },
        { Include: 'no', 'Profile Name': 'Custom Profile', Language: 'java' },
        { Include: 'yes', 'Profile Name': 'Another Profile', Language: 'py' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [
      { name: 'Sonar way', language: 'js' },
      { name: 'Custom Profile', language: 'java' },
      { name: 'Another Profile', language: 'py' }
    ],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.qualityProfiles.length, 2);
  const names = result.filteredExtractedData.qualityProfiles.map(p => p.name);
  t.true(names.includes('Sonar way'));
  t.true(names.includes('Another Profile'));
  t.false(names.includes('Custom Profile'));
});

test('applyCsvOverrides: profile-mappings.csv handles null qualityProfiles', t => {
  const parsedCsvs = new Map([
    ['profile-mappings.csv', {
      headers: ['Include', 'Profile Name', 'Language'],
      rows: [{ Include: 'no', 'Profile Name': 'X', Language: 'js' }]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.qualityProfiles, undefined);
});

test('applyCsvOverrides: profile-mappings.csv with all included returns unchanged profiles', t => {
  const parsedCsvs = new Map([
    ['profile-mappings.csv', {
      headers: ['Include', 'Profile Name', 'Language'],
      rows: [
        { Include: 'yes', 'Profile Name': 'Sonar way', Language: 'js' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [
      { name: 'Sonar way', language: 'js' }
    ],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // No exclusions, so profiles stay the same
  t.is(result.filteredExtractedData.qualityProfiles.length, 1);
});

test('applyCsvOverrides: group-mappings.csv excludes groups', t => {
  const parsedCsvs = new Map([
    ['group-mappings.csv', {
      headers: ['Include', 'Group Name'],
      rows: [
        { Include: 'yes', 'Group Name': 'developers' },
        { Include: 'no', 'Group Name': 'temporary-group' },
        { Include: '1', 'Group Name': 'admins' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [
      { name: 'developers' },
      { name: 'temporary-group' },
      { name: 'admins' }
    ],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.groups.length, 2);
  const names = result.filteredExtractedData.groups.map(g => g.name);
  t.true(names.includes('developers'));
  t.true(names.includes('admins'));
  t.false(names.includes('temporary-group'));
});

test('applyCsvOverrides: group-mappings.csv handles null groups', t => {
  const parsedCsvs = new Map([
    ['group-mappings.csv', {
      headers: ['Include', 'Group Name'],
      rows: [{ Include: 'no', 'Group Name': 'x' }]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.groups, undefined);
});

test('applyCsvOverrides: group-mappings.csv with all included returns unchanged groups', t => {
  const parsedCsvs = new Map([
    ['group-mappings.csv', {
      headers: ['Include', 'Group Name'],
      rows: [
        { Include: 'yes', 'Group Name': 'developers' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [{ name: 'developers' }],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.groups.length, 1);
});

test('applyCsvOverrides: global-permissions.csv excludes permissions', t => {
  const parsedCsvs = new Map([
    ['global-permissions.csv', {
      headers: ['Include', 'Group Name', 'Permission'],
      rows: [
        { Include: 'yes', 'Group Name': 'developers', Permission: 'scan' },
        { Include: 'no', 'Group Name': 'developers', Permission: 'admin' },
        { Include: 'yes', 'Group Name': 'admins', Permission: 'admin' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    globalPermissions: [
      { name: 'developers', permissions: ['scan', 'admin'] },
      { name: 'admins', permissions: ['admin'] }
    ],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // developers should only have 'scan' (admin excluded)
  const devs = result.filteredExtractedData.globalPermissions.find(g => g.name === 'developers');
  t.deepEqual(devs.permissions, ['scan']);
  // admins still has 'admin'
  const admins = result.filteredExtractedData.globalPermissions.find(g => g.name === 'admins');
  t.deepEqual(admins.permissions, ['admin']);
});

test('applyCsvOverrides: global-permissions.csv removes groups with all permissions excluded', t => {
  const parsedCsvs = new Map([
    ['global-permissions.csv', {
      headers: ['Include', 'Group Name', 'Permission'],
      rows: [
        { Include: 'no', 'Group Name': 'temp-group', Permission: 'scan' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    globalPermissions: [
      { name: 'temp-group', permissions: ['scan'] }
    ],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // Group with all permissions removed should be filtered out entirely
  t.is(result.filteredExtractedData.globalPermissions.length, 0);
});

test('applyCsvOverrides: global-permissions.csv handles null globalPermissions', t => {
  const parsedCsvs = new Map([
    ['global-permissions.csv', {
      headers: ['Include', 'Group Name', 'Permission'],
      rows: [{ Include: 'no', 'Group Name': 'x', Permission: 'scan' }]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.globalPermissions, undefined);
});

test('applyCsvOverrides: global-permissions.csv with all included returns unchanged permissions', t => {
  const parsedCsvs = new Map([
    ['global-permissions.csv', {
      headers: ['Include', 'Group Name', 'Permission'],
      rows: [
        { Include: 'yes', 'Group Name': 'devs', Permission: 'scan' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    globalPermissions: [
      { name: 'devs', permissions: ['scan'] }
    ],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.globalPermissions.length, 1);
  t.deepEqual(result.filteredExtractedData.globalPermissions[0].permissions, ['scan']);
});

test('applyCsvOverrides: template-mappings.csv excludes templates and rebuilds permissions', t => {
  const parsedCsvs = new Map([
    ['template-mappings.csv', {
      headers: ['Include', 'Template Name', 'Description', 'Key Pattern', 'Permission Key', 'Group Name'],
      rows: [
        // KeepTemplate header row (include)
        { Include: 'yes', 'Template Name': 'KeepTemplate', Description: 'keep', 'Key Pattern': '.*', 'Permission Key': '', 'Group Name': '' },
        // KeepTemplate permission rows
        { Include: 'yes', 'Template Name': 'KeepTemplate', Description: '', 'Key Pattern': '', 'Permission Key': 'scan', 'Group Name': 'developers' },
        { Include: 'no', 'Template Name': 'KeepTemplate', Description: '', 'Key Pattern': '', 'Permission Key': 'admin', 'Group Name': 'admins' },
        // DropTemplate header row (excluded)
        { Include: 'no', 'Template Name': 'DropTemplate', Description: 'drop', 'Key Pattern': '', 'Permission Key': '', 'Group Name': '' },
        { Include: 'yes', 'Template Name': 'DropTemplate', Description: '', 'Key Pattern': '', 'Permission Key': 'scan', 'Group Name': 'devs' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: {
      templates: [
        { name: 'KeepTemplate', id: 'tmpl-1', description: 'keep', projectKeyPattern: '.*', permissions: [
          { key: 'scan', groupsCount: 1, groups: ['developers'] },
          { key: 'admin', groupsCount: 1, groups: ['admins'] }
        ]},
        { name: 'DropTemplate', id: 'tmpl-2', description: 'drop', projectKeyPattern: '', permissions: [
          { key: 'scan', groupsCount: 1, groups: ['devs'] }
        ]}
      ],
      defaultTemplates: [
        { templateId: 'tmpl-1', qualifier: 'TRK' },
        { templateId: 'tmpl-2', qualifier: 'VW' }
      ]
    }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // DropTemplate should be excluded
  t.is(result.filteredExtractedData.permissionTemplates.templates.length, 1);
  const kept = result.filteredExtractedData.permissionTemplates.templates[0];
  t.is(kept.name, 'KeepTemplate');
  // admin permission was excluded, only scan remains
  t.is(kept.permissions.length, 1);
  t.is(kept.permissions[0].key, 'scan');
  t.deepEqual(kept.permissions[0].groups, ['developers']);
  // defaultTemplates: DropTemplate's default should be removed
  t.is(result.filteredExtractedData.permissionTemplates.defaultTemplates.length, 1);
  t.is(result.filteredExtractedData.permissionTemplates.defaultTemplates[0].templateId, 'tmpl-1');
});

test('applyCsvOverrides: template-mappings.csv handles null permissionTemplates', t => {
  const parsedCsvs = new Map([
    ['template-mappings.csv', {
      headers: ['Include', 'Template Name', 'Permission Key', 'Group Name'],
      rows: [{ Include: 'no', 'Template Name': 'X', 'Permission Key': '', 'Group Name': '' }]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: []
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.permissionTemplates, undefined);
});

test('applyCsvOverrides: template-mappings.csv keeps templates not listed in CSV', t => {
  const parsedCsvs = new Map([
    ['template-mappings.csv', {
      headers: ['Include', 'Template Name', 'Permission Key', 'Group Name'],
      rows: [
        { Include: 'no', 'Template Name': 'DropThis', 'Permission Key': '', 'Group Name': '' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: {
      templates: [
        { name: 'UnlistedTemplate', id: 'tmpl-u', permissions: [] },
        { name: 'DropThis', id: 'tmpl-d', permissions: [] }
      ],
      defaultTemplates: []
    }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.permissionTemplates.templates.length, 1);
  t.is(result.filteredExtractedData.permissionTemplates.templates[0].name, 'UnlistedTemplate');
});

test('applyCsvOverrides: portfolio-mappings.csv excludes portfolios and rebuilds members', t => {
  const parsedCsvs = new Map([
    ['portfolio-mappings.csv', {
      headers: ['Include', 'Portfolio Key', 'Portfolio Name', 'Member Project Key', 'Member Project Name'],
      rows: [
        // KeepPortfolio header row (no Member Project Key)
        { Include: 'yes', 'Portfolio Key': 'pf-keep', 'Portfolio Name': 'Keep', 'Member Project Key': '', 'Member Project Name': '' },
        // Member rows
        { Include: 'yes', 'Portfolio Key': 'pf-keep', 'Portfolio Name': 'Keep', 'Member Project Key': 'proj-a', 'Member Project Name': 'A' },
        { Include: 'no', 'Portfolio Key': 'pf-keep', 'Portfolio Name': 'Keep', 'Member Project Key': 'proj-b', 'Member Project Name': 'B' },
        // DropPortfolio header row (excluded)
        { Include: 'no', 'Portfolio Key': 'pf-drop', 'Portfolio Name': 'Drop', 'Member Project Key': '', 'Member Project Name': '' },
        { Include: 'yes', 'Portfolio Key': 'pf-drop', 'Portfolio Name': 'Drop', 'Member Project Key': 'proj-c', 'Member Project Name': 'C' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [
      { key: 'pf-keep', name: 'Keep', projects: [{ key: 'proj-a' }, { key: 'proj-b' }] },
      { key: 'pf-drop', name: 'Drop', projects: [{ key: 'proj-c' }] }
    ],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [{ key: 'proj-a', name: 'A' }] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // DropPortfolio should be excluded
  t.is(result.filteredExtractedData.portfolios.length, 1);
  const kept = result.filteredExtractedData.portfolios[0];
  t.is(kept.key, 'pf-keep');
  // Only proj-a should remain (proj-b excluded)
  t.is(kept.projects.length, 1);
  t.is(kept.projects[0].key, 'proj-a');
});

test('applyCsvOverrides: portfolio-mappings.csv handles null portfolios', t => {
  const parsedCsvs = new Map([
    ['portfolio-mappings.csv', {
      headers: ['Include', 'Portfolio Key', 'Member Project Key'],
      rows: [{ Include: 'no', 'Portfolio Key': 'x', 'Member Project Key': '' }]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.portfolios, undefined);
});

test('applyCsvOverrides: portfolio-mappings.csv keeps portfolios not listed in CSV', t => {
  const parsedCsvs = new Map([
    ['portfolio-mappings.csv', {
      headers: ['Include', 'Portfolio Key', 'Member Project Key', 'Member Project Name'],
      rows: [
        { Include: 'no', 'Portfolio Key': 'pf-drop', 'Member Project Key': '', 'Member Project Name': '' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [
      { key: 'pf-unlisted', name: 'Unlisted', projects: [{ key: 'p1' }] },
      { key: 'pf-drop', name: 'Drop', projects: [] }
    ],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [{ key: 'p1', name: 'P1' }] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  t.is(result.filteredExtractedData.portfolios.length, 1);
  t.is(result.filteredExtractedData.portfolios[0].key, 'pf-unlisted');
});

test('applyCsvOverrides: multiple CSVs applied together', t => {
  const parsedCsvs = new Map([
    ['projects.csv', {
      headers: ['Include', 'Project Key', 'Project Name'],
      rows: [
        { Include: 'yes', 'Project Key': 'proj-a', 'Project Name': 'A' },
        { Include: 'no', 'Project Key': 'proj-b', 'Project Name': 'B' }
      ]
    }],
    ['group-mappings.csv', {
      headers: ['Include', 'Group Name'],
      rows: [
        { Include: 'yes', 'Group Name': 'keepers' },
        { Include: 'no', 'Group Name': 'droppers' }
      ]
    }],
    ['gate-mappings.csv', {
      headers: ['Include', 'Gate Name', 'Condition Metric', 'Condition Operator', 'Condition Threshold'],
      rows: [
        { Include: 'no', 'Gate Name': 'OldGate', 'Condition Metric': '', 'Condition Operator': '', 'Condition Threshold': '' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [
      { name: 'OldGate', conditions: [] },
      { name: 'NewGate', conditions: [] }
    ],
    qualityProfiles: [],
    groups: [
      { name: 'keepers' },
      { name: 'droppers' }
    ],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    {
      org: { key: 'org-a' },
      projects: [
        { key: 'proj-a', name: 'A' },
        { key: 'proj-b', name: 'B' }
      ]
    }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // Projects: proj-b excluded
  t.is(result.filteredOrgAssignments[0].projects.length, 1);
  t.is(result.filteredOrgAssignments[0].projects[0].key, 'proj-a');
  // Groups: droppers excluded
  t.is(result.filteredExtractedData.groups.length, 1);
  t.is(result.filteredExtractedData.groups[0].name, 'keepers');
  // Gates: OldGate excluded, NewGate kept
  t.is(result.filteredExtractedData.qualityGates.length, 1);
  t.is(result.filteredExtractedData.qualityGates[0].name, 'NewGate');
});

test('applyCsvOverrides: does not mutate original extractedData', t => {
  const parsedCsvs = new Map([
    ['group-mappings.csv', {
      headers: ['Include', 'Group Name'],
      rows: [
        { Include: 'no', 'Group Name': 'to-remove' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [
      { name: 'to-remove' },
      { name: 'to-keep' }
    ],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // Original should still have both groups
  t.is(extractedData.groups.length, 2);
  // Filtered should have only one
  t.is(result.filteredExtractedData.groups.length, 1);
});

test('applyCsvOverrides: does not mutate original orgAssignments', t => {
  const parsedCsvs = new Map([
    ['projects.csv', {
      headers: ['Include', 'Project Key'],
      rows: [
        { Include: 'no', 'Project Key': 'proj-x' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [{ key: 'proj-x', name: 'X' }, { key: 'proj-y', name: 'Y' }] }
  ];

  applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // Original should still have both projects
  t.is(orgAssignments[0].projects.length, 2);
});

test('applyCsvOverrides: projects.csv with all included does not filter projects', t => {
  const parsedCsvs = new Map([
    ['projects.csv', {
      headers: ['Include', 'Project Key'],
      rows: [
        { Include: 'yes', 'Project Key': 'p1' },
        { Include: '', 'Project Key': 'p2' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [{ key: 'p1', name: 'P1' }, { key: 'p2', name: 'P2' }] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // No exclusions
  t.is(result.filteredOrgAssignments[0].projects.length, 2);
});

test('applyCsvOverrides: template-mappings.csv with multiple groups per permission', t => {
  const parsedCsvs = new Map([
    ['template-mappings.csv', {
      headers: ['Include', 'Template Name', 'Permission Key', 'Group Name'],
      rows: [
        // Header row
        { Include: 'yes', 'Template Name': 'MyTemplate', 'Permission Key': '', 'Group Name': '' },
        // Two groups for the same permission key
        { Include: 'yes', 'Template Name': 'MyTemplate', 'Permission Key': 'scan', 'Group Name': 'devs' },
        { Include: 'yes', 'Template Name': 'MyTemplate', 'Permission Key': 'scan', 'Group Name': 'admins' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: {
      templates: [
        { name: 'MyTemplate', id: 'tmpl-1', permissions: [
          { key: 'scan', groupsCount: 2, groups: ['devs', 'admins'] }
        ]}
      ],
      defaultTemplates: []
    }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  const tmpl = result.filteredExtractedData.permissionTemplates.templates[0];
  t.is(tmpl.permissions.length, 1);
  t.is(tmpl.permissions[0].key, 'scan');
  t.is(tmpl.permissions[0].groupsCount, 2);
  t.deepEqual(tmpl.permissions[0].groups, ['devs', 'admins']);
});

// ---------------------------------------------------------------------------
// csv-tables.js: direct unit tests for generateTemplateMappingsCsv and
// generateGlobalPermissionsCsv (covers uncovered lines 93-100 and 112-117)
// ---------------------------------------------------------------------------

import {
  generateTemplateMappingsCsv,
  generateGlobalPermissionsCsv
} from '../../src/mapping/csv-tables.js';

test('generateTemplateMappingsCsv: includes permission group rows (lines 93-100)', t => {
  const data = {
    resourceMappings: {
      templatesByOrg: new Map([
        ['org-a', [
          {
            name: 'My Template',
            description: 'A template',
            projectKeyPattern: '.*',
            permissions: [
              { key: 'scan', groups: ['developers', 'qa-team'] },
              { key: 'admin', groups: ['admins'] }
            ]
          }
        ]]
      ])
    }
  };

  const csv = generateTemplateMappingsCsv(data);
  const lines = csv.trim().split('\n');

  // Header + 1 template header row + 3 permission-group rows = 5 lines total
  t.is(lines.length, 5);
  // First line is the CSV header
  t.true(lines[0].includes('Include,Template Name'));
  // Template header row (empty Permission Key and Group Name)
  t.true(lines[1].includes('My Template'));
  // Permission group rows
  t.true(csv.includes('scan,developers,org-a'));
  t.true(csv.includes('scan,qa-team,org-a'));
  t.true(csv.includes('admin,admins,org-a'));
});

test('generateTemplateMappingsCsv: template with permissions but no groups', t => {
  const data = {
    resourceMappings: {
      templatesByOrg: new Map([
        ['org-b', [
          {
            name: 'No Groups Template',
            permissions: [
              { key: 'scan' }  // no groups property
            ]
          }
        ]]
      ])
    }
  };

  const csv = generateTemplateMappingsCsv(data);
  const lines = csv.trim().split('\n');

  // Header + 1 template header row = 2 lines (no group rows because groups is undefined)
  t.is(lines.length, 2);
});

test('generateTemplateMappingsCsv: multiple templates with mixed permissions', t => {
  const data = {
    resourceMappings: {
      templatesByOrg: new Map([
        ['org-c', [
          {
            name: 'Template A',
            permissions: [
              { key: 'scan', groups: ['devs'] }
            ]
          },
          {
            name: 'Template B',
            permissions: [
              { key: 'admin', groups: ['admins', 'super-admins'] },
              { key: 'codeviewer', groups: ['viewers'] }
            ]
          }
        ]]
      ])
    }
  };

  const csv = generateTemplateMappingsCsv(data);

  // Template A: 1 header + 1 group row
  // Template B: 1 header + 2 + 1 group rows
  // Total: header + 2 template headers + 4 group rows = 7
  const lines = csv.trim().split('\n');
  t.is(lines.length, 7);
  t.true(csv.includes('scan,devs,org-c'));
  t.true(csv.includes('admin,admins,org-c'));
  t.true(csv.includes('admin,super-admins,org-c'));
  t.true(csv.includes('codeviewer,viewers,org-c'));
});

test('generateGlobalPermissionsCsv: generates rows for groups with permissions (lines 112-117)', t => {
  const data = {
    extractedData: {
      globalPermissions: [
        { name: 'developers', permissions: ['scan', 'provisioning'] },
        { name: 'admins', permissions: ['admin'] }
      ]
    }
  };

  const csv = generateGlobalPermissionsCsv(data);
  const lines = csv.trim().split('\n');

  // Header + 3 permission rows = 4 lines
  t.is(lines.length, 4);
  t.true(lines[0].includes('Include,Group Name,Permission'));
  t.true(csv.includes('yes,developers,scan'));
  t.true(csv.includes('yes,developers,provisioning'));
  t.true(csv.includes('yes,admins,admin'));
});

test('generateGlobalPermissionsCsv: handles groups without permissions property', t => {
  const data = {
    extractedData: {
      globalPermissions: [
        { name: 'empty-group' }  // no permissions property
      ]
    }
  };

  const csv = generateGlobalPermissionsCsv(data);
  const lines = csv.trim().split('\n');

  // Only the header line
  t.is(lines.length, 1);
});

test('generateGlobalPermissionsCsv: handles empty globalPermissions array', t => {
  const data = {
    extractedData: {
      globalPermissions: []
    }
  };

  const csv = generateGlobalPermissionsCsv(data);
  const lines = csv.trim().split('\n');

  // Only header
  t.is(lines.length, 1);
});

test('generateGlobalPermissionsCsv: handles missing extractedData.globalPermissions', t => {
  const data = {
    extractedData: {}
  };

  const csv = generateGlobalPermissionsCsv(data);
  const lines = csv.trim().split('\n');

  // Only header (falls back to empty array)
  t.is(lines.length, 1);
});

// ---------------------------------------------------------------------------
// csv-tables.js: branch coverage for || fallback operands (lines 20, 35, 70)
// When left side of || is truthy, the fallback should not be used
// ---------------------------------------------------------------------------

import {
  generateGroupMappingsCsv,
  generateProfileMappingsCsv,
  generateGateMappingsCsv,
  generatePortfolioMappingsCsv
} from '../../src/mapping/csv-tables.js';

// Line 20: group.description, group.membersCount, group.default — truthy values
test('generateGroupMappingsCsv: uses truthy description, membersCount, default without fallback', t => {
  const data = {
    resourceMappings: {
      groupsByOrg: new Map([
        ['org-a', [
          { name: 'devs', description: 'Developer team', membersCount: 15, default: true }
        ]]
      ])
    }
  };

  const csv = generateGroupMappingsCsv(data);
  t.true(csv.includes('Developer team'));
  t.true(csv.includes('15'));
  t.true(csv.includes('true'));
});

// Line 35: profile.parentName, profile.activeRuleCount — truthy values
test('generateProfileMappingsCsv: uses truthy parentName and activeRuleCount without fallback', t => {
  const data = {
    resourceMappings: {
      profilesByOrg: new Map([
        ['org-a', [
          { name: 'Custom', language: 'java', isDefault: false, isBuiltIn: false, parentName: 'Sonar way', activeRuleCount: 250 }
        ]]
      ])
    }
  };

  const csv = generateProfileMappingsCsv(data);
  t.true(csv.includes('Sonar way'));
  t.true(csv.includes('250'));
});

// Line 70: portfolio.description, portfolio.visibility — truthy values
test('generatePortfolioMappingsCsv: uses truthy description and visibility without fallback', t => {
  const data = {
    resourceMappings: {
      portfoliosByOrg: new Map([
        ['org-b', [
          { key: 'pf1', name: 'Portfolio', description: 'My Portfolio Description', visibility: 'private', projects: [{ key: 'p1', name: 'P1' }] }
        ]]
      ])
    }
  };

  const csv = generatePortfolioMappingsCsv(data);
  t.true(csv.includes('My Portfolio Description'));
  t.true(csv.includes('private'));
});

// ---------------------------------------------------------------------------
// csv-generator.js line 58: meta.name || project.name || project.key fallback
// When meta has no name, should fall back to project.name, then project.key
// ---------------------------------------------------------------------------

test('generateMappingCsvs: falls back to project.name when meta.name is empty', async t => {
  const { randomUUID: uuid } = await import('node:crypto');
  const tmpDir = `/tmp/cloudvoyager-test-csvgen-fallback-${uuid()}`;

  const mappingData = {
    orgAssignments: [
      {
        org: { key: 'sc-org' },
        projects: [
          makeProject('proj-no-meta-name', 'Fallback Name'),
          makeProject('proj-no-meta-no-name', undefined)
        ],
        bindingGroups: []
      }
    ],
    // projectMetadata has entries but with empty/missing name
    projectMetadata: new Map([
      ['proj-no-meta-name', { visibility: 'public', lastAnalysisDate: '2026-01-01' }],
      // meta.name is undefined, project.name is also undefined => fallback to project.key
      ['proj-no-meta-no-name', { visibility: 'private' }]
    ]),
    projectBindings: new Map(),
    resourceMappings: {
      groupsByOrg: new Map(),
      profilesByOrg: new Map(),
      gatesByOrg: new Map(),
      portfoliosByOrg: new Map(),
      templatesByOrg: new Map()
    }
  };

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile: rf, rm: rmDir } = await import('node:fs/promises');
  const content = await rf(`${tmpDir}/projects.csv`, 'utf-8');

  // proj-no-meta-name: meta.name is undefined, falls back to project.name = 'Fallback Name'
  t.true(content.includes('Fallback Name'));
  // proj-no-meta-no-name: meta.name undefined, project.name undefined => falls back to project.key
  t.true(content.includes('proj-no-meta-no-name'));

  await rmDir(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// org-mapper.js lines 122-123: binding.slug truthy branch for bitbucket
// ---------------------------------------------------------------------------

test('mapProjectsToOrganizations: bitbucket binding with slug uses slug instead of repo', t => {
  const projects = [makeProject('proj-bb')];
  const bindings = new Map([
    ['proj-bb', makeBinding('bitbucket', 'workspace/repo-name', { slug: 'my-workspace/my-slug' })]
  ]);
  const targetOrgs = [makeTargetOrg('my-workspace')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);

  // The slug's first component 'my-workspace' should match the org key
  t.is(result.orgAssignments.length, 1);
  t.is(result.orgAssignments[0].projects.length, 1);
  t.is(result.orgAssignments[0].projects[0].key, 'proj-bb');
});

test('mapProjectsToOrganizations: bitbucketcloud binding with slug uses slug', t => {
  const projects = [makeProject('proj-bbc')];
  const bindings = new Map([
    ['proj-bbc', makeBinding('bitbucketcloud', 'orig-ws/repo', { slug: 'slug-ws/slug-repo' })]
  ]);
  const targetOrgs = [makeTargetOrg('slug-ws')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);

  t.is(result.orgAssignments.length, 1);
  t.is(result.orgAssignments[0].projects.length, 1);
  t.is(result.orgAssignments[0].projects[0].key, 'proj-bbc');
});

// ---------------------------------------------------------------------------
// org-mapper.js lines 122-123: bitbucket slug without slash
// When binding.slug is truthy AND does NOT contain '/', parts.length <= 1
// so the else branch on line 123 is taken: `bitbucket:${binding.slug || repo}`
// ---------------------------------------------------------------------------

test('binding group key: Bitbucket slug without slash uses slug directly', t => {
  const projects = [makeProject('p1')];
  // slug is truthy ('my-workspace') but has no '/' so parts.length is 1
  const bindings = new Map([['p1', makeBinding('bitbucket', '', { slug: 'my-workspace' })]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  // Line 123 else branch: parts.length <= 1 => `bitbucket:${binding.slug || repo}`
  // binding.slug is 'my-workspace' (truthy) => `bitbucket:my-workspace`
  t.is(result.bindingGroups[0].identifier, 'bitbucket:my-workspace');
});

test('binding group key: Bitbucketcloud slug without slash uses slug directly', t => {
  const projects = [makeProject('p1')];
  const bindings = new Map([['p1', makeBinding('bitbucketcloud', '', { slug: 'single-workspace' })]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  t.is(result.bindingGroups[0].identifier, 'bitbucket:single-workspace');
});

// ---------------------------------------------------------------------------
// org-mapper.js lines 122-123: bitbucket with FALSY slug falls back to repo
// When binding.slug is undefined/null, the || operator on line 122 falls to repo.
// When repo has no slash, parts.length <= 1, so line 123 else branch uses
// binding.slug || repo where slug is falsy => repo.
// ---------------------------------------------------------------------------

test('binding group key: Bitbucket with falsy slug and single-part repo uses repo', t => {
  const projects = [makeProject('p1')];
  // slug is undefined (falsy), repository is 'simple-repo' (no slash)
  const bindings = new Map([['p1', makeBinding('bitbucket', 'simple-repo')]]);
  const targetOrgs = [makeTargetOrg('org')];

  const result = mapProjectsToOrganizations(projects, bindings, targetOrgs);
  // Line 122: (binding.slug || repo) => (undefined || 'simple-repo') => 'simple-repo'
  // parts = ['simple-repo'], length 1 => else branch
  // Line 123: `bitbucket:${binding.slug || repo}` => `bitbucket:simple-repo`
  t.is(result.bindingGroups[0].identifier, 'bitbucket:simple-repo');
});

// ---------------------------------------------------------------------------
// csv-tables.js: fallback branch coverage for || operands (lines 20, 35, 70)
// These tests exercise the RIGHT (fallback) side of || operators where
// the left-side value is falsy.
// ---------------------------------------------------------------------------

test('generateGroupMappingsCsv: uses fallback empty string when description is undefined', t => {
  const data = {
    resourceMappings: {
      groupsByOrg: new Map([
        ['org-a', [
          { name: 'no-desc-group' }
        ]]
      ])
    }
  };

  const csv = generateGroupMappingsCsv(data);
  // description is undefined => fallback '' is used
  const lines = csv.trim().split('\n');
  // Header + 1 data row
  t.is(lines.length, 2);
  // Check the data row: yes,no-desc-group,,0,false,org-a
  t.true(lines[1].includes('no-desc-group'));
});

test('generateProfileMappingsCsv: uses fallback 0 when activeRuleCount is undefined', t => {
  const data = {
    resourceMappings: {
      profilesByOrg: new Map([
        ['org-a', [
          { name: 'NoRuleCountProfile', language: 'js', isDefault: false, isBuiltIn: false, parentName: 'Parent' }
        ]]
      ])
    }
  };

  const csv = generateProfileMappingsCsv(data);
  // activeRuleCount is undefined => fallback 0 is used
  t.true(csv.includes('NoRuleCountProfile'));
  t.true(csv.includes(',0,'));
});

test('generatePortfolioMappingsCsv: uses fallback public when visibility is undefined', t => {
  const data = {
    resourceMappings: {
      portfoliosByOrg: new Map([
        ['org-b', [
          { key: 'pf-no-vis', name: 'No Vis Portfolio', projects: [] }
        ]]
      ])
    }
  };

  const csv = generatePortfolioMappingsCsv(data);
  // visibility is undefined => fallback 'public' is used
  t.true(csv.includes('No Vis Portfolio'));
  t.true(csv.includes('public'));
});

// ---------------------------------------------------------------------------
// csv-generator.js line 58: meta.name || project.name || project.key
// When meta.name is falsy AND project.name is also falsy => falls to project.key
// (This test specifically verifies the project.key appears in the Name column)
// ---------------------------------------------------------------------------

test('generateMappingCsvs: falls to project.key when both meta.name and project.name are falsy', async t => {
  const { randomUUID: uuid } = await import('node:crypto');
  const tmpDir = `/tmp/cloudvoyager-test-csvgen-key-fallback-${uuid()}`;

  const mappingData = {
    orgAssignments: [
      {
        org: { key: 'sc-org' },
        projects: [{ key: 'only-key-project' }],  // name is undefined
        bindingGroups: []
      }
    ],
    // meta entry has no name property either
    projectMetadata: new Map([
      ['only-key-project', { visibility: 'public' }]
    ]),
    projectBindings: new Map(),
    resourceMappings: {
      groupsByOrg: new Map(),
      profilesByOrg: new Map(),
      gatesByOrg: new Map(),
      portfoliosByOrg: new Map(),
      templatesByOrg: new Map()
    }
  };

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile: rf, rm: rmDir } = await import('node:fs/promises');
  const content = await rf(`${tmpDir}/projects.csv`, 'utf-8');
  const lines = content.trim().split('\n');
  // CSV row: Include,Project Key,Project Name,...
  // The project key appears as both key and name
  const dataRow = lines[1];
  const fields = dataRow.split(',');
  // fields[1] is Project Key, fields[2] is Project Name
  t.is(fields[1], 'only-key-project');
  t.is(fields[2], 'only-key-project'); // fell through to project.key

  await rmDir(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// csv-applier.js line 116: gate.conditions?.length || 0 — when gate has no conditions
// ---------------------------------------------------------------------------

test('applyCsvOverrides: gate-mappings.csv handles gate with undefined conditions', t => {
  const parsedCsvs = new Map([
    ['gate-mappings.csv', {
      headers: ['Include', 'Gate Name', 'Condition Metric', 'Condition Operator', 'Condition Threshold'],
      rows: [
        // Include the gate but with a new condition added via CSV
        { Include: 'yes', 'Gate Name': 'NoCondGate', 'Condition Metric': '', 'Condition Operator': '', 'Condition Threshold': '' },
        { Include: 'yes', 'Gate Name': 'NoCondGate', 'Condition Metric': 'coverage', 'Condition Operator': 'LT', 'Condition Threshold': '80' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [
      { name: 'NoCondGate' /* conditions property is missing/undefined */ }
    ],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: { templates: [] }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // Gate should be kept with the new condition from CSV
  t.is(result.filteredExtractedData.qualityGates.length, 1);
  t.is(result.filteredExtractedData.qualityGates[0].name, 'NoCondGate');
  t.is(result.filteredExtractedData.qualityGates[0].conditions.length, 1);
  t.is(result.filteredExtractedData.qualityGates[0].conditions[0].metric, 'coverage');
});

// ---------------------------------------------------------------------------
// csv-applier.js line 248: permissionTemplates.defaultTemplates || []
// When defaultTemplates is undefined
// ---------------------------------------------------------------------------

test('applyCsvOverrides: template-mappings.csv handles missing defaultTemplates property', t => {
  const parsedCsvs = new Map([
    ['template-mappings.csv', {
      headers: ['Include', 'Template Name', 'Permission Key', 'Group Name'],
      rows: [
        { Include: 'yes', 'Template Name': 'MyTemplate', 'Permission Key': '', 'Group Name': '' }
      ]
    }]
  ]);
  const extractedData = {
    qualityGates: [],
    qualityProfiles: [],
    groups: [],
    portfolios: [],
    permissionTemplates: {
      templates: [
        { name: 'MyTemplate', id: 'tmpl-1', permissions: [] }
      ]
      // defaultTemplates is intentionally missing
    }
  };
  const orgAssignments = [
    { org: { key: 'org-a' }, projects: [] }
  ];

  const result = applyCsvOverrides(parsedCsvs, extractedData, {}, orgAssignments);

  // Should not crash — defaultTemplates || [] handles the undefined case
  t.is(result.filteredExtractedData.permissionTemplates.templates.length, 1);
  t.deepEqual(result.filteredExtractedData.permissionTemplates.defaultTemplates, []);
});
