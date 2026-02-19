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
  t.is(files.length, 7);

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

  t.is(lines[0], 'Target Organization,Binding Group,ALM Platform,Projects Count');
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

  t.is(lines[0], 'Project Key,Project Name,Target Organization,ALM Platform,Repository,Monorepo,Visibility,Last Analysis');
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

  t.is(lines[0], 'Group Name,Description,Target Organization');
  t.true(content.includes('developers'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: profile-mappings.csv contains profiles', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-profiles-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/profile-mappings.csv`, 'utf-8');

  t.true(content.includes('Profile Name,Language,Is Default,Parent,Active Rules,Target Organization'));
  t.true(content.includes('Sonar way'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: gate-mappings.csv contains gates', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-gates-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/gate-mappings.csv`, 'utf-8');

  t.true(content.includes('Gate Name,Is Default,Is Built-In,Conditions Count,Target Organization'));
  t.true(content.includes('Sonar way'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: portfolio-mappings.csv contains portfolios', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-portfolios-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/portfolio-mappings.csv`, 'utf-8');

  t.true(content.includes('Portfolio Key,Portfolio Name,Projects Count,Visibility,Target Organization'));
  t.true(content.includes('pf1'));

  await rm(tmpDir, { recursive: true, force: true });
});

test('generateMappingCsvs: template-mappings.csv contains templates', async t => {
  const tmpDir = `/tmp/cloudvoyager-test-templates-csv-${Date.now()}`;
  const mappingData = buildFullMappingData();

  await generateMappingCsvs(mappingData, tmpDir);

  const { readFile, rm } = await import('node:fs/promises');
  const content = await readFile(`${tmpDir}/template-mappings.csv`, 'utf-8');

  t.true(content.includes('Template Name,Description,Key Pattern,Target Organization'));
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
  t.is(files.length, 7);

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
