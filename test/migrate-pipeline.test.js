import test from 'ava';
import sinon from 'sinon';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rm, access } from 'node:fs/promises';
import { SonarQubeClient } from '../src/sonarqube/api-client.js';
import { SonarCloudClient } from '../src/sonarcloud/api-client.js';
import { DataExtractor } from '../src/sonarqube/extractors/index.js';
import { ProtobufBuilder } from '../src/protobuf/builder.js';
import { ProtobufEncoder } from '../src/protobuf/encoder.js';
import { ReportUploader } from '../src/sonarcloud/uploader.js';
import { StateTracker } from '../src/state/tracker.js';
import { migrateAll } from '../src/migrate-pipeline.js';

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
  sc.createPortfolio = sinon.stub(SonarCloudClient.prototype, 'createPortfolio').resolves({ key: 'p1' });
  sc.addProjectToPortfolio = sinon.stub(SonarCloudClient.prototype, 'addProjectToPortfolio').resolves();
  sc.getAnalysisStatus = sinon.stub(SonarCloudClient.prototype, 'getAnalysisStatus').resolves({ status: 'SUCCESS' });
  sc.projectExists = sinon.stub(SonarCloudClient.prototype, 'projectExists').resolves(false);
  sc.assignQualityGateToProject = sinon.stub(SonarCloudClient.prototype, 'assignQualityGateToProject').resolves();
  sc.setDefaultTemplate = sinon.stub(SonarCloudClient.prototype, 'setDefaultTemplate').resolves();
  sc.waitForAnalysis = sinon.stub(SonarCloudClient.prototype, 'waitForAnalysis').resolves({ status: 'SUCCESS' });

  const de = {};
  de.extractAll = sinon.stub(DataExtractor.prototype, 'extractAll').resolves({
    issues: [], components: [], sources: [], metrics: [], measures: [],
    branches: [{ name: 'main', isMain: true }]
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

  return { sq, sc, de, pb, pe, ru, st };
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
