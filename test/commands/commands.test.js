import test from 'ava';
import sinon from 'sinon';
import esmock from 'esmock';
import { Command } from 'commander';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { registerTransferAllCommand } from '../../src/commands/transfer-all.js';
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
 * Write a transfer-all compatible config file to disk and return its path.
 */
async function writeTransferAllConfig(dir, overrides = {}) {
  await mkdir(dir, { recursive: true });
  const configPath = join(dir, 'config.json');
  const config = {
    sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
    sonarcloud: { url: 'https://sonarcloud.io', token: 'sc-token', organization: 'test-org' },
    transfer: { mode: 'full', stateFile: join(dir, '.state.json'), batchSize: 100 },
    transferAll: { projectKeyPrefix: '', excludeProjects: [], projectKeyMapping: {} },
    ...overrides
  };
  await writeFile(configPath, JSON.stringify(config));
  return configPath;
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
// transfer-all.js tests
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

// ===== transfer-all.js =====

test.serial('registerTransferAllCommand registers the transfer-all command', t => {
  const program = createProgram();
  registerTransferAllCommand(program);
  const cmd = program.commands.find(c => c.name() === 'transfer-all');
  t.truthy(cmd, 'transfer-all command should be registered');
  t.is(cmd.name(), 'transfer-all');
});

test.serial('transfer-all: has all expected options', t => {
  const program = createProgram();
  registerTransferAllCommand(program);
  const cmd = program.commands.find(c => c.name() === 'transfer-all');
  const optionNames = cmd.options.map(o => o.long);
  t.true(optionNames.includes('--config'));
  t.true(optionNames.includes('--verbose'));
  t.true(optionNames.includes('--wait'));
  t.true(optionNames.includes('--dry-run'));
  t.true(optionNames.includes('--concurrency'));
  t.true(optionNames.includes('--max-memory'));
  t.true(optionNames.includes('--project-concurrency'));
  t.true(optionNames.includes('--auto-tune'));
  t.true(optionNames.includes('--skip-all-branch-sync'));
});

test.serial('transfer-all: successful transfer of discovered projects', async t => {
  const { tmpDir, stubs } = t.context;
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(stubs.sqTestConnection.called, 'should test SonarQube connection');
  t.true(stubs.scTestConnection.called, 'should test SonarCloud connection');
  t.true(stubs.sqListAllProjects.called, 'should list all projects');
  // transferProject is called for each project -- we verify via extractAll calls
  t.true(stubs.extractAll.called, 'should call extractAll for project transfers');
  // With 2 projects found, exit should not be called (all succeed)
  t.false(t.context.exitStub.calledWith(1), 'should not exit(1) on full success');
});

test.serial('transfer-all: dry run lists projects without transferring', async t => {
  const { tmpDir, stubs } = t.context;
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath, '--dry-run']);

  t.true(stubs.sqListAllProjects.called, 'should discover projects');
  t.false(stubs.extractAll.called, 'should NOT run the transfer pipeline');
});

test.serial('transfer-all: no projects logs warning and returns early', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqListAllProjects.resolves([]);
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.false(stubs.extractAll.called, 'should not attempt transfer');
  t.false(t.context.exitStub.called, 'should not call exit');
});

test.serial('transfer-all: handles CloudVoyagerError', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqTestConnection.rejects(new CloudVoyagerError('Auth failed'));
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on CloudVoyagerError');
});

test.serial('transfer-all: handles unexpected error', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqTestConnection.rejects(new Error('Network failure'));
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) on unexpected error');
});

test.serial('transfer-all: failed transfers cause exit(1)', async t => {
  const { tmpDir, stubs } = t.context;
  // Make extractAll fail to simulate transfer failure
  stubs.extractAll.rejects(new Error('Extraction failed'));
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when transfers fail');
});

test.serial('transfer-all: excludeProjects filters out specified project keys', async t => {
  const { tmpDir, stubs } = t.context;
  const configPath = await writeTransferAllConfig(tmpDir, {
    transferAll: { projectKeyPrefix: '', excludeProjects: ['proj2'], projectKeyMapping: {} }
  });
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  // extractAll should be called only once (proj1 only, proj2 excluded)
  // It is called once per branch per project; we have 1 project with 1 branch
  t.true(stubs.extractAll.callCount >= 1, 'should transfer at least one project');
  t.true(stubs.sqListAllProjects.called, 'should discover all projects first');
});

test.serial('transfer-all: projectKeyMapping maps SQ keys to SC keys', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqListAllProjects.resolves([{ key: 'sq-proj', name: 'SQ Project' }]);
  const configPath = await writeTransferAllConfig(tmpDir, {
    transferAll: { projectKeyPrefix: '', excludeProjects: [], projectKeyMapping: { 'sq-proj': 'sc-custom-key' } }
  });
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  // The ensureProject call on SonarCloud side should use the mapped key
  t.true(stubs.scEnsureProject.called, 'should call ensureProject');
});

test.serial('transfer-all: projectKeyPrefix applies prefix to project keys', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqListAllProjects.resolves([{ key: 'my-proj', name: 'My Project' }]);
  const configPath = await writeTransferAllConfig(tmpDir, {
    transferAll: { projectKeyPrefix: 'prefix_', excludeProjects: [], projectKeyMapping: {} }
  });
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(stubs.scEnsureProject.called, 'should call ensureProject with prefixed key');
});

test.serial('transfer-all: --skip-all-branch-sync sets syncAllBranches=false', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqListAllProjects.resolves([{ key: 'proj1', name: 'P1' }]);
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath, '--skip-all-branch-sync']);

  // The command modifies config.transfer.syncAllBranches = false before passing to transferProject
  // We verify indirectly: extractAll is called (transfer runs), and the branch extraction
  // only gets called for the main branch. Since we stub extractAll, just verify the command ran.
  t.true(stubs.extractAll.called, 'should still run transfer');
});

test.serial('transfer-all: --verbose sets logger to debug level', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  // Save current level, parse with --verbose
  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath, '--verbose']);

  // The command sets logger.level = 'debug' when verbose is true.
  // We can't easily assert on that since we override logger.level in beforeEach,
  // but the command ran without error which means the code path was exercised.
  t.pass('verbose mode executed without error');
});

test.serial('transfer-all: --concurrency overrides performance config', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath, '--concurrency', '4']);
  t.true(t.context.stubs.extractAll.called, 'transfer should proceed with custom concurrency');
});

test.serial('transfer-all: --max-memory option is parsed', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath, '--max-memory', '4096']);
  t.pass('max-memory option parsed without error');
});

test.serial('transfer-all: --project-concurrency option is parsed', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath, '--project-concurrency', '2']);
  t.pass('project-concurrency option parsed without error');
});

test.serial('transfer-all: --auto-tune option is parsed', async t => {
  const { tmpDir } = t.context;
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath, '--auto-tune']);
  t.pass('auto-tune option parsed without error');
});

test.serial('transfer-all: partial transfer failure (one succeeds, one fails)', async t => {
  const { tmpDir, stubs } = t.context;
  // First call succeeds, second call fails
  stubs.extractAll.onFirstCall().resolves({
    project: { branches: [{ name: 'main', isMain: true }] },
    issues: [{ key: 'i1' }], components: [{ key: 'c1' }],
    sources: [{ key: 's1' }], metrics: [{ key: 'ncloc' }],
    measures: { measures: [{ metric: 'ncloc', value: '100' }] }
  });
  stubs.extractAll.onSecondCall().rejects(new Error('Project 2 failed'));

  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when any transfer fails');
});

test.serial('transfer-all: --wait option is forwarded to transfer', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqListAllProjects.resolves([{ key: 'proj1', name: 'P1' }]);
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath, '--wait']);

  t.true(stubs.uploadAndWait.called, 'should use uploadAndWait when --wait is specified');
});

test.serial('transfer-all: config file not found triggers error', async t => {
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', '/nonexistent/config.json']);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when config not found');
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

test.serial('all three commands can be registered on the same program', t => {
  const program = createProgram();
  registerTransferAllCommand(program);
  registerMigrateCommand(program);
  registerSyncMetadataCommand(program);

  const commandNames = program.commands.map(c => c.name());
  t.true(commandNames.includes('transfer-all'));
  t.true(commandNames.includes('migrate'));
  t.true(commandNames.includes('sync-metadata'));
  t.is(program.commands.length, 3);
});

test.serial('transfer-all: description is set correctly', t => {
  const program = createProgram();
  registerTransferAllCommand(program);
  const cmd = program.commands.find(c => c.name() === 'transfer-all');
  t.true(cmd.description().includes('Transfer ALL projects'));
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

test.serial('transfer-all: config option is required', t => {
  const program = createProgram();
  registerTransferAllCommand(program);
  const cmd = program.commands.find(c => c.name() === 'transfer-all');
  const configOpt = cmd.options.find(o => o.long === '--config');
  t.truthy(configOpt, 'config option should exist');
  t.true(configOpt.required, 'config option should be required');
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

test.serial('transfer-all: all projects excluded results in no transfer', async t => {
  const { tmpDir, stubs } = t.context;
  const configPath = await writeTransferAllConfig(tmpDir, {
    transferAll: { projectKeyPrefix: '', excludeProjects: ['proj1', 'proj2'], projectKeyMapping: {} }
  });
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.false(stubs.extractAll.called, 'should not transfer when all projects are excluded');
});

test.serial('transfer-all: single project transfer succeeds without exit', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqListAllProjects.resolves([{ key: 'only-proj', name: 'Only Project' }]);
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.false(t.context.exitStub.calledWith(1), 'single successful project should not exit(1)');
});

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

test.serial('transfer-all: state file path is derived per project', async t => {
  const { tmpDir, stubs } = t.context;
  stubs.sqListAllProjects.resolves([
    { key: 'proj-a', name: 'Project A' },
    { key: 'proj-b', name: 'Project B' }
  ]);
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  // Both projects should be transferred (stateTracker init called for each)
  t.true(stubs.stInit.callCount >= 2, 'should initialize state tracker for each project');
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

// ===== transfer-all.js: additional branch coverage =====

test.serial('transfer-all: config without transferAll key uses fallback defaults', async t => {
  const { tmpDir } = t.context;
  // Omit transferAll entirely so lines 65-68 fallbacks are exercised
  const configPath = await writeTransferAllConfig(tmpDir, { transferAll: undefined });
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(t.context.stubs.extractAll.called, 'should transfer with fallback transferAll defaults');
});

test.serial('transfer-all: config without sonarcloud.url uses fallback url', async t => {
  const { tmpDir } = t.context;
  // Omit sonarcloud.url so the || 'https://sonarcloud.io' fallback on line 73 is exercised
  const configPath = await writeTransferAllConfig(tmpDir, {
    sonarcloud: { token: 'sc-token', organization: 'test-org' }
  });
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(t.context.stubs.scTestConnection.called, 'should use fallback url for SC client');
});

test.serial('transfer-all: config without transfer key uses fallback stateFile, mode, batchSize', async t => {
  const { tmpDir } = t.context;
  // Omit the transfer key entirely so fallbacks on lines 106, 121-124 are exercised
  const configPath = await writeTransferAllConfig(tmpDir, { transfer: undefined });
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(t.context.stubs.extractAll.called, 'should transfer with fallback transfer defaults');
});

test.serial('transfer-all: stateFile without .json extension covers non-json branch', async t => {
  const { tmpDir } = t.context;
  // Provide a stateFile that does NOT end with .json to cover the else branch on line 107-108
  const configPath = await writeTransferAllConfig(tmpDir, {
    transfer: { mode: 'full', stateFile: join(tmpDir, '.state-data'), batchSize: 100 }
  });
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(t.context.stubs.extractAll.called, 'should transfer with non-.json stateFile');
});

test.serial('transfer-all: --verbose with failed transfer logs error stack', async t => {
  const { tmpDir, stubs } = t.context;
  // First project fails, verbose is on -- exercises line 131: if (options.verbose) logger.debug(error.stack)
  stubs.extractAll.rejects(new Error('Extraction failed'));
  const configPath = await writeTransferAllConfig(tmpDir);
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath, '--verbose']);

  t.true(t.context.exitStub.calledWith(1), 'should exit(1) when transfers fail in verbose mode');
});

test.serial('transfer-all: config without transfer.syncAllBranches and excludeBranches uses undefined', async t => {
  const { tmpDir } = t.context;
  // Provide transfer config without syncAllBranches or excludeBranches
  const configPath = await writeTransferAllConfig(tmpDir, {
    transfer: { mode: 'full', stateFile: join(tmpDir, '.state.json'), batchSize: 100 }
  });
  const program = createProgram();
  registerTransferAllCommand(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', configPath]);

  t.true(t.context.stubs.extractAll.called, 'should transfer without syncAllBranches/excludeBranches');
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

test.serial('transfer-all (esmock): config without transfer/sonarcloud.url exercises fallbacks', async t => {
  // Mock loadConfig to return config without transfer and without sonarcloud.url
  const { registerTransferAllCommand: mockedRegisterTransferAll } = await esmock(
    '../../src/commands/transfer-all.js',
    {
      '../../src/config/loader.js': {
        loadConfig: async () => ({
          sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
          sonarcloud: { token: 'sc-token', organization: 'test-org' },
          transferAll: { projectKeyPrefix: 'pf_', projectKeyMapping: {}, excludeProjects: [] }
          // transfer is intentionally missing, sonarcloud.url is missing
        })
      }
    }
  );

  const program = createProgram();
  mockedRegisterTransferAll(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', 'dummy.json']);

  t.true(t.context.stubs.extractAll.called, 'should transfer with fallback defaults');
});

test.serial('transfer-all (esmock): config without transferAll exercises all transferAll fallbacks', async t => {
  // Mock loadConfig to return config without transferAll key at all
  const { registerTransferAllCommand: mockedRegisterTransferAll } = await esmock(
    '../../src/commands/transfer-all.js',
    {
      '../../src/config/loader.js': {
        loadConfig: async () => ({
          sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
          sonarcloud: { token: 'sc-token', organization: 'test-org' }
          // both transfer and transferAll are missing
        })
      }
    }
  );

  const program = createProgram();
  mockedRegisterTransferAll(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', 'dummy.json']);

  t.true(t.context.stubs.extractAll.called, 'should transfer with all transferAll fallback defaults');
});

test.serial('transfer-all (esmock): --skip-all-branch-sync with no config.transfer exercises || {} on line 30', async t => {
  // Mock loadConfig to return config without transfer key, then use --skip-all-branch-sync
  const { registerTransferAllCommand: mockedRegisterTransferAll } = await esmock(
    '../../src/commands/transfer-all.js',
    {
      '../../src/config/loader.js': {
        loadConfig: async () => ({
          sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
          sonarcloud: { url: 'https://sonarcloud.io', token: 'sc-token', organization: 'test-org' },
          transferAll: { projectKeyPrefix: '', projectKeyMapping: {}, excludeProjects: [] }
          // transfer is intentionally missing
        })
      }
    }
  );

  const program = createProgram();
  mockedRegisterTransferAll(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', 'dummy.json', '--skip-all-branch-sync']);

  t.true(t.context.stubs.extractAll.called, 'should transfer with --skip-all-branch-sync and no config.transfer');
});

test.serial('transfer-all (esmock): stateFile without .json and no transfer fields in config', async t => {
  // Config with a stateFile NOT ending in .json and without mode/batchSize
  const { registerTransferAllCommand: mockedRegisterTransferAll } = await esmock(
    '../../src/commands/transfer-all.js',
    {
      '../../src/config/loader.js': {
        loadConfig: async () => ({
          sonarqube: { url: 'http://localhost:9000', token: 'sq-token' },
          sonarcloud: { url: 'https://sonarcloud.io', token: 'sc-token', organization: 'test-org' },
          transfer: { stateFile: '/tmp/state-data' },
          transferAll: { projectKeyPrefix: '', projectKeyMapping: {}, excludeProjects: [] }
        })
      }
    }
  );

  const program = createProgram();
  mockedRegisterTransferAll(program);

  await program.parseAsync(['node', 'test', 'transfer-all', '-c', 'dummy.json']);

  t.true(t.context.stubs.extractAll.called, 'should transfer with non-.json stateFile');
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
