import { SonarQubeClient } from '../sonarqube/api-client.js';
import { SonarCloudClient } from '../sonarcloud/api-client.js';
import { loadConfig } from '../config/loader.js';
import { transferProject } from '../transfer-pipeline.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../utils/concurrency.js';
import logger, { enableFileLogging } from '../utils/logger.js';
import { CloudVoyagerError } from '../utils/errors.js';

export function registerTransferAllCommand(program) {
  program
    .command('transfer-all')
    .description('[DEPRECATED] Transfer ALL projects from SonarQube to SonarCloud. Use "migrate --only scan-data-all-branches" instead.')
    .requiredOption('-c, --config <path>', 'Path to configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--wait', 'Wait for analysis to complete before returning')
    .option('--dry-run', 'List projects that would be transferred without transferring')
    .option('--concurrency <n>', 'Override max concurrency for I/O operations', Number.parseInt)
    .option('--max-memory <mb>', 'Max heap size in MB (auto-restarts with increased heap if needed)', Number.parseInt)
    .option('--project-concurrency <n>', 'Max concurrent project migrations', Number.parseInt)
    .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
    .option('--skip-all-branch-sync', 'Only sync the main branch of each project (skip non-main branches)')
    .action(async (options) => {
      try {
        if (options.verbose) logger.level = 'debug';
        enableFileLogging('transfer-all');
        logger.warn('DEPRECATION WARNING: "transfer-all" is deprecated and will be removed in a future release.');
        logger.warn('Use "migrate --only scan-data-all-branches" instead, which provides:');
        logger.warn('  - Dry-run CSV workflow for reviewing/filtering projects before migration');
        logger.warn('  - Multi-org support');
        logger.warn('  - Full migration capabilities (quality gates, profiles, permissions, etc.)');
        logger.info('=== CloudVoyager - Transfer All Projects ===');

        const config = await loadConfig(options.config);
        if (options.skipAllBranchSync) {
          config.transfer = config.transfer || {};
          config.transfer.syncAllBranches = false;
        }
        const { projects, projectKeyPrefix, projectKeyMapping } = await discoverProjects(config);

        if (projects.length === 0) { logger.warn('No projects to transfer'); return; }
        logProjectList(projects, projectKeyMapping, projectKeyPrefix);
        if (options.dryRun) { logger.info('Dry run complete. No projects were transferred.'); return; }

        const perfConfig = resolvePerformanceConfig({
          ...config.performance,
          ...(options.autoTune && { autoTune: true }),
          ...(options.concurrency && { maxConcurrency: options.concurrency, sourceExtraction: { concurrency: options.concurrency }, hotspotExtraction: { concurrency: options.concurrency } }),
          ...(options.maxMemory && { maxMemoryMB: options.maxMemory }),
          ...(options.projectConcurrency && { projectMigration: { concurrency: options.projectConcurrency } })
        });
        ensureHeapSize(perfConfig.maxMemoryMB);
        logSystemInfo(perfConfig);

        const { results, startTime } = await executeTransferAll(projects, config, projectKeyMapping, projectKeyPrefix, options, perfConfig);
        const failedCount = logTransferSummary(results, startTime);
        if (failedCount > 0) process.exit(1);
      } catch (error) {
        if (error instanceof CloudVoyagerError) {
          logger.error(`Transfer-all failed: ${error.message}`);
        } else {
          logger.error(`Unexpected error: ${error.message}`);
          logger.debug(error.stack);
        }
        process.exit(1);
      }
    });
}

async function discoverProjects(config) {
  const transferAllConfig = config.transferAll || {};
  const projectKeyPrefix = transferAllConfig.projectKeyPrefix || '';
  const projectKeyMapping = transferAllConfig.projectKeyMapping || {};
  const excludeProjects = new Set(transferAllConfig.excludeProjects || []);

  const discoveryClient = new SonarQubeClient({ url: config.sonarqube.url, token: config.sonarqube.token });
  await discoveryClient.testConnection();
  const sonarCloudTestClient = new SonarCloudClient({
    url: config.sonarcloud.url || 'https://sonarcloud.io',
    token: config.sonarcloud.token,
    organization: config.sonarcloud.organization,
    rateLimit: config.rateLimit
  });
  await sonarCloudTestClient.testConnection();

  logger.info('Discovering all SonarQube projects...');
  const allProjects = await discoveryClient.listAllProjects();
  logger.info(`Found ${allProjects.length} projects in SonarQube`);

  const projects = allProjects.filter(p => !excludeProjects.has(p.key));
  if (projects.length !== allProjects.length) {
    logger.info(`Excluded ${allProjects.length - projects.length} projects, ${projects.length} remaining`);
  }
  return { projects, projectKeyPrefix, projectKeyMapping };
}

function logProjectList(projects, projectKeyMapping, projectKeyPrefix) {
  logger.info('Projects to transfer:');
  projects.forEach((project, index) => {
    const scKey = projectKeyMapping[project.key] || `${projectKeyPrefix}${project.key}`;
    logger.info(`  ${index + 1}. ${project.key} -> ${scKey} (${project.name})`);
  });
}

async function executeTransferAll(projects, config, projectKeyMapping, projectKeyPrefix, options, perfConfig = {}) {
  const results = [];
  const startTime = Date.now();
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const sqProjectKey = project.key;
    const scProjectKey = projectKeyMapping[sqProjectKey] || `${projectKeyPrefix}${sqProjectKey}`;
    const baseStateFile = config.transfer?.stateFile || './.cloudvoyager-state.json';
    const ext = baseStateFile.endsWith('.json') ? '.json' : '';
    const base = ext ? baseStateFile.slice(0, -ext.length) : baseStateFile;
    const perProjectStateFile = `${base}.${sqProjectKey}${ext}`;

    logger.info('\n========================================');
    logger.info(`Project ${i + 1}/${projects.length}: ${sqProjectKey}`);
    logger.info(`  SonarCloud key: ${scProjectKey}`);
    logger.info(`  State file: ${perProjectStateFile}`);
    logger.info('========================================');

    try {
      const result = await transferProject({
        sonarqubeConfig: { url: config.sonarqube.url, token: config.sonarqube.token, projectKey: sqProjectKey },
        sonarcloudConfig: {
          url: config.sonarcloud.url || 'https://sonarcloud.io', token: config.sonarcloud.token,
          organization: config.sonarcloud.organization, projectKey: scProjectKey, rateLimit: config.rateLimit
        },
        transferConfig: { mode: config.transfer?.mode || 'incremental', stateFile: perProjectStateFile, batchSize: config.transfer?.batchSize || 100, syncAllBranches: config.transfer?.syncAllBranches, excludeBranches: config.transfer?.excludeBranches },
        performanceConfig: perfConfig, wait: options.wait || false, skipConnectionTest: true, projectName: project.name
      });
      results.push({ ...result, success: true });
      logger.info(`Project ${sqProjectKey} transferred successfully`);
    } catch (error) {
      logger.error(`Project ${sqProjectKey} FAILED: ${error.message}`);
      if (options.verbose) logger.debug(error.stack);
      results.push({ projectKey: sqProjectKey, sonarCloudProjectKey: scProjectKey, success: false, error: error.message });
    }
  }
  return { results, startTime };
}

function logTransferSummary(results, startTime) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  logger.info('\n=== Transfer All Summary ===');
  logger.info(`Total projects: ${results.length}`);
  logger.info(`Succeeded: ${succeeded.length}`);
  logger.info(`Failed: ${failed.length}`);
  logger.info(`Duration: ${duration}s`);

  if (succeeded.length > 0) {
    logger.info('\nSuccessful transfers:');
    succeeded.forEach(r => {
      logger.info(`  ${r.projectKey} -> ${r.sonarCloudProjectKey} (${r.stats.issuesTransferred} issues, ${r.stats.componentsTransferred} components, ${r.stats.sourcesTransferred} sources)`);
    });
  }
  if (failed.length > 0) {
    logger.info('\nFailed transfers:');
    failed.forEach(r => { logger.error(`  ${r.projectKey}: ${r.error}`); });
  }
  logger.info('=== Transfer All Complete ===');
  return failed.length;
}
