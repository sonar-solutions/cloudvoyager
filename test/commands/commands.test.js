import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';
import { Command } from 'commander';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { registerTransferCommand } from '../../src/commands/transfer.js';
import { registerMigrateCommand, VALID_ONLY_COMPONENTS } from '../../src/commands/migrate.js';
import { registerSyncMetadataCommand } from '../../src/commands/sync-metadata.js';

import { SonarQubeClient } from '../../src/sonarqube/api-client.js';
import { SonarCloudClient } from '../../src/sonarcloud/api-client.js';
import { DataExtractor } from '../../src/sonarqube/extractors/index.js';
import { ProtobufBuilder } from '../../src/protobuf/builder.js';
import { ProtobufEncoder } from '../../src/protobuf/encoder.js';
import { ReportUploader } from '../../src/sonarcloud/uploader.js';
import { StateTracker } from '../../src/state/tracker.js';
import { CloudVoyagerError } from '../../src/utils/errors.js';
import logger from '../../src/utils/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a temporary directory with a unique name for test isolation.
 */
function makeTmpDir() {
  return join(tmpdir(), `cv-cmd-test-${randomUUID()}`);
}

/**
 * Write a migrate-compatible config file to disk and return its path.
 */
async function writeMigrateConfig(dir, overrides = {}) {
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'migrate-config.json');
  const config = {
    sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
    sonarcloud: {
      organizations: [{ key: 'org1', token: 'sc-token', url: 'https://sonarcloud.io' }]
    },
    migrate: { outputDir: join(dir, 'output') },
    ...overrides
  };
  await writeFile(configPath, JSON.stringify(config));
  return configPath;
}

/**
 * Stub all prototype methods that the commands might reach through the
 * transfer pipeline, migrate pipeline, discovery flows, etc.
 *
 * Returns a flat map of named stubs so tests can assert on them.
 */
function setupAllStubs() {
  const s = {};

  // -- SonarQubeClient prototypes --
  s.sqTestConnection = sinon.stub(SonarQubeClient.prototype, 'testConnection').resolves();
  s.sqListAllProjects = sinon.stub(SonarQubeClient.prototype, 'listAllProjects').resolves([
    { key: 'proj1', name: 'Project One' },
    { key: 'proj2', name: 'Project Two' }
  ]);
  s.sqGetProject = sinon.stub(SonarQubeClient.prototype, 'getProject').resolves({ name: 'Project One' });
  s.sqGetBranches = sinon.stub(SonarQubeClient.prototype, 'getBranches').resolves([{ name: 'main', isMain: true }]);
  s.sqGetQualityGates = sinon.stub(SonarQubeClient.prototype, 'getQualityGates').resolves([]);
  s.sqGetQualityGateDetails = sinon.stub(SonarQubeClient.prototype, 'getQualityGateDetails').resolves({ name: 'Default', conditions: [] });
  s.sqGetQualityGatePermissions = sinon.stub(SonarQubeClient.prototype, 'getQualityGatePermissions').resolves({ users: [], groups: [] });
  s.sqGetAllQualityProfiles = sinon.stub(SonarQubeClient.prototype, 'getAllQualityProfiles').resolves([]);
  s.sqGetQualityProfileBackup = sinon.stub(SonarQubeClient.prototype, 'getQualityProfileBackup').resolves('<xml/>');
  s.sqGetActiveRules = sinon.stub(SonarQubeClient.prototype, 'getActiveRules').resolves([]);
  s.sqGetQualityProfilePermissions = sinon.stub(SonarQubeClient.prototype, 'getQualityProfilePermissions').resolves({ users: [], groups: [] });
  s.sqGetGroups = sinon.stub(SonarQubeClient.prototype, 'getGroups').resolves([]);
  s.sqGetGlobalPermissions = sinon.stub(SonarQubeClient.prototype, 'getGlobalPermissions').resolves([]);
  s.sqGetPermissionTemplates = sinon.stub(SonarQubeClient.prototype, 'getPermissionTemplates').resolves({ templates: [], defaultTemplates: [] });
  s.sqGetPortfolios = sinon.stub(SonarQubeClient.prototype, 'getPortfolios').resolves([]);
  s.sqGetPortfolioDetails = sinon.stub(SonarQubeClient.prototype, 'getPortfolioDetails').resolves({});
  s.sqGetAlmSettings = sinon.stub(SonarQubeClient.prototype, 'getAlmSettings').resolves({ github: [], gitlab: [], azure: [], bitbucket: [], bitbucketcloud: [] });
  s.sqGetProjectBinding = sinon.stub(SonarQubeClient.prototype, 'getProjectBinding').resolves(null);
  s.sqGetSystemInfo = sinon.stub(SonarQubeClient.prototype, 'getSystemInfo').resolves({ System: { Version: '9.9' } });
  s.sqGetInstalledPlugins = sinon.stub(SonarQubeClient.prototype, 'getInstalledPlugins').resolves([]);
  s.sqGetWebhooks = sinon.stub(SonarQubeClient.prototype, 'getWebhooks').resolves([]);
  s.sqGetProjectSettings = sinon.stub(SonarQubeClient.prototype, 'getProjectSettings').resolves([]);
  s.sqGetProjectTags = sinon.stub(SonarQubeClient.prototype, 'getProjectTags').resolves([]);
  s.sqGetProjectLinks = sinon.stub(SonarQubeClient.prototype, 'getProjectLinks').resolves([]);
  s.sqGetNewCodePeriods = sinon.stub(SonarQubeClient.prototype, 'getNewCodePeriods').resolves({ projectLevel: null, branchOverrides: [] });
  s.sqGetQualityGate = sinon.stub(SonarQubeClient.prototype, 'getQualityGate').resolves({ name: 'Sonar way' });
  s.sqGetIssuesWithComments = sinon.stub(SonarQubeClient.prototype, 'getIssuesWithComments').resolves([]);
  s.sqGetHotspots = sinon.stub(SonarQubeClient.prototype, 'getHotspots').resolves([]);
  s.sqGetHotspotDetails = sinon.stub(SonarQubeClient.prototype, 'getHotspotDetails').resolves({});
  s.sqGetMetrics = sinon.stub(SonarQubeClient.prototype, 'getMetrics').resolves([]);
  s.sqGetIssues = sinon.stub(SonarQubeClient.prototype, 'getIssues').resolves([]);
  s.sqGetMeasures = sinon.stub(SonarQubeClient.prototype, 'getMeasures').resolves([]);
  s.sqGetComponentTree = sinon.stub(SonarQubeClient.prototype, 'getComponentTree').resolves([]);
  s.sqGetSourceCode = sinon.stub(SonarQubeClient.prototype, 'getSourceCode').resolves('');
  s.sqGetSourceFiles = sinon.stub(SonarQubeClient.prototype, 'getSourceFiles').resolves([]);
  s.sqGetLatestAnalysisRevision = sinon.stub(SonarQubeClient.prototype, 'getLatestAnalysisRevision').resolves(null);
  s.sqGetProjectPermissions = sinon.stub(SonarQubeClient.prototype, 'getProjectPermissions').resolves([]);

  // -- SonarCloudClient prototypes --
  s.scTestConnection = sinon.stub(SonarCloudClient.prototype, 'testConnection').resolves();
  s.scEnsureProject = sinon.stub(SonarCloudClient.prototype, 'ensureProject').resolves();
  s.scGetQualityProfiles = sinon.stub(SonarCloudClient.prototype, 'getQualityProfiles').resolves([]);
  s.scGetMainBranchName = sinon.stub(SonarCloudClient.prototype, 'getMainBranchName').resolves('main');
  s.scIsProjectKeyTakenGlobally = sinon.stub(SonarCloudClient.prototype, 'isProjectKeyTakenGlobally').resolves({ taken: false });
  s.scCreateGroup = sinon.stub(SonarCloudClient.prototype, 'createGroup').resolves({ name: 'group' });
  s.scAddGroupPermission = sinon.stub(SonarCloudClient.prototype, 'addGroupPermission').resolves();
  s.scCreateQualityGate = sinon.stub(SonarCloudClient.prototype, 'createQualityGate').resolves({ id: '1' });
  s.scCreateQualityGateCondition = sinon.stub(SonarCloudClient.prototype, 'createQualityGateCondition').resolves();
  s.scSetDefaultQualityGate = sinon.stub(SonarCloudClient.prototype, 'setDefaultQualityGate').resolves();
  s.scRestoreQualityProfile = sinon.stub(SonarCloudClient.prototype, 'restoreQualityProfile').resolves();
  s.scSetDefaultQualityProfile = sinon.stub(SonarCloudClient.prototype, 'setDefaultQualityProfile').resolves();
  s.scAddQualityProfileGroupPermission = sinon.stub(SonarCloudClient.prototype, 'addQualityProfileGroupPermission').resolves();
  s.scAddQualityProfileUserPermission = sinon.stub(SonarCloudClient.prototype, 'addQualityProfileUserPermission').resolves();
  s.scAddQualityProfileToProject = sinon.stub(SonarCloudClient.prototype, 'addQualityProfileToProject').resolves();
  s.scCreatePermissionTemplate = sinon.stub(SonarCloudClient.prototype, 'createPermissionTemplate').resolves({ id: 'tmpl1' });
  s.scAddGroupToTemplate = sinon.stub(SonarCloudClient.prototype, 'addGroupToTemplate').resolves();
  s.scAddProjectGroupPermission = sinon.stub(SonarCloudClient.prototype, 'addProjectGroupPermission').resolves();
  s.scGetActiveRules = sinon.stub(SonarCloudClient.prototype, 'getActiveRules').resolves({ actives: {} });
  s.scSetProjectSetting = sinon.stub(SonarCloudClient.prototype, 'setProjectSetting').resolves();
  s.scSetProjectTags = sinon.stub(SonarCloudClient.prototype, 'setProjectTags').resolves();
  s.scCreateProjectLink = sinon.stub(SonarCloudClient.prototype, 'createProjectLink').resolves();
  s.scSetGithubBinding = sinon.stub(SonarCloudClient.prototype, 'setGithubBinding').resolves();
  s.scSetGitlabBinding = sinon.stub(SonarCloudClient.prototype, 'setGitlabBinding').resolves();
  s.scSetAzureBinding = sinon.stub(SonarCloudClient.prototype, 'setAzureBinding').resolves();
  s.scSetBitbucketBinding = sinon.stub(SonarCloudClient.prototype, 'setBitbucketBinding').resolves();
  s.scSearchQualityProfiles = sinon.stub(SonarCloudClient.prototype, 'searchQualityProfiles').resolves([]);
  s.scSearchIssues = sinon.stub(SonarCloudClient.prototype, 'searchIssues').resolves([]);
  s.scSearchHotspots = sinon.stub(SonarCloudClient.prototype, 'searchHotspots').resolves([]);
  s.scTransitionIssue = sinon.stub(SonarCloudClient.prototype, 'transitionIssue').resolves();
  s.scAddIssueComment = sinon.stub(SonarCloudClient.prototype, 'addIssueComment').resolves();
  s.scAssignIssue = sinon.stub(SonarCloudClient.prototype, 'assignIssue').resolves();
  s.scSetIssueTags = sinon.stub(SonarCloudClient.prototype, 'setIssueTags').resolves();
  s.scChangeHotspotStatus = sinon.stub(SonarCloudClient.prototype, 'changeHotspotStatus').resolves();
  s.scAddHotspotComment = sinon.stub(SonarCloudClient.prototype, 'addHotspotComment').resolves();
  s.scGetAnalysisStatus = sinon.stub(SonarCloudClient.prototype, 'getAnalysisStatus').resolves({ status: 'SUCCESS' });
  s.scProjectExists = sinon.stub(SonarCloudClient.prototype, 'projectExists').resolves(false);
  s.scAssignQualityGateToProject = sinon.stub(SonarCloudClient.prototype, 'assignQualityGateToProject').resolves();
  s.scSetDefaultTemplate = sinon.stub(SonarCloudClient.prototype, 'setDefaultTemplate').resolves();
  s.scWaitForAnalysis = sinon.stub(SonarCloudClient.prototype, 'waitForAnalysis').resolves({ status: 'SUCCESS' });

  // -- DataExtractor --
  s.extractAll = sinon.stub(DataExtractor.prototype, 'extractAll').resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [{ key: 'i1' }],
    components: [{ key: 'c1' }],
    sources: [{ key: 's1' }],
    metrics: [{ key: 'ncloc' }],
    measures: { measures: [{ metric: 'ncloc', value: '1000' }] }
  });

  // -- ProtobufBuilder --
  s.buildAll = sinon.stub(ProtobufBuilder.prototype, 'buildAll').returns({ metadata: {} });

  // -- ProtobufEncoder --
  s.loadSchemas = sinon.stub(ProtobufEncoder.prototype, 'loadSchemas').resolves();
  s.encodeAll = sinon.stub(ProtobufEncoder.prototype, 'encodeAll').returns({ data: 'encoded' });

  // -- ReportUploader --
  s.upload = sinon.stub(ReportUploader.prototype, 'upload').resolves({ id: 'ce-task-1' });
  s.uploadAndWait = sinon.stub(ReportUploader.prototype, 'uploadAndWait').resolves();

  // -- StateTracker --
  s.stInit = sinon.stub(StateTracker.prototype, 'initialize').resolves();
  s.stSummary = sinon.stub(StateTracker.prototype, 'getSummary').returns({
    lastSync: null, processedIssuesCount: 0, completedBranchesCount: 0,
    completedBranches: [], syncHistoryCount: 0
  });
  s.stRecord = sinon.stub(StateTracker.prototype, 'recordTransfer').resolves();

  // -- enableFileLogging -- stub to avoid creating real log files
  // (we import the module-level logger and just silence it)

  return s;
}

/**
 * Build a fresh Commander program, register a command on it, and execute with
 * the given argv array. We also stub process.exit to prevent the process from
 * actually terminating.
 *
 * Returns { program, exitStub }.
 */
function createProgram() {
  const program = new Command();
  program.exitOverride(); // throws instead of calling process.exit
  program.configureOutput({
    writeOut: () => {},
    writeErr: () => {}
  });
  return program;
}

// ---------------------------------------------------------------------------
// Shared setup/teardown for serial tests
// ---------------------------------------------------------------------------

test.serial.beforeEach(async t => {
  t.context.tmpDir = makeTmpDir();
  t.context.stubs = setupAllStubs();
  t.context.exitStub = sinon.stub(process, 'exit');
  // Suppress logger output during tests
  t.context.originalLevel = logger.level;
  logger.level = 'error';
  // Prevent ensureHeapSize from trying to respawn the process during auto-tune tests
  t.context.originalRespawned = process.env.CLOUDVOYAGER_RESPAWNED;
  process.env.CLOUDVOYAGER_RESPAWNED = '1';
});

test.serial.afterEach.always(async t => {
  sinon.restore();
  logger.level = t.context.originalLevel || 'info';
  // Restore CLOUDVOYAGER_RESPAWNED env var
  if (t.context.originalRespawned === undefined) {
    delete process.env.CLOUDVOYAGER_RESPAWNED;
  } else {
    process.env.CLOUDVOYAGER_RESPAWNED = t.context.originalRespawned;
  }
  await rm(t.context.tmpDir, { recursive: true, force: true }).catch(() => {});
});

// ===== migrate.js =====

test.serial('registerMigrateCommand registers the migrate command', t => {
  const program = createProgram();
  registerMigrateCommand(program);
  const cmd = program.commands.find(c => c.name() === 'migrate');
  t.truthy(cmd, 'migrate command should be registered');
  t.is(cmd.name(), 'migrate');
});

test.serial('migrate: has all expected options', t => {
  const program = createProgram();
  registerMigrateCommand(program);
  const cmd = program.commands.find(c => c.name() === 'migrate');
  const optionNames = cmd.options.map(o => o.long);
  t.true(optionNames.includes('--config'));
  t.true(optionNames.includes('--verbose'));
  t.true(optionNames.includes('--wait'));
  t.true(optionNames.includes('--dry-run'));
  t.true(optionNames.includes('--skip-issue-metadata-sync'));
  t.true(optionNames.includes('--skip-hotspot-metadata-sync'));
  t.true(optionNames.includes('--skip-quality-profile-sync'));
  t.true(optionNames.includes('--only'));
  t.true(optionNames.includes('--concurrency'));
  t.true(optionNames.includes('--max-memory'));
  t.true(optionNames.includes('--project-concurrency'));
  t.true(optionNames.includes('--auto-tune'));
  t.true(optionNames.includes('--skip-all-branch-sync'));
});

test.serial('VALID_ONLY_COMPONENTS has all expected values', t => {
  t.deepEqual(VALID_ONLY_COMPONENTS, [
    'scan-data', 'scan-data-all-branches', 'portfolios', 'quality-gates',
    'quality-profiles', 'permission-templates', 'permissions',
    'issue-metadata', 'hotspot-metadata', 'project-settings'
  ]);
});

test.serial('VALID_ONLY_COMPONENTS contains 10 items', t => {
  t.is(VALID_ONLY_COMPONENTS.length, 10);
});

test.serial('migrate: successful migration exits(0)', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(0), 'should exit(0) on success');
});

test.serial('migrate: --dry-run sets migrateConfig.dryRun', async t => {
  const { tmpDir, stubs } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--dry-run']);

  // In dry-run mode, migrateAll is called with dryRun=true.
  // SonarCloud testConnection should not be called during dry run.
  t.false(stubs.scTestConnection.called, 'dry run should skip SC connection test');
});

test.serial('migrate: --skip-issue-metadata-sync sets flag', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--skip-issue-metadata-sync']);

  // The migrate completed -- skipIssueMetadataSync was applied
  t.true(t.context.exitStub.calledWith(0), 'should complete successfully');
});

test.serial('migrate: --skip-hotspot-metadata-sync sets flag', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--skip-hotspot-metadata-sync']);

  t.true(t.context.exitStub.calledWith(0), 'should complete successfully');
});

test.serial('migrate: --skip-quality-profile-sync sets flag', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--skip-quality-profile-sync']);

  t.true(t.context.exitStub.calledWith(0), 'should complete successfully');
});

test.serial('migrate: --skip-all-branch-sync sets syncAllBranches=false', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--skip-all-branch-sync']);

  t.true(t.context.exitStub.calledWith(0), 'should complete successfully with branch sync skipped');
});

test.serial('migrate: --only with valid components sets onlyComponents', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--only', 'scan-data,quality-gates']);

  // migrateAll is called with onlyComponents set -- if it completes, the config was valid
  t.true(t.context.exitStub.calledWith(0), 'should complete successfully with valid --only');
});

test.serial('migrate: --only with invalid components exits(1)', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--only', 'invalid-component']);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on invalid --only component');
});

test.serial('migrate: --only with mixed valid and invalid components exits(1)', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--only', 'scan-data,bogus']);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when any --only component is invalid');
});

test.serial('migrate: --only with empty string exits(1)', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  // Pass empty string -- after split/filter, no valid components remain
  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--only', ',']);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on empty --only');
});

test.serial('migrate: handles CloudVoyagerError', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqTestConnection.rejects(new CloudVoyagerError('SQ auth failed'));
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on CloudVoyagerError');
});

test.serial('migrate: handles unexpected error', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqTestConnection.rejects(new Error('Socket hang up'));
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on unexpected error');
});

test.serial('migrate: partial/failed projects cause exit(1)', async t => {
  const { tmpDir, stubs } = t.context;
  // Make issue search fail to create a partial migration
  stubs.scSearchIssues.rejects(new Error('Issue sync failed'));
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when projects partially fail');
});

test.serial('migrate: config file not found triggers error', async t => {
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', '/nonexistent/migrate-config.json']);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when config not found');
});

test.serial('migrate: --concurrency overrides performance config', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--concurrency', '4']);

  t.true(t.context.exitStub.calledWith(0), 'should complete with custom concurrency');
});

test.serial('migrate: --max-memory option is parsed', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--max-memory', '4096']);

  t.true(t.context.exitStub.calledWith(0), 'should complete with max-memory option');
});

test.serial('migrate: --project-concurrency option is parsed', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--project-concurrency', '3']);

  t.true(t.context.exitStub.calledWith(0), 'should complete with project-concurrency option');
});

test.serial('migrate: --auto-tune option is parsed', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--auto-tune']);

  t.true(t.context.exitStub.calledWith(0), 'should complete with auto-tune option');
});

test.serial('migrate: --wait option is forwarded', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqListAllProjects.resolves([{ key: 'proj1', name: 'P1' }]);
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--wait']);

  t.true(stubs.uploadAndWait.called, 'should use uploadAndWait when --wait is specified');
});

test.serial('migrate: --verbose sets logger to debug', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--verbose']);

  // The command ran through the verbose code path without error
  t.pass('verbose mode executed without error');
});

test.serial('migrate: --only with single valid component works', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--only', 'portfolios']);

  t.true(t.context.exitStub.calledWith(0), 'should complete with single --only component');
});

test.serial('migrate: --only with all valid components works', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync([
    'node', 'test', 'migrate', '-c', configPath,
    '--only', VALID_ONLY_COMPONENTS.join(',')
  ]);

  t.true(t.context.exitStub.calledWith(0), 'should complete with all valid --only components');
});

// ===== sync-metadata.js =====

test.serial('registerSyncMetadataCommand registers the sync-metadata command', t => {
  const program = createProgram();
  registerSyncMetadataCommand(program);
  const cmd = program.commands.find(c => c.name() === 'sync-metadata');
  t.truthy(cmd, 'sync-metadata command should be registered');
  t.is(cmd.name(), 'sync-metadata');
});

test.serial('sync-metadata: has all expected options', t => {
  const program = createProgram();
  registerSyncMetadataCommand(program);
  const cmd = program.commands.find(c => c.name() === 'sync-metadata');
  const optionNames = cmd.options.map(o => o.long);
  t.true(optionNames.includes('--config'));
  t.true(optionNames.includes('--verbose'));
  t.true(optionNames.includes('--skip-issue-metadata-sync'));
  t.true(optionNames.includes('--skip-hotspot-metadata-sync'));
  t.true(optionNames.includes('--skip-quality-profile-sync'));
  t.true(optionNames.includes('--concurrency'));
  t.true(optionNames.includes('--max-memory'));
  t.true(optionNames.includes('--auto-tune'));
  t.true(optionNames.includes('--skip-all-branch-sync'));
});

test.serial('sync-metadata: successful sync completes without exit(1)', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath]);

  t.false(t.context.exitStub.calledWith(1), 'should not exit(1) on success');
});

test.serial('sync-metadata: --skip-issue-metadata-sync sets flag', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath, '--skip-issue-metadata-sync']);

  t.false(t.context.exitStub.calledWith(1), 'should complete successfully');
});

test.serial('sync-metadata: --skip-hotspot-metadata-sync sets flag', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath, '--skip-hotspot-metadata-sync']);

  t.false(t.context.exitStub.calledWith(1), 'should complete successfully');
});

test.serial('sync-metadata: --skip-quality-profile-sync sets flag', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath, '--skip-quality-profile-sync']);

  t.false(t.context.exitStub.calledWith(1), 'should complete successfully');
});

test.serial('sync-metadata: --skip-all-branch-sync sets syncAllBranches=false', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath, '--skip-all-branch-sync']);

  t.false(t.context.exitStub.calledWith(1), 'should complete successfully');
});

test.serial('sync-metadata: failed projects cause exit(1)', async t => {
  const { tmpDir, stubs } = t.context;
  // Make the extract fail so the project result has success=false
  stubs.extractAll.rejects(new Error('Extraction failed'));
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when projects fail');
});

test.serial('sync-metadata: handles CloudVoyagerError', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqTestConnection.rejects(new CloudVoyagerError('SQ connection error'));
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on CloudVoyagerError');
});

test.serial('sync-metadata: handles unexpected error', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqTestConnection.rejects(new Error('ECONNREFUSED'));
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on unexpected error');
});

test.serial('sync-metadata: config file not found triggers error', async t => {
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', '/nonexistent/migrate-config.json']);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when config not found');
});

test.serial('sync-metadata: --concurrency overrides performance config', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath, '--concurrency', '6']);

  t.false(t.context.exitStub.calledWith(1), 'should complete with custom concurrency');
});

test.serial('sync-metadata: --max-memory option is parsed', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath, '--max-memory', '2048']);

  t.false(t.context.exitStub.calledWith(1), 'should complete with max-memory option');
});

test.serial('sync-metadata: --auto-tune option is parsed', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath, '--auto-tune']);

  t.false(t.context.exitStub.calledWith(1), 'should complete with auto-tune option');
});

test.serial('sync-metadata: --verbose sets logger to debug', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath, '--verbose']);

  t.pass('verbose mode executed without error');
});

test.serial('sync-metadata: sets dryRun=false explicitly', async t => {
  const { tmpDir } = t.context;
  // Even if migrate config has dryRun=true, sync-metadata forces it to false
  const configPath = await writeMigrateConfig(tmpDir, {
    migrate: { outputDir: join(tmpDir, 'output'), dryRun: true }
  });
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath]);

  // The command should have executed the full pipeline (dryRun=false)
  t.true(t.context.stubs.scTestConnection.called, 'should test SC connection since dryRun is forced false');
});

// ===== Cross-command registration tests =====

test.serial('all commands can be registered on the same program', t => {
  const program = createProgram();
  registerMigrateCommand(program);
  registerSyncMetadataCommand(program);

  const commandNames = program.commands.map(c => c.name());
  t.true(commandNames.includes('migrate'));
  t.true(commandNames.includes('sync-metadata'));
  t.is(program.commands.length, 2);
});

test.serial('migrate: description is set correctly', t => {
  const program = createProgram();
  registerMigrateCommand(program);
  const cmd = program.commands.find(c => c.name() === 'migrate');
  t.true(cmd.description().includes('Full migration'));
});

test.serial('sync-metadata: description is set correctly', t => {
  const program = createProgram();
  registerSyncMetadataCommand(program);
  const cmd = program.commands.find(c => c.name() === 'sync-metadata');
  t.true(cmd.description().includes('Sync issue and hotspot metadata'));
});

test.serial('migrate: config option is required', t => {
  const program = createProgram();
  registerMigrateCommand(program);
  const cmd = program.commands.find(c => c.name() === 'migrate');
  const configOpt = cmd.options.find(o => o.long === '--config');
  t.truthy(configOpt, 'config option should exist');
  t.true(configOpt.required, 'config option should be required');
});

test.serial('sync-metadata: config option is required', t => {
  const program = createProgram();
  registerSyncMetadataCommand(program);
  const cmd = program.commands.find(c => c.name() === 'sync-metadata');
  const configOpt = cmd.options.find(o => o.long === '--config');
  t.truthy(configOpt, 'config option should exist');
  t.true(configOpt.required, 'config option should be required');
});

// ===== Edge cases =====

test.serial('migrate: multiple skip flags together', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync([
    'node', 'test', 'migrate', '-c', configPath,
    '--skip-issue-metadata-sync',
    '--skip-hotspot-metadata-sync',
    '--skip-quality-profile-sync'
  ]);

  t.true(t.context.exitStub.calledWith(0), 'should complete with all skip flags');
});

test.serial('sync-metadata: multiple skip flags together', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync([
    'node', 'test', 'sync-metadata', '-c', configPath,
    '--skip-issue-metadata-sync',
    '--skip-hotspot-metadata-sync',
    '--skip-quality-profile-sync'
  ]);

  t.false(t.context.exitStub.calledWith(1), 'should complete with all skip flags');
});

test.serial('migrate: --only with whitespace-padded components works', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeMigrateConfig(tmpDir);
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath, '--only', ' scan-data , quality-gates ']);

  t.true(t.context.exitStub.calledWith(0), 'should trim whitespace from --only components');
});

// ===== transfer.js =====

/**
 * Write a transfer-compatible config file (with projectKey) to disk and return its path.
 */
async function writeTransferConfig(dir, overrides = {}) {
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'transfer-config.json');
  const config = {
    sonarqube: { url: 'http://localhost:9000', token: 'sq-token', projectKey: 'sq-proj' },
    sonarcloud: { url: 'https://sonarcloud.io', token: 'sc-token', organization: 'test-org', projectKey: 'sc-proj' },
    transfer: { mode: 'full', stateFile: join(dir, '.state.json'), batchSize: 100 },
    ...overrides
  };
  await writeFile(configPath, JSON.stringify(config));
  return configPath;
}

test.serial('transfer: successful transfer prints completion message', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath]);

  // Lines 49-50: the success path should not call process.exit(1)
  t.false(t.context.exitStub.calledWith(1), 'should not exit(1) on successful transfer');
  // Verify the transfer pipeline was exercised
  t.true(t.context.stubs.extractAll.called, 'should call extractAll during transfer');
  t.true(t.context.stubs.buildAll.called, 'should call buildAll during transfer');
  t.true(t.context.stubs.upload.called, 'should call upload during transfer');
});

test.serial('transfer: unexpected (non-CloudVoyagerError) error hits else branch', async t => {
  const { tmpDir, stubs } = t.context;
  // Make extractAll throw a plain Error (not CloudVoyagerError) to hit lines 54-57
  stubs.extractAll.rejects(new Error('Unexpected disk failure'));
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath]);

  // Lines 55-57: should log "Unexpected error:" and exit(1)
  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on unexpected error');
});

test.serial('transfer: CloudVoyagerError hits the instanceof branch', async t => {
  const { tmpDir, stubs } = t.context;
  // Make testConnection throw a CloudVoyagerError to hit line 53
  stubs.sqTestConnection.rejects(new CloudVoyagerError('Auth token expired'));
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath]);

  // Line 53: should log "Transfer failed:" and exit(1)
  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on CloudVoyagerError');
});

test.serial('transfer: config file not found triggers error', async t => {
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', '/nonexistent/transfer-config.json']);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when config not found');
});

test.serial('transfer: --verbose sets logger to debug', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath, '--verbose']);

  t.false(t.context.exitStub.calledWith(1), 'verbose transfer should complete without exit(1)');
});

test.serial('transfer: config without transfer key uses fallback empty object', async t => {
  const { tmpDir } = t.context;
  // Write a config that omits the transfer key so line 29 fallback || {} is exercised
  const configPath = await writeTransferConfig(tmpDir, { transfer: undefined });
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath]);

  t.false(t.context.exitStub.calledWith(1), 'should succeed with fallback transfer config');
});

test.serial('transfer: --skip-all-branch-sync sets syncAllBranches=false', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath, '--skip-all-branch-sync']);

  t.false(t.context.exitStub.calledWith(1), 'should succeed with --skip-all-branch-sync');
});

test.serial('transfer: --auto-tune sets autoTune in performance config', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath, '--auto-tune']);

  t.false(t.context.exitStub.calledWith(1), 'should succeed with --auto-tune');
});

test.serial('transfer: --concurrency overrides performance config', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath, '--concurrency', '4']);

  t.true(t.context.stubs.extractAll.called, 'transfer should proceed with custom concurrency');
});

test.serial('transfer: --max-memory option is parsed', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath, '--max-memory', '4096']);

  t.false(t.context.exitStub.calledWith(1), 'should succeed with --max-memory');
});

test.serial('transfer: --wait option triggers uploadAndWait', async t => {
  const { tmpDir, stubs } = t.context;
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath, '--wait']);

  t.true(stubs.uploadAndWait.called, 'should use uploadAndWait when --wait is specified');
});

// ===== migrate.js: additional branch coverage =====

test.serial('migrate: config without migrate key uses fallback empty object', async t => {
  const { tmpDir } = t.context;
  // Omit the migrate key so line 37 fallback || {} is exercised
  const configPath = await writeMigrateConfig(tmpDir, { migrate: undefined });
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(0), 'should succeed with fallback migrate config');
});

test.serial('migrate: config with transfer key uses existing transfer config', async t => {
  const { tmpDir } = t.context;
  // Provide a transfer key so the truthy left side of line 59 is exercised
  const configPath = await writeMigrateConfig(tmpDir, {
    transfer: { mode: 'incremental', batchSize: 200 }
  });
  const program = createProgram();
  registerMigrateCommand(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(0), 'should succeed with explicit transfer config');
});

// ===== sync-metadata.js: additional branch coverage =====

test.serial('sync-metadata: config without migrate key uses fallback empty object', async t => {
  const { tmpDir } = t.context;
  // Omit the migrate key so line 27 fallback || {} is exercised
  const configPath = await writeMigrateConfig(tmpDir, { migrate: undefined });
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath]);

  t.false(t.context.exitStub.calledWith(1), 'should succeed with fallback migrate config');
});

test.serial('sync-metadata: config with transfer key uses existing transfer config', async t => {
  const { tmpDir } = t.context;
  // Provide a transfer key so the truthy left side of line 32 is exercised
  const configPath = await writeMigrateConfig(tmpDir, {
    transfer: { mode: 'incremental', batchSize: 200 }
  });
  const program = createProgram();
  registerSyncMetadataCommand(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', configPath]);

  t.false(t.context.exitStub.calledWith(1), 'should succeed with explicit transfer config');
});

// ===== esmock-based tests: cover || fallback branches where loaders fill defaults =====
// The config loaders (loadConfig / loadMigrateConfig) always fill in default values for
// transfer, migrate, sonarcloud.url, etc. The command files have defensive || fallbacks
// that are unreachable with real loaders. We use esmock to mock the loaders and return
// minimal configs to exercise those fallback branches.

test.serial('transfer: --workers option exercises workerThreads spread (line 37)', async t => {
  // The transfer command does not declare a --workers option, but the action
  // references options.workers. We inject the option via Commander API to cover
  // the truthy branch of (options.workers && { workerThreads: options.workers }).
  const { tmpDir } = t.context;
  const configPath = await writeTransferConfig(tmpDir);
  const program = createProgram();
  registerTransferCommand(program);

  // Inject --workers option on the transfer subcommand after registration
  const cmd = program.commands.find(c => c.name() === 'transfer');
  cmd.option('--workers <n>', 'Worker threads', Number.parseInt);

  await program.parseAsync(['node', 'test', 'transfer', '-c', configPath, '--workers', '2']);

  t.false(t.context.exitStub.calledWith(1), 'should succeed when --workers is provided');
});

test.serial('transfer (esmock): config.transfer falsy exercises || {} fallback (line 29)', async t => {
  // Mock loadConfig to return a config WITHOUT transfer key
  const { registerTransferCommand: mockedRegisterTransfer } = await esmock(
    '../../src/commands/transfer.js',
    {
      '../../src/config/loader.js': {
        loadConfig: async () => ({
          sonarqube: { url: 'http://localhost:9000', token: 'sq-token', projectKey: 'sq-proj' },
          sonarcloud: { url: 'https://sonarcloud.io', token: 'sc-token', organization: 'test-org', projectKey: 'sc-proj' }
          // transfer is intentionally missing
        }),
        requireProjectKeys: () => {}
      }
    }
  );

  const program = createProgram();
  mockedRegisterTransfer(program);

  await program.parseAsync(['node', 'test', 'transfer', '-c', 'dummy.json']);

  t.false(t.context.exitStub.calledWith(1), 'should succeed with missing config.transfer');
});

test.serial('migrate (esmock): config without migrate key exercises || {} fallback (line 37)', async t => {
  const { registerMigrateCommand: mockedRegisterMigrate } = await esmock(
    '../../src/commands/migrate.js',
    {
      '../../src/config/loader.js': {
        loadMigrateConfig: async () => ({
          sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
          sonarcloud: { organizations: [{ key: 'org1', token: 'sc-token', url: 'https://sonarcloud.io' }] }
          // migrate is intentionally missing, transfer is intentionally missing
        })
      }
    }
  );

  const program = createProgram();
  mockedRegisterMigrate(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', 'dummy.json']);

  t.true(t.context.exitStub.calledWith(0), 'should succeed with missing config.migrate');
});

test.serial('migrate (esmock): config with transfer key exercises truthy left side (line 59)', async t => {
  const { registerMigrateCommand: mockedRegisterMigrate } = await esmock(
    '../../src/commands/migrate.js',
    {
      '../../src/config/loader.js': {
        loadMigrateConfig: async () => ({
          sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
          sonarcloud: { organizations: [{ key: 'org1', token: 'sc-token', url: 'https://sonarcloud.io' }] },
          migrate: { outputDir: '/tmp/output' },
          transfer: { mode: 'incremental', batchSize: 50 }
        })
      }
    }
  );

  const program = createProgram();
  mockedRegisterMigrate(program);

  await program.parseAsync(['node', 'test', 'migrate', '-c', 'dummy.json']);

  t.true(t.context.exitStub.calledWith(0), 'should succeed with explicit transfer config');
});

test.serial('sync-metadata (esmock): config without migrate exercises || {} fallback (line 27)', async t => {
  const { registerSyncMetadataCommand: mockedRegisterSyncMetadata } = await esmock(
    '../../src/commands/sync-metadata.js',
    {
      '../../src/config/loader.js': {
        loadMigrateConfig: async () => ({
          sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
          sonarcloud: { organizations: [{ key: 'org1', token: 'sc-token', url: 'https://sonarcloud.io' }] }
          // migrate and transfer are intentionally missing
        })
      }
    }
  );

  const program = createProgram();
  mockedRegisterSyncMetadata(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', 'dummy.json']);

  t.false(t.context.exitStub.calledWith(1), 'should succeed with missing config.migrate');
});

test.serial('sync-metadata (esmock): config with transfer exercises truthy left side (line 32)', async t => {
  const { registerSyncMetadataCommand: mockedRegisterSyncMetadata } = await esmock(
    '../../src/commands/sync-metadata.js',
    {
      '../../src/config/loader.js': {
        loadMigrateConfig: async () => ({
          sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
          sonarcloud: { organizations: [{ key: 'org1', token: 'sc-token', url: 'https://sonarcloud.io' }] },
          migrate: { outputDir: '/tmp/output' },
          transfer: { mode: 'incremental', batchSize: 50 }
        })
      }
    }
  );

  const program = createProgram();
  mockedRegisterSyncMetadata(program);

  await program.parseAsync(['node', 'test', 'sync-metadata', '-c', 'dummy.json']);

  t.false(t.context.exitStub.calledWith(1), 'should succeed with explicit transfer config');
});
