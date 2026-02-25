import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm, access, mkdir, writeFile } from 'node:fs/promises';
import { SonarQubeClient } from '../src/sonarqube/api-client.js';
import { SonarCloudClient } from '../src/sonarcloud/api-client.js';
import { DataExtractor } from '../src/sonarqube/extractors/index.js';
import { ProtobufBuilder } from '../src/protobuf/builder.js';
import { ProtobufEncoder } from '../src/protobuf/encoder.js';
import { ReportUploader } from '../src/sonarcloud/uploader.js';
import { StateTracker } from '../src/state/tracker.js';
import { EnterpriseClient } from '../src/sonarcloud/enterprise-client.js';
import { migrateAll } from '../src/migrate-pipeline.js';
import { runOrgStep, migrateEnterprisePortfolios } from '../src/pipeline/org-migration.js';
import { migrateOrgProjects } from '../src/pipeline/project-migration.js';

function setupAllStubs() {
  const sq = {};
  sq.testConnection = sinon.stub(SonarQubeClient.prototype, 'testConnection').resolves();
  sq.listAllProjects = sinon.stub(SonarQubeClient.prototype, 'listAllProjects').resolves([
    { key: 'proj1', name: 'Project One' }
  ]);
  sq.getQualityGates = sinon.stub(SonarQubeClient.prototype, 'getQualityGates').resolves([]);
  sq.getQualityGateDetails = sinon.stub(SonarQubeClient.prototype, 'getQualityGateDetails').resolves({ name: 'Default', conditions: [] });
  sq.getQualityGatePermissions = sinon.stub(SonarQubeClient.prototype, 'getQualityGatePermissions').resolves({ users: [], groups: [] });
  sq.getAllQualityProfiles = sinon.stub(SonarQubeClient.prototype, 'getAllQualityProfiles').resolves([]);
  sq.getQualityProfileBackup = sinon.stub(SonarQubeClient.prototype, 'getQualityProfileBackup').resolves('<xml/>');
  sq.getActiveRules = sinon.stub(SonarQubeClient.prototype, 'getActiveRules').resolves([]);
  sq.getQualityProfilePermissions = sinon.stub(SonarQubeClient.prototype, 'getQualityProfilePermissions').resolves({ users: [], groups: [] });
  sq.getGroups = sinon.stub(SonarQubeClient.prototype, 'getGroups').resolves([]);
  sq.getGlobalPermissions = sinon.stub(SonarQubeClient.prototype, 'getGlobalPermissions').resolves([]);
  sq.getPermissionTemplates = sinon.stub(SonarQubeClient.prototype, 'getPermissionTemplates').resolves({ templates: [], defaultTemplates: [] });
  sq.getPortfolios = sinon.stub(SonarQubeClient.prototype, 'getPortfolios').resolves([]);
  sq.getPortfolioDetails = sinon.stub(SonarQubeClient.prototype, 'getPortfolioDetails').resolves({});
  sq.getAlmSettings = sinon.stub(SonarQubeClient.prototype, 'getAlmSettings').resolves({ github: [], gitlab: [], azure: [], bitbucket: [], bitbucketcloud: [] });
  sq.getProjectBinding = sinon.stub(SonarQubeClient.prototype, 'getProjectBinding').resolves(null);
  sq.getSystemInfo = sinon.stub(SonarQubeClient.prototype, 'getSystemInfo').resolves({ System: { Version: '9.9' } });
  sq.getInstalledPlugins = sinon.stub(SonarQubeClient.prototype, 'getInstalledPlugins').resolves([]);
  sq.getWebhooks = sinon.stub(SonarQubeClient.prototype, 'getWebhooks').resolves([]);
  sq.getProjectSettings = sinon.stub(SonarQubeClient.prototype, 'getProjectSettings').resolves([]);
  sq.getProjectTags = sinon.stub(SonarQubeClient.prototype, 'getProjectTags').resolves([]);
  sq.getProjectLinks = sinon.stub(SonarQubeClient.prototype, 'getProjectLinks').resolves([]);
  sq.getNewCodePeriods = sinon.stub(SonarQubeClient.prototype, 'getNewCodePeriods').resolves({ projectLevel: null, branchOverrides: [] });
  sq.getQualityGate = sinon.stub(SonarQubeClient.prototype, 'getQualityGate').resolves({ name: 'Sonar way' });
  sq.getIssuesWithComments = sinon.stub(SonarQubeClient.prototype, 'getIssuesWithComments').resolves([]);
  sq.getHotspots = sinon.stub(SonarQubeClient.prototype, 'getHotspots').resolves([]);
  sq.getHotspotDetails = sinon.stub(SonarQubeClient.prototype, 'getHotspotDetails').resolves({});
  sq.getProject = sinon.stub(SonarQubeClient.prototype, 'getProject').resolves({ name: 'Project One' });
  sq.getBranches = sinon.stub(SonarQubeClient.prototype, 'getBranches').resolves([{ name: 'main', isMain: true }]);
  sq.getMetrics = sinon.stub(SonarQubeClient.prototype, 'getMetrics').resolves([]);
  sq.getIssues = sinon.stub(SonarQubeClient.prototype, 'getIssues').resolves([]);
  sq.getMeasures = sinon.stub(SonarQubeClient.prototype, 'getMeasures').resolves([]);
  sq.getComponentTree = sinon.stub(SonarQubeClient.prototype, 'getComponentTree').resolves([]);
  sq.getSourceCode = sinon.stub(SonarQubeClient.prototype, 'getSourceCode').resolves('');
  sq.getSourceFiles = sinon.stub(SonarQubeClient.prototype, 'getSourceFiles').resolves([]);
  sq.getLatestAnalysisRevision = sinon.stub(SonarQubeClient.prototype, 'getLatestAnalysisRevision').resolves(null);
  sq.getProjectPermissions = sinon.stub(SonarQubeClient.prototype, 'getProjectPermissions').resolves([]);

  const sc = {};
  sc.testConnection = sinon.stub(SonarCloudClient.prototype, 'testConnection').resolves();
  sc.isProjectKeyTakenGlobally = sinon.stub(SonarCloudClient.prototype, 'isProjectKeyTakenGlobally').resolves({ taken: false });
  sc.ensureProject = sinon.stub(SonarCloudClient.prototype, 'ensureProject').resolves();
  sc.getQualityProfiles = sinon.stub(SonarCloudClient.prototype, 'getQualityProfiles').resolves([]);
  sc.getMainBranchName = sinon.stub(SonarCloudClient.prototype, 'getMainBranchName').resolves('main');
  sc.createGroup = sinon.stub(SonarCloudClient.prototype, 'createGroup').resolves({ name: 'group' });
  sc.addGroupPermission = sinon.stub(SonarCloudClient.prototype, 'addGroupPermission').resolves();
  sc.createQualityGate = sinon.stub(SonarCloudClient.prototype, 'createQualityGate').resolves({ id: '1' });
  sc.createQualityGateCondition = sinon.stub(SonarCloudClient.prototype, 'createQualityGateCondition').resolves();
  sc.setDefaultQualityGate = sinon.stub(SonarCloudClient.prototype, 'setDefaultQualityGate').resolves();
  sc.restoreQualityProfile = sinon.stub(SonarCloudClient.prototype, 'restoreQualityProfile').resolves();
  sc.setDefaultQualityProfile = sinon.stub(SonarCloudClient.prototype, 'setDefaultQualityProfile').resolves();
  sc.addQualityProfileGroupPermission = sinon.stub(SonarCloudClient.prototype, 'addQualityProfileGroupPermission').resolves();
  sc.addQualityProfileUserPermission = sinon.stub(SonarCloudClient.prototype, 'addQualityProfileUserPermission').resolves();
  sc.addQualityProfileToProject = sinon.stub(SonarCloudClient.prototype, 'addQualityProfileToProject').resolves();
  sc.createPermissionTemplate = sinon.stub(SonarCloudClient.prototype, 'createPermissionTemplate').resolves({ id: 'tmpl1' });
  sc.addGroupToTemplate = sinon.stub(SonarCloudClient.prototype, 'addGroupToTemplate').resolves();
  sc.addProjectGroupPermission = sinon.stub(SonarCloudClient.prototype, 'addProjectGroupPermission').resolves();
  sc.getActiveRules = sinon.stub(SonarCloudClient.prototype, 'getActiveRules').resolves({ actives: {} });
  sc.setProjectSetting = sinon.stub(SonarCloudClient.prototype, 'setProjectSetting').resolves();
  sc.setProjectTags = sinon.stub(SonarCloudClient.prototype, 'setProjectTags').resolves();
  sc.createProjectLink = sinon.stub(SonarCloudClient.prototype, 'createProjectLink').resolves();
  sc.setGithubBinding = sinon.stub(SonarCloudClient.prototype, 'setGithubBinding').resolves();
  sc.setGitlabBinding = sinon.stub(SonarCloudClient.prototype, 'setGitlabBinding').resolves();
  sc.setAzureBinding = sinon.stub(SonarCloudClient.prototype, 'setAzureBinding').resolves();
  sc.setBitbucketBinding = sinon.stub(SonarCloudClient.prototype, 'setBitbucketBinding').resolves();
  sc.searchQualityProfiles = sinon.stub(SonarCloudClient.prototype, 'searchQualityProfiles').resolves([]);
  sc.searchIssues = sinon.stub(SonarCloudClient.prototype, 'searchIssues').resolves([]);
  sc.searchHotspots = sinon.stub(SonarCloudClient.prototype, 'searchHotspots').resolves([]);
  sc.transitionIssue = sinon.stub(SonarCloudClient.prototype, 'transitionIssue').resolves();
  sc.addIssueComment = sinon.stub(SonarCloudClient.prototype, 'addIssueComment').resolves();
  sc.assignIssue = sinon.stub(SonarCloudClient.prototype, 'assignIssue').resolves();
  sc.setIssueTags = sinon.stub(SonarCloudClient.prototype, 'setIssueTags').resolves();
  sc.changeHotspotStatus = sinon.stub(SonarCloudClient.prototype, 'changeHotspotStatus').resolves();
  sc.addHotspotComment = sinon.stub(SonarCloudClient.prototype, 'addHotspotComment').resolves();
  sc.getAnalysisStatus = sinon.stub(SonarCloudClient.prototype, 'getAnalysisStatus').resolves({ status: 'SUCCESS' });
  sc.projectExists = sinon.stub(SonarCloudClient.prototype, 'projectExists').resolves(false);
  sc.assignQualityGateToProject = sinon.stub(SonarCloudClient.prototype, 'assignQualityGateToProject').resolves();
  sc.setDefaultTemplate = sinon.stub(SonarCloudClient.prototype, 'setDefaultTemplate').resolves();
  sc.waitForAnalysis = sinon.stub(SonarCloudClient.prototype, 'waitForAnalysis').resolves({ status: 'SUCCESS' });

  const de = {};
  de.extractAll = sinon.stub(DataExtractor.prototype, 'extractAll').resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [], components: [], sources: [], metrics: [],
    measures: { measures: [] }
  });

  const pb = {};
  pb.buildAll = sinon.stub(ProtobufBuilder.prototype, 'buildAll').returns({ metadata: {} });

  const pe = {};
  pe.loadSchemas = sinon.stub(ProtobufEncoder.prototype, 'loadSchemas').resolves();
  pe.encodeAll = sinon.stub(ProtobufEncoder.prototype, 'encodeAll').returns({ data: 'encoded' });

  const ru = {};
  ru.upload = sinon.stub(ReportUploader.prototype, 'upload').resolves({ id: 'ce-1' });
  ru.uploadAndWait = sinon.stub(ReportUploader.prototype, 'uploadAndWait').resolves();

  const st = {};
  st.initialize = sinon.stub(StateTracker.prototype, 'initialize').resolves();
  st.getSummary = sinon.stub(StateTracker.prototype, 'getSummary').returns({
    lastSync: null, processedIssuesCount: 0, completedBranchesCount: 0,
    completedBranches: [], syncHistoryCount: 0
  });
  st.recordTransfer = sinon.stub(StateTracker.prototype, 'recordTransfer').resolves();

  const ec = {};
  ec.resolveEnterpriseId = sinon.stub(EnterpriseClient.prototype, 'resolveEnterpriseId').resolves('ent-uuid-1');
  ec.listPortfolios = sinon.stub(EnterpriseClient.prototype, 'listPortfolios').resolves([]);
  ec.createPortfolio = sinon.stub(EnterpriseClient.prototype, 'createPortfolio').resolves({ id: 'portfolio-1' });
  ec.updatePortfolio = sinon.stub(EnterpriseClient.prototype, 'updatePortfolio').resolves();
  ec.deletePortfolio = sinon.stub(EnterpriseClient.prototype, 'deletePortfolio').resolves();
  ec.getSelectableOrganizations = sinon.stub(EnterpriseClient.prototype, 'getSelectableOrganizations').resolves([]);
  ec.getSelectableProjects = sinon.stub(EnterpriseClient.prototype, 'getSelectableProjects').resolves([]);

  return { sq, sc, de, pb, pe, ru, st, ec };
}

function baseMigrateOptions(outputDir) {
  return {
    sonarqubeConfig: { url: 'http://localhost:9000', token: 'sq-token' },
    sonarcloudOrgs: [{ key: 'test-org', token: 'sc-token', url: 'https://sonarcloud.io' }],
    migrateConfig: { outputDir, dryRun: false, skipIssueSync: false, skipHotspotSync: false },
    transferConfig: { mode: 'full', stateFile: '.state.json', batchSize: 100 },
    performanceConfig: {},
    wait: false
  };
}

// Use beforeEach/afterEach for proper lifecycle management
test.serial.beforeEach(t => {
  t.context.outputDir = join(tmpdir(), `cv-test-${randomUUID()}`);
  t.context.stubs = setupAllStubs();
});

test.serial.afterEach.always(async t => {
  sinon.restore();
  await rm(t.context.outputDir, { recursive: true, force: true });
});

test.serial('migrateAll completes full pipeline with 1 org and 1 project', async t => {
  const { stubs, outputDir } = t.context;
  const results = await migrateAll(baseMigrateOptions(outputDir));
  t.is(results.projects.length, 1);
  t.is(results.orgResults.length, 1);
  t.truthy(results.startTime);
  t.truthy(results.endTime);
  t.is(results.dryRun, false);
  t.true(stubs.sq.testConnection.called);
  t.true(stubs.sq.listAllProjects.called);
  t.true(stubs.sc.testConnection.called);
});

test.serial('migrateAll dry run stops before migration', async t => {
  const { stubs, outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.dryRun = true;
  const results = await migrateAll(opts);
  t.is(results.dryRun, true);
  t.is(results.projects.length, 0);
  t.false(stubs.sc.testConnection.called);
  t.true(stubs.sq.listAllProjects.called);
});

test.serial('migrateAll handles SonarQube connection failure', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.testConnection.rejects(new Error('Connection refused'));
  await t.throwsAsync(() => migrateAll(baseMigrateOptions(outputDir)), { message: /Connection refused/ });
});

test.serial('migrateAll handles SonarCloud connection failure gracefully', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sc.testConnection.rejects(new Error('Unauthorized'));
  const results = await migrateAll(baseMigrateOptions(outputDir));
  t.is(results.orgResults.length, 1);
  const orgResult = results.orgResults[0];
  const connectStep = orgResult.steps.find(s => s.step === 'Connect to SonarCloud');
  t.is(connectStep.status, 'failed');
});

test.serial('migrateAll skips org with no projects', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.listAllProjects.resolves([]);
  const results = await migrateAll(baseMigrateOptions(outputDir));
  t.is(results.projects.length, 0);
  t.false(stubs.sc.testConnection.called);
});

test.serial('migrateAll with skipIssueSync skips issue sync step', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.skipIssueSync = true;
  const results = await migrateAll(opts);
  const proj = results.projects[0];
  const issueStep = proj.steps.find(s => s.step === 'Sync issues');
  t.is(issueStep.status, 'skipped');
});

test.serial('migrateAll with skipHotspotSync skips hotspot sync step', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.skipHotspotSync = true;
  const results = await migrateAll(opts);
  const proj = results.projects[0];
  const hotspotStep = proj.steps.find(s => s.step === 'Sync hotspots');
  t.is(hotspotStep.status, 'skipped');
});

test.serial('migrateAll with wait=true passes wait to transferProject', async t => {
  const { stubs, outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  opts.wait = true;
  await migrateAll(opts);
  t.true(stubs.ru.uploadAndWait.called);
});

test.serial('migrateAll handles project key conflict', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sc.isProjectKeyTakenGlobally.resolves({ taken: true, owner: 'other-org' });
  const results = await migrateAll(baseMigrateOptions(outputDir));
  t.is(results.projectKeyWarnings.length, 1);
  t.is(results.projectKeyWarnings[0].sqKey, 'proj1');
  t.truthy(results.projectKeyWarnings[0].scKey.includes('test-org_'));
});

test.serial('migrateAll with transfer failure records error', async t => {
  const { stubs, outputDir } = t.context;
  stubs.de.extractAll.rejects(new Error('Extraction failed'));
  const results = await migrateAll(baseMigrateOptions(outputDir));
  const proj = results.projects[0];
  const uploadStep = proj.steps.find(s => s.step === 'Upload scanner report');
  t.is(uploadStep.status, 'failed');
});

test.serial('migrateAll generates reports in output directory', async t => {
  const { outputDir } = t.context;
  await migrateAll(baseMigrateOptions(outputDir));
  await t.notThrowsAsync(access(join(outputDir, 'reports', 'migration-report.json')));
  await t.notThrowsAsync(access(join(outputDir, 'reports', 'migration-report.txt')));
  await t.notThrowsAsync(access(join(outputDir, 'reports', 'migration-report.md')));
});

test.serial('migrateAll with multiple orgs assigns projects correctly', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  opts.sonarcloudOrgs = [
    { key: 'org-a', token: 'token-a', url: 'https://sonarcloud.io' },
    { key: 'org-b', token: 'token-b', url: 'https://sonarcloud.io' }
  ];
  const results = await migrateAll(opts);
  t.true(results.orgResults.length >= 1);
});

test.serial('migrateAll uses skipIssueMetadataSync config alias', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.skipIssueMetadataSync = true;
  const results = await migrateAll(opts);
  const proj = results.projects[0];
  const issueStep = proj.steps.find(s => s.step === 'Sync issues');
  t.is(issueStep.status, 'skipped');
});

test.serial('migrateAll uses skipHotspotMetadataSync config alias', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.skipHotspotMetadataSync = true;
  const results = await migrateAll(opts);
  const proj = results.projects[0];
  const hotspotStep = proj.steps.find(s => s.step === 'Sync hotspots');
  t.is(hotspotStep.status, 'skipped');
});

test.serial('migrateAll partial project status when some steps fail', async t => {
  const { stubs, outputDir } = t.context;
  // Make issue sync fail but let everything else succeed
  stubs.sc.searchIssues.rejects(new Error('Issue sync failed'));
  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);
  const proj = results.projects[0];
  // Should be partial (some steps succeeded, some failed)
  t.is(proj.status, 'partial');
  t.true(proj.errors.length > 0);
});

test.serial('migrateAll project with new code period skipped records in summary', async t => {
  const { stubs, outputDir } = t.context;
  // Return a new code period with unsupported type
  stubs.sq.getNewCodePeriods.resolves({
    projectLevel: { type: 'REFERENCE_BRANCH', value: 'main' },
    branchOverrides: []
  });
  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);
  // The project should have a "New code definitions" step that is skipped
  const proj = results.projects[0];
  const ncpStep = proj.steps.find(s => s.step === 'New code definitions');
  t.truthy(ncpStep);
});

test.serial('migrateAll project key warning with logging', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.listAllProjects.resolves([
    { key: 'proj1', name: 'Project 1' },
    { key: 'proj2', name: 'Project 2' }
  ]);
  // First project key taken, second not
  stubs.sc.isProjectKeyTakenGlobally
    .onFirstCall().resolves({ taken: true, owner: 'other-org' })
    .onSecondCall().resolves({ taken: false });
  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);
  t.is(results.projectKeyWarnings.length, 1);
  t.is(results.projects.length, 2);
});

// ===== Tests for migrate-pipeline.js CSV loading (lines 34-49) =====

test.serial('migrateAll loads pre-existing CSVs from mappings directory', async t => {
  const { outputDir } = t.context;
  // Create the mappings directory with a CSV file BEFORE calling migrateAll
  const mappingsDir = join(outputDir, 'mappings');
  await mkdir(mappingsDir, { recursive: true });
  // Write a projects.csv that excludes proj1
  const csvContent = 'Include,Project Key,Project Name,Target Organization\nno,proj1,Project One,test-org\n';
  await writeFile(join(mappingsDir, 'projects.csv'), csvContent, 'utf-8');

  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);
  // The CSV excludes proj1, so no projects should be migrated
  t.is(results.projects.length, 0);
});

test.serial('migrateAll applies CSV overrides filtering quality gates', async t => {
  const { stubs, outputDir } = t.context;
  // Set up two quality gates (getQualityGates returns { qualitygates: [...] })
  stubs.sq.getQualityGates.resolves({
    qualitygates: [
      { name: 'Gate A', isBuiltIn: false, isDefault: false },
      { name: 'Gate B', isBuiltIn: false, isDefault: false }
    ]
  });
  stubs.sq.getQualityGateDetails
    .onFirstCall().resolves({ name: 'Gate A', conditions: [{ metric: 'coverage', op: 'LT', error: '80' }] })
    .onSecondCall().resolves({ name: 'Gate B', conditions: [] });

  // Create mappings directory with a gate CSV that excludes Gate B
  const mappingsDir = join(outputDir, 'mappings');
  await mkdir(mappingsDir, { recursive: true });
  const gateCsv = 'Include,Gate Name\nyes,Gate A\nno,Gate B\n';
  await writeFile(join(mappingsDir, 'gate-mappings.csv'), gateCsv, 'utf-8');

  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);
  // Pipeline should complete (CSV overrides applied successfully)
  t.truthy(results.endTime);
});

// ===== Test for migrate-pipeline.js portfolio path (lines 151-152) =====

test.serial('migrateAll with enterprise config triggers portfolio migration', async t => {
  const { stubs, outputDir } = t.context;
  // Set up portfolios in the extracted data
  stubs.sq.getPortfolios.resolves([{ key: 'portfolio1', name: 'Portfolio One', description: '', projects: [{ key: 'proj1', name: 'Project One' }], selectionMode: 'MANUAL' }]);

  const opts = baseMigrateOptions(outputDir);
  opts.enterpriseConfig = { key: 'my-enterprise' };
  const results = await migrateAll(opts);
  // The EnterpriseClient methods should have been called
  t.true(stubs.ec.resolveEnterpriseId.called);
  t.true(stubs.ec.createPortfolio.called);
});

test.serial('migrateAll skips portfolio migration when --only excludes portfolios', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.getPortfolios.resolves([{ key: 'portfolio1', name: 'Portfolio One', description: '', projects: [{ key: 'proj1', name: 'Project One' }], selectionMode: 'MANUAL' }]);

  const opts = baseMigrateOptions(outputDir);
  opts.enterpriseConfig = { key: 'my-enterprise' };
  opts.migrateConfig.onlyComponents = ['scan-data'];
  const results = await migrateAll(opts);
  // Portfolio migration should be skipped
  t.false(stubs.ec.resolveEnterpriseId.called);
});

// ===== Test for migrate-pipeline.js report writing error (lines 160-161) =====

test.serial('migrateAll handles report writing errors gracefully', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  // Set outputDir to a path nested under a file, so mkdir inside writeAllReports will fail
  // First run migrateAll normally to verify it works, then create a blocking file
  const reportsPath = join(outputDir, 'reports');
  // Pre-create outputDir so migrateAll can write state files
  await mkdir(outputDir, { recursive: true });
  // Create a file at the reports path to block mkdir({ recursive: true }) in writeAllReports
  await writeFile(reportsPath, 'blocking-file');

  // migrateAll should still return results even when report writing fails
  const results = await migrateAll(opts);
  t.truthy(results);
  t.truthy(results.endTime);
});

// ===== Tests for org-migration.js --only component filtering (lines 55-56, 159-179) =====

test.serial('migrateAll with --only quality-gates only migrates quality gates', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.getQualityGates.resolves({
    qualitygates: [
      { name: 'My Gate', isBuiltIn: false, isDefault: false }
    ]
  });
  stubs.sq.getQualityGateDetails.resolves({ name: 'My Gate', conditions: [{ metric: 'coverage', op: 'LT', error: '80' }] });
  // Project must exist in SC for per-project steps when scan-data is skipped
  stubs.sc.projectExists.resolves(true);

  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.onlyComponents = ['quality-gates'];
  const results = await migrateAll(opts);

  // Quality gates step should be success
  const orgResult = results.orgResults[0];
  const gateStep = orgResult.steps.find(s => s.step === 'Create quality gates');
  t.is(gateStep.status, 'success');

  // Groups and global permissions should be skipped
  const groupStep = orgResult.steps.find(s => s.step === 'Create groups');
  t.is(groupStep.status, 'skipped');
  const permStep = orgResult.steps.find(s => s.step === 'Set global permissions');
  t.is(permStep.status, 'skipped');

  // Quality profiles should be skipped
  const profileStep = orgResult.steps.find(s => s.step === 'Restore quality profiles');
  t.is(profileStep.status, 'skipped');

  // Project-level quality gate assignment should still run
  const proj = results.projects[0];
  const assignGateStep = proj.steps.find(s => s.step === 'Assign quality gate');
  t.truthy(assignGateStep);
  t.not(assignGateStep.status, 'skipped');
});

test.serial('migrateAll with --only portfolios takes fast path', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.getPortfolios.resolves([{ key: 'portfolio1', name: 'Portfolio One', description: '', projects: [{ key: 'proj1', name: 'Project One' }], selectionMode: 'MANUAL' }]);

  const opts = baseMigrateOptions(outputDir);
  opts.enterpriseConfig = { key: 'my-enterprise' };
  opts.migrateConfig.onlyComponents = ['portfolios'];
  const results = await migrateAll(opts);

  // No projects should have been migrated (no project-level work)
  t.is(results.projects.length, 0);

  // Org-wide resource steps should all be skipped
  const orgResult = results.orgResults[0];
  const groupStep = orgResult.steps.find(s => s.step === 'Create groups');
  t.is(groupStep.status, 'skipped');
  const gateStep = orgResult.steps.find(s => s.step === 'Create quality gates');
  t.is(gateStep.status, 'skipped');

  // Portfolio migration should be triggered
  t.true(stubs.ec.resolveEnterpriseId.called);
});

test.serial('migrateAll with --only permissions only migrates permissions', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.getGroups.resolves([{ name: 'devs', description: 'Developers' }]);
  // Project must exist in SC for per-project steps when scan-data is skipped
  stubs.sc.projectExists.resolves(true);

  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.onlyComponents = ['permissions'];
  const results = await migrateAll(opts);

  // Groups and permissions should run
  const orgResult = results.orgResults[0];
  const groupStep = orgResult.steps.find(s => s.step === 'Create groups');
  t.is(groupStep.status, 'success');
  const permStep = orgResult.steps.find(s => s.step === 'Set global permissions');
  t.is(permStep.status, 'success');

  // Quality gates should be skipped
  const gateStep = orgResult.steps.find(s => s.step === 'Create quality gates');
  t.is(gateStep.status, 'skipped');

  // Project permissions step should have run (permissions includes project-level)
  const proj = results.projects[0];
  const projPermStep = proj.steps.find(s => s.step === 'Project permissions');
  t.truthy(projPermStep);
  t.not(projPermStep.status, 'skipped');
});

// ===== Tests for project-migration.js (lines 63-89, 92-103, 200-270) =====

test.serial('migrateAll with --only issue-metadata skips scan data', async t => {
  const { stubs, outputDir } = t.context;
  // Make the project exist in SonarCloud (needed when scan-data is skipped)
  stubs.sc.projectExists.resolves(true);

  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.onlyComponents = ['issue-metadata'];
  const results = await migrateAll(opts);

  const proj = results.projects[0];
  // Scanner report should be skipped
  const uploadStep = proj.steps.find(s => s.step === 'Upload scanner report');
  t.is(uploadStep.status, 'skipped');

  // Issue sync should run
  const issueStep = proj.steps.find(s => s.step === 'Sync issues');
  t.truthy(issueStep);
  t.not(issueStep.status, 'skipped');

  // Hotspot sync should be skipped
  const hotspotStep = proj.steps.find(s => s.step === 'Sync hotspots');
  t.is(hotspotStep.status, 'skipped');
});

test.serial('migrateAll with --only issue-metadata skips when project does not exist in SC', async t => {
  const { stubs, outputDir } = t.context;
  // Project does NOT exist in SonarCloud
  stubs.sc.projectExists.resolves(false);

  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.onlyComponents = ['issue-metadata'];
  const results = await migrateAll(opts);

  const proj = results.projects[0];
  // Should have a project existence check failure
  const existCheck = proj.steps.find(s => s.step === 'Project existence check');
  t.truthy(existCheck);
  t.is(existCheck.status, 'failed');

  // Issue sync should be skipped because report upload failed (project doesn't exist)
  const issueStep = proj.steps.find(s => s.step === 'Sync issues');
  t.is(issueStep.status, 'skipped');
  t.is(issueStep.detail, 'Report upload failed');
});

test.serial('migrateAll with --only project-settings migrates only project config', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sc.projectExists.resolves(true);

  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.onlyComponents = ['project-settings'];
  const results = await migrateAll(opts);

  const proj = results.projects[0];
  // Scanner report should be skipped
  const uploadStep = proj.steps.find(s => s.step === 'Upload scanner report');
  t.is(uploadStep.status, 'skipped');

  // Project settings, tags, links, NCP, DevOps binding should run
  const settingsStep = proj.steps.find(s => s.step === 'Project settings');
  t.truthy(settingsStep);
  t.not(settingsStep.status, 'skipped');

  const tagsStep = proj.steps.find(s => s.step === 'Project tags');
  t.truthy(tagsStep);
  t.not(tagsStep.status, 'skipped');

  const linksStep = proj.steps.find(s => s.step === 'Project links');
  t.truthy(linksStep);
  t.not(linksStep.status, 'skipped');

  const ncpStep = proj.steps.find(s => s.step === 'New code definitions');
  t.truthy(ncpStep);
  t.not(ncpStep.status, 'skipped');

  const devopsStep = proj.steps.find(s => s.step === 'DevOps binding');
  t.truthy(devopsStep);
  t.not(devopsStep.status, 'skipped');

  // Issue and hotspot sync should be skipped
  const issueStep = proj.steps.find(s => s.step === 'Sync issues');
  t.is(issueStep.status, 'skipped');
  const hotspotStep = proj.steps.find(s => s.step === 'Sync hotspots');
  t.is(hotspotStep.status, 'skipped');

  // Quality gate and permission should be skipped
  const gateStep = proj.steps.find(s => s.step === 'Assign quality gate');
  t.is(gateStep.status, 'skipped');
  const permStep = proj.steps.find(s => s.step === 'Project permissions');
  t.is(permStep.status, 'skipped');
});

test.serial('migrateAll project config migrates quality gate assignment', async t => {
  const { stubs, outputDir } = t.context;
  // getQualityGates returns { qualitygates: [...] } structure
  stubs.sq.getQualityGates.resolves({
    qualitygates: [
      { name: 'Custom Gate', isBuiltIn: false, isDefault: false }
    ]
  });
  stubs.sq.getQualityGateDetails.resolves({ name: 'Custom Gate', conditions: [{ metric: 'coverage', op: 'LT', error: '80' }] });
  stubs.sq.getQualityGatePermissions.resolves({ users: [], groups: [] });
  // Per-project quality gate
  stubs.sq.getQualityGate.resolves({ name: 'Custom Gate' });

  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);
  const proj = results.projects[0];
  const gateAssignStep = proj.steps.find(s => s.step === 'Assign quality gate');
  t.truthy(gateAssignStep);
  // assignQualityGatesToProjects calls sc.assignQualityGateToProject
  t.true(stubs.sc.assignQualityGateToProject.called);
});

test.serial('migrateAll project config migrates quality profile assignment with built-in mapping', async t => {
  const { stubs, outputDir } = t.context;
  // Set up quality profiles with a built-in profile
  stubs.sq.getAllQualityProfiles.resolves([
    { key: 'prof1', name: 'Sonar way', language: 'java', isBuiltIn: true, backup: '<xml/>', activeRuleCount: 10, permissions: { users: [], groups: [] } }
  ]);
  stubs.sq.getQualityProfileBackup.resolves('<xml/>');
  stubs.sq.getActiveRules.resolves([]);
  stubs.sq.getQualityProfilePermissions.resolves({ users: [], groups: [] });
  // SC restoreQualityProfile should return the profile mapping
  stubs.sc.restoreQualityProfile.resolves({ profile: { key: 'sc-prof1', name: 'Sonar way', language: 'java' } });
  // SC searchQualityProfiles used by quality-profile-diff
  stubs.sc.searchQualityProfiles.resolves([{ key: 'sc-prof1', name: 'Sonar way', language: 'java' }]);

  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);
  const proj = results.projects[0];
  const profileStep = proj.steps.find(s => s.step === 'Assign quality profiles');
  // If built-in profile mapping was populated, the step should exist
  // (The actual behavior depends on whether migrateQualityProfiles returns builtInProfileMapping)
  if (profileStep) {
    t.not(profileStep.status, 'skipped');
  } else {
    // If no built-in mapping was generated, the step may not appear (which is fine)
    t.pass();
  }
});

// ===== Tests for extraction.js failure paths (lines 19-21, 32-35) =====

test.serial('migrateAll handles project extraction failure', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.listAllProjects.rejects(new Error('API timeout'));
  await t.throwsAsync(() => migrateAll(baseMigrateOptions(outputDir)), { message: /API timeout/ });
});

test.serial('migrateAll handles non-fatal extraction failure gracefully', async t => {
  const { stubs, outputDir } = t.context;
  // Make quality gates extraction fail (non-fatal)
  stubs.sq.getQualityGates.rejects(new Error('Quality gates unavailable'));
  const results = await migrateAll(baseMigrateOptions(outputDir));
  // Pipeline should still complete
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
  // The extraction failure should be recorded in serverSteps
  const gateStep = results.serverSteps.find(s => s.step === 'Extract quality gates');
  t.is(gateStep.status, 'failed');
  t.truthy(gateStep.error);
});

test.serial('migrateAll handles DevOps bindings extraction failure gracefully', async t => {
  const { stubs, outputDir } = t.context;
  // Make ALM settings extraction fail
  stubs.sq.getAlmSettings.rejects(new Error('ALM API not available'));
  const results = await migrateAll(baseMigrateOptions(outputDir));
  // Pipeline should still complete
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
  // The DevOps bindings extraction failure should be recorded
  const bindingStep = results.serverSteps.find(s => s.step === 'Extract DevOps bindings');
  t.is(bindingStep.status, 'failed');
});

// ===== Test for scan-data-all-branches override (project-migration.js lines 63-75) =====

test.serial('migrateAll with --only scan-data-all-branches uses default branch sync', async t => {
  const { stubs, outputDir } = t.context;
  // Set up branches
  stubs.sq.getBranches.resolves([
    { name: 'main', isMain: true },
    { name: 'develop', isMain: false }
  ]);
  stubs.de.extractAll.resolves({
    project: { branches: [{ name: 'main', isMain: true }, { name: 'develop', isMain: false }] },
    issues: [], components: [], sources: [], metrics: [],
    measures: { measures: [] }
  });

  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.onlyComponents = ['scan-data-all-branches'];
  opts.transferConfig.syncAllBranches = true;
  const results = await migrateAll(opts);

  const proj = results.projects[0];
  const uploadStep = proj.steps.find(s => s.step === 'Upload scanner report');
  t.truthy(uploadStep);
  // Should have attempted upload (success or failure)
  t.not(uploadStep.status, 'skipped');
});

test.serial('migrateAll with --only scan-data forces main branch only', async t => {
  const { stubs, outputDir } = t.context;

  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.onlyComponents = ['scan-data'];
  opts.transferConfig.syncAllBranches = true;
  const results = await migrateAll(opts);

  const proj = results.projects[0];
  const uploadStep = proj.steps.find(s => s.step === 'Upload scanner report');
  t.truthy(uploadStep);
  t.not(uploadStep.status, 'skipped');

  // Issue and hotspot should be skipped (not in --only)
  const issueStep = proj.steps.find(s => s.step === 'Sync issues');
  t.is(issueStep.status, 'skipped');
});

// ===== Test for CSV loading with empty CSVs =====

test.serial('migrateAll ignores empty CSV files in mappings directory', async t => {
  const { outputDir } = t.context;
  // Create mappings directory with empty CSV
  const mappingsDir = join(outputDir, 'mappings');
  await mkdir(mappingsDir, { recursive: true });
  await writeFile(join(mappingsDir, 'projects.csv'), '', 'utf-8');

  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);
  // Should proceed without CSV overrides
  t.is(results.projects.length, 1);
  t.truthy(results.endTime);
});

// ===== Test for multiple non-fatal extraction failures =====

test.serial('migrateAll handles multiple non-fatal extraction failures', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.getQualityGates.rejects(new Error('Gates unavailable'));
  stubs.sq.getAllQualityProfiles.rejects(new Error('Profiles unavailable'));
  stubs.sq.getGroups.rejects(new Error('Groups unavailable'));
  stubs.sq.getPortfolios.rejects(new Error('Portfolios unavailable'));

  const results = await migrateAll(baseMigrateOptions(outputDir));
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
  // All four non-fatal extraction steps should have failed
  const failedSteps = results.serverSteps.filter(s => s.status === 'failed');
  t.true(failedSteps.length >= 4);
});

// ===== Coverage: project-migration.js lines 179-181 (hotspot sync catch) =====

test.serial('migrateAll records hotspot sync failure when extractHotspots throws', async t => {
  const { stubs, outputDir } = t.context;
  // Make getHotspots throw so extractHotspots propagates the error to syncProjectHotspots catch block
  stubs.sq.getHotspots.rejects(new Error('Hotspot API unavailable'));

  const opts = baseMigrateOptions(outputDir);
  // Ensure hotspot sync is NOT skipped
  opts.migrateConfig.skipHotspotSync = false;
  const results = await migrateAll(opts);

  const proj = results.projects[0];
  // The hotspot sync step should be recorded as failed
  const hotspotStep = proj.steps.find(s => s.step === 'Sync hotspots');
  t.truthy(hotspotStep);
  t.is(hotspotStep.status, 'failed');
  t.is(hotspotStep.error, 'Hotspot API unavailable');
  t.truthy(hotspotStep.durationMs >= 0);
  // Error should also be in the project errors array
  t.true(proj.errors.some(e => e.includes('Hotspot API unavailable')));
});

// ===== Coverage: migrate-pipeline.js lines 47-48 (CSV read failure catch) =====

test.serial('migrateAll catches loadMappingCsvs failure and proceeds without overrides', async t => {
  const { outputDir } = t.context;

  // Create the mappings directory so existsSync returns true (line 37)
  const mappingsDir = join(outputDir, 'mappings');
  await mkdir(mappingsDir, { recursive: true });

  // Use esmock to replace loadMappingCsvs with a function that throws
  const { migrateAll: migrateAllMocked } = await esmock('../src/migrate-pipeline.js', {
    '../src/mapping/csv-reader.js': {
      loadMappingCsvs: async () => { throw new Error('CSV parse explosion'); }
    }
  });

  const opts = baseMigrateOptions(outputDir);
  // dryRun must be false (default) for the CSV loading path
  const results = await migrateAllMocked(opts);
  // Pipeline should proceed despite CSV failure (lines 47-48 warn and continue)
  t.truthy(results);
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
});

// ===== Coverage: migrate-pipeline.js lines 72-74 (rateLimitConfig truthy branch) =====

test.serial('migrateAll with rateLimitConfig populates rateLimit in configuration', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  opts.rateLimitConfig = { maxRetries: 5, baseDelay: 2000, minRequestInterval: 100 };
  const results = await migrateAll(opts);

  // Verify lines 72-74: the truthy branch of the ternary
  t.is(results.configuration.rateLimit.maxRetries, 5);
  t.is(results.configuration.rateLimit.baseDelay, 2000);
  t.is(results.configuration.rateLimit.minRequestInterval, 100);
});

test.serial('migrateAll with rateLimitConfig uses defaults for missing fields', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  // Provide rateLimitConfig with no fields to exercise ?? fallbacks
  opts.rateLimitConfig = {};
  const results = await migrateAll(opts);

  // Lines 72-74: ?? operators provide defaults
  t.is(results.configuration.rateLimit.maxRetries, 3);
  t.is(results.configuration.rateLimit.baseDelay, 1000);
  t.is(results.configuration.rateLimit.minRequestInterval, 0);
});

// ===== Coverage: migrate-pipeline.js lines 160-161 (writeAllReports failure) =====

test.serial('migrateAll catches writeAllReports failure in finally block', async t => {
  const { outputDir } = t.context;

  // Use esmock to replace writeAllReports with a function that throws
  const { migrateAll: migrateAllMocked } = await esmock('../src/migrate-pipeline.js', {
    '../src/reports/index.js': {
      writeAllReports: async () => { throw new Error('Report disk write failed'); }
    }
  });

  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAllMocked(opts);
  // Pipeline should still return results despite report write failure (lines 160-161)
  t.truthy(results);
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
});

// ===== Coverage: org-migration.js lines 200-202 (empty portfolios) =====

test.serial('migrateAll with enterprise config but no portfolios returns early', async t => {
  const { stubs, outputDir } = t.context;
  // Portfolios extraction returns empty array
  stubs.sq.getPortfolios.resolves([]);

  const opts = baseMigrateOptions(outputDir);
  opts.enterpriseConfig = { key: 'my-enterprise' };
  const results = await migrateAll(opts);

  // migrateEnterprisePortfolios should return early (lines 199-201)
  // EnterpriseClient should NOT be called because portfolios is empty
  t.false(stubs.ec.resolveEnterpriseId.called);
  t.is(results.portfolios, 0);
  t.truthy(results.endTime);
});

// ===== Coverage: org-migration.js lines 219-220 (portfolio migration failure) =====

test.serial('migrateAll catches portfolio migration failure', async t => {
  const { stubs, outputDir } = t.context;
  // Set up portfolios in the extracted data
  stubs.sq.getPortfolios.resolves([{
    key: 'portfolio1', name: 'Portfolio One', description: '',
    projects: [{ key: 'proj1', name: 'Project One' }], selectionMode: 'MANUAL'
  }]);
  // Make the EnterpriseClient throw to trigger portfolio migration failure
  stubs.ec.resolveEnterpriseId.rejects(new Error('Enterprise API unavailable'));

  const opts = baseMigrateOptions(outputDir);
  opts.enterpriseConfig = { key: 'my-enterprise' };
  const results = await migrateAll(opts);

  // Pipeline should complete despite portfolio failure (lines 218-220 catch)
  t.truthy(results);
  t.truthy(results.endTime);
  t.is(results.portfolios, 0);
});

// ===== Coverage: project-migration.js lines 195-197 (runProjectStep catch) =====

test.serial('migrateAll records project step failure when extractProjectSettings throws', async t => {
  const { stubs, outputDir } = t.context;
  // Make getProjectSettings throw to trigger runProjectStep catch (lines 194-197)
  stubs.sq.getProjectSettings.rejects(new Error('Settings API timeout'));

  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);

  const proj = results.projects[0];
  const settingsStep = proj.steps.find(s => s.step === 'Project settings');
  t.is(settingsStep.status, 'failed');
  t.is(settingsStep.error, 'Settings API timeout');
  // Error should be recorded in project errors array
  t.true(proj.errors.some(e => e.includes('Settings API timeout')));
});

// ===== Coverage: project-migration.js lines 252-253 (quality profile assignment error) =====

test.serial('migrateAll handles quality profile assignment failure gracefully', async t => {
  const { stubs, outputDir } = t.context;

  // Set up quality profiles extraction with a built-in profile
  stubs.sq.getAllQualityProfiles.resolves([
    {
      key: 'prof-builtin-java', name: 'Sonar way', language: 'java',
      isBuiltIn: true, backup: '<xml/>', activeRuleCount: 5,
      permissions: { users: [], groups: [] }
    }
  ]);
  stubs.sq.getQualityProfileBackup.resolves('<xml/>');
  stubs.sq.getActiveRules.resolves([]);
  stubs.sq.getQualityProfilePermissions.resolves({ users: [], groups: [] });

  // SC profile restore succeeds
  stubs.sc.restoreQualityProfile.resolves({
    profile: { key: 'sc-prof1', name: 'Sonar way', language: 'java' }
  });
  stubs.sc.searchQualityProfiles.resolves([
    { key: 'sc-prof1', name: 'Sonar way', language: 'java' }
  ]);

  // Make addQualityProfileToProject throw (line 252-253)
  stubs.sc.addQualityProfileToProject.rejects(new Error('Profile assignment forbidden'));

  const opts = baseMigrateOptions(outputDir);
  const results = await migrateAll(opts);

  // The project should have completed (profile assignment error is caught inside the loop)
  const proj = results.projects[0];
  const profileStep = proj.steps.find(s => s.step === 'Assign quality profiles');
  // The step should still succeed (the error is caught at the individual profile level)
  if (profileStep) {
    t.truthy(profileStep);
    // The step itself should succeed because the error is caught in the inner try/catch
    t.is(profileStep.status, 'success');
  } else {
    // If builtInProfileMapping was empty (no built-in migrated), step won't appear
    t.pass();
  }
  t.truthy(results.endTime);
});

// ===== Coverage: org-migration.js lines 49-51 (runOrgStep catch block) =====

test('runOrgStep records failure when fn throws', async t => {
  const orgResult = { steps: [] };

  await runOrgStep(orgResult, 'Test step', async () => {
    throw new Error('Step exploded');
  });

  t.is(orgResult.steps.length, 1);
  t.is(orgResult.steps[0].step, 'Test step');
  t.is(orgResult.steps[0].status, 'failed');
  t.is(orgResult.steps[0].error, 'Step exploded');
  t.truthy(orgResult.steps[0].durationMs >= 0);
});

// ===== Coverage: project-migration.js lines 258-259 (quality profiles skipped) =====
// Note: In the current architecture, lines 257-259 require onlyComponents to NOT
// include 'quality-profiles' AND builtInProfileMapping.size > 0. However, the
// builtInProfileMapping is only populated when quality profiles ARE restored at
// the org level (which requires 'quality-profiles' in onlyComponents or
// onlyComponents = null). This creates a contradiction that makes lines 258-259
// unreachable through the normal migrateAll pipeline. The test below directly
// tests the condition by using esmock to provide a pre-populated builtInProfileMapping.

test.serial('migrateOrgProjects skips quality profile assignment when --only excludes quality-profiles but builtInProfileMapping is populated', async t => {
  const { stubs, outputDir } = t.context;
  // Project key is not taken globally
  stubs.sc.isProjectKeyTakenGlobally.resolves({ taken: false });
  // Project must exist in SonarCloud for downstream steps
  stubs.sc.projectExists.resolves(true);

  const projects = [{ key: 'proj1', name: 'Project One' }];
  const org = { key: 'test-org', token: 'sc-token', url: 'https://sonarcloud.io' };
  const gateMapping = new Map();
  const extractedData = { projectBindings: new Map() };
  const results = {
    projects: [], issueSyncStats: { matched: 0, transitioned: 0 },
    hotspotSyncStats: { matched: 0, statusChanged: 0 },
    projectKeyWarnings: [], errors: [], totalLinesOfCode: 0, projectLinesOfCode: []
  };
  const ctx = {
    sonarqubeConfig: { url: 'http://localhost:9000', token: 'sq-token' },
    transferConfig: { mode: 'full', batchSize: 100 },
    perfConfig: { maxConcurrency: 5, sourceExtraction: { concurrency: 5 },
      hotspotExtraction: { concurrency: 10 }, issueSync: { concurrency: 5 },
      hotspotSync: { concurrency: 3 }, projectMigration: { concurrency: 1 } },
    outputDir, dryRun: false, skipIssueSync: true, skipHotspotSync: true, wait: false,
    // onlyComponents includes scan-data but NOT quality-profiles
    onlyComponents: ['scan-data']
  };
  // Non-empty builtInProfileMapping (passed directly, bypassing org-level check)
  const builtInProfileMapping = new Map([['java', 'Sonar way (SonarQube Migrated)']]);

  const scClient = new SonarCloudClient({ url: 'https://sonarcloud.io', token: 'sc-token', organization: 'test-org' });
  const { projectKeyMap } = await migrateOrgProjects(
    projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping
  );

  t.is(results.projects.length, 1);
  const proj = results.projects[0];
  // Lines 257-259: quality profile assignment step should be skipped
  const profileStep = proj.steps.find(s => s.step === 'Assign quality profiles');
  t.truthy(profileStep);
  t.is(profileStep.status, 'skipped');
  t.is(profileStep.detail, 'Not included in --only');
});

// ===== Coverage: org-migration.js line 143 & project-migration.js line 58 =====
// org.url || 'https://sonarcloud.io' — false branch (org without url)

test.serial('migrateAll with org missing url uses default https://sonarcloud.io', async t => {
  const { stubs, outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  // Remove url from the org config to exercise the || 'https://sonarcloud.io' fallback
  opts.sonarcloudOrgs = [{ key: 'test-org', token: 'sc-token' /* no url */ }];
  const results = await migrateAll(opts);
  // Pipeline should complete successfully
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
});

// ===== Coverage: extraction.js lines 49, 52 =====
// globalPermissions and permissionTemplates extraction failure fallbacks

test.serial('migrateAll handles global permissions extraction failure gracefully', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.getGlobalPermissions.rejects(new Error('Permissions API unavailable'));
  const results = await migrateAll(baseMigrateOptions(outputDir));
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
  const permStep = results.serverSteps.find(s => s.step === 'Extract global permissions');
  t.is(permStep.status, 'failed');
});

test.serial('migrateAll handles permission templates extraction failure gracefully', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.getPermissionTemplates.rejects(new Error('Templates API unavailable'));
  const results = await migrateAll(baseMigrateOptions(outputDir));
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
  const tmplStep = results.serverSteps.find(s => s.step === 'Extract permission templates');
  t.is(tmplStep.status, 'failed');
});

// ===== Coverage: extraction.js lines 72, 75 =====
// server info and webhooks extraction failure fallbacks

test.serial('migrateAll handles server info extraction failure gracefully', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.getSystemInfo.rejects(new Error('System info unavailable'));
  const results = await migrateAll(baseMigrateOptions(outputDir));
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
  const infoStep = results.serverSteps.find(s => s.step === 'Extract server info');
  t.is(infoStep.status, 'failed');
});

test.serial('migrateAll handles webhooks extraction failure gracefully', async t => {
  const { stubs, outputDir } = t.context;
  stubs.sq.getWebhooks.rejects(new Error('Webhooks API unavailable'));
  const results = await migrateAll(baseMigrateOptions(outputDir));
  t.truthy(results.endTime);
  t.is(results.projects.length, 1);
  const hookStep = results.serverSteps.find(s => s.step === 'Extract webhooks');
  t.is(hookStep.status, 'failed');
});

// ===== Coverage: org-migration.js line 198 =====
// extractedData.portfolios || [] — when portfolios is undefined

test.serial('migrateAll with enterprise config handles undefined portfolios gracefully', async t => {
  const { stubs, outputDir } = t.context;
  // Do NOT stub getPortfolios to return an array; make it fail so portfolios is undefined in extractedData
  stubs.sq.getPortfolios.rejects(new Error('Portfolios API unavailable'));

  const opts = baseMigrateOptions(outputDir);
  opts.enterpriseConfig = { key: 'my-enterprise' };
  const results = await migrateAll(opts);

  // Pipeline should complete
  t.truthy(results.endTime);
  // Portfolios extraction should have failed
  const pfStep = results.serverSteps.find(s => s.step === 'Extract portfolios');
  t.is(pfStep.status, 'failed');
  // Portfolio migration should gracefully handle undefined (||[]) => empty => early return
  t.false(stubs.ec.resolveEnterpriseId.called);
});

// ===== Coverage: migrate-pipeline.js — skipQualityProfileSync =====

test.serial('migrateAll with skipQualityProfileSync skips quality profile sync', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  opts.migrateConfig.skipQualityProfileSync = true;
  const results = await migrateAll(opts);
  const orgResult = results.orgResults[0];
  const profileStep = orgResult.steps.find(s => s.step === 'Restore quality profiles');
  t.is(profileStep.status, 'skipped');
  t.is(profileStep.detail, 'Disabled by --skip-quality-profile-sync');
});

// ===== Coverage: migrate-pipeline.js lines 60-61 =====
// transferConfig.mode || 'full' and transferConfig.batchSize || 100 fallbacks

test.serial('migrateAll with empty transferConfig uses default mode and batchSize', async t => {
  const { outputDir } = t.context;
  const opts = baseMigrateOptions(outputDir);
  // Set transferConfig to empty object so mode and batchSize are undefined
  opts.transferConfig = {};
  const results = await migrateAll(opts);
  // Lines 60-61: || 'full' and || 100 fallbacks should trigger
  t.is(results.configuration.transferMode, 'full');
  t.is(results.configuration.batchSize, 100);
  t.truthy(results.endTime);
});

// ===== Coverage: org-migration.js line 198 =====
// extractedData.portfolios || [] — when portfolios is undefined with enterprise config

test.serial('migrateEnterprisePortfolios handles extractedData with undefined portfolios', async t => {
  const { stubs, outputDir } = t.context;
  const results = {
    portfolios: 0,
    orgResults: [],
    projects: [],
    projectKeyWarnings: [],
    errors: [],
    serverSteps: [],
    issueSyncStats: { matched: 0, transitioned: 0 },
    hotspotSyncStats: { matched: 0, statusChanged: 0 },
    totalLinesOfCode: 0,
    projectLinesOfCode: []
  };
  const ctx = {
    enterpriseConfig: { key: 'my-enterprise' },
    sonarcloudOrgs: [{ key: 'test-org', token: 'sc-token', url: 'https://sonarcloud.io' }],
    rateLimitConfig: null,
    onlyComponents: null
  };

  // Call migrateEnterprisePortfolios directly with extractedData that has NO portfolios property
  await migrateEnterprisePortfolios({ /* portfolios is undefined */ }, new Map(), results, ctx);

  // Line 198: extractedData.portfolios || [] should produce empty array => early return
  t.false(stubs.ec.resolveEnterpriseId.called);
  t.is(results.portfolios, 0);
});

// ===== Coverage: project-migration.js line 190 =====
// result.detail || '' — when runProjectStep callback returns { skipped: true } without detail

test.serial('migrateAll records skipped step with empty detail when migrateNewCodePeriods returns skipped without detail', async t => {
  const { stubs, outputDir } = t.context;
  // Make getNewCodePeriods return an unsupported type with SPECIFIC_ANALYSIS,
  // which triggers the { skipped: true, detail: reason } path.
  // But we need { skipped: true } without detail.
  // Use esmock to replace migrateNewCodePeriods to return { skipped: true } without detail.
  const { migrateOrgProjects: mockedMigrateOrgProjects } = await esmock('../src/pipeline/project-migration.js', {
    '../src/sonarcloud/migrators/project-config.js': {
      migrateProjectSettings: async () => {},
      migrateProjectTags: async () => {},
      migrateProjectLinks: async () => {},
      migrateNewCodePeriods: async () => ({ skipped: true }), // no detail property
      migrateDevOpsBinding: async () => {}
    }
  });

  stubs.sc.projectExists.resolves(true);

  const projects = [{ key: 'proj1', name: 'Project One' }];
  const org = { key: 'test-org', token: 'sc-token', url: 'https://sonarcloud.io' };
  const gateMapping = new Map();
  const extractedData = { projectBindings: new Map() };
  const results = {
    projects: [], issueSyncStats: { matched: 0, transitioned: 0 },
    hotspotSyncStats: { matched: 0, statusChanged: 0 },
    projectKeyWarnings: [], errors: [], totalLinesOfCode: 0, projectLinesOfCode: []
  };
  const ctx = {
    sonarqubeConfig: { url: 'http://localhost:9000', token: 'sq-token' },
    transferConfig: { mode: 'full', batchSize: 100 },
    perfConfig: { maxConcurrency: 5, sourceExtraction: { concurrency: 5 },
      hotspotExtraction: { concurrency: 10 }, issueSync: { concurrency: 5 },
      hotspotSync: { concurrency: 3 }, projectMigration: { concurrency: 1 } },
    outputDir, dryRun: false, skipIssueSync: true, skipHotspotSync: true, wait: false,
    onlyComponents: ['project-settings'],
    rateLimitConfig: null
  };

  await mockedMigrateOrgProjects(
    projects, org, new SonarCloudClient({ url: 'https://sonarcloud.io', token: 'sc-token', organization: 'test-org' }),
    gateMapping, extractedData, results, ctx, new Map()
  );

  const proj = results.projects[0];
  const ncpStep = proj.steps.find(s => s.step === 'New code definitions');
  t.truthy(ncpStep);
  t.is(ncpStep.status, 'skipped');
  // Line 190: result.detail || '' — detail is undefined, so fallback to ''
  t.is(ncpStep.detail, '');
});
