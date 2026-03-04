import { extractQualityGates } from '../sonarqube/extractors/quality-gates.js';
import { extractQualityProfiles } from '../sonarqube/extractors/quality-profiles.js';
import { extractGroups } from '../sonarqube/extractors/groups.js';
import { extractGlobalPermissions, extractPermissionTemplates } from '../sonarqube/extractors/permissions.js';
import { extractPortfolios } from '../sonarqube/extractors/portfolios.js';
import { extractServerInfo } from '../sonarqube/extractors/server-info.js';
import { extractWebhooks } from '../sonarqube/extractors/webhooks.js';
import { extractAlmSettings, extractAllProjectBindings } from '../sonarqube/extractors/devops-bindings.js';
import { mapConcurrent } from '../utils/concurrency.js';
import logger from '../utils/logger.js';

export async function extractAllProjects(sqClient, results) {
  try {
    logger.info('Extracting all projects...');
    const allProjects = await sqClient.listAllProjects();
    logger.info(`Found ${allProjects.length} projects`);
    results.serverSteps.push({ step: 'Extract projects', status: 'success', detail: `${allProjects.length} found` });
    return allProjects;
  } catch (error) {
    results.serverSteps.push({ step: 'Extract projects', status: 'failed', error: error.message });
    throw error;
  }
}

export async function runNonFatalExtraction(results, stepName, fn, detailFn) {
  try {
    logger.info(`Extracting ${stepName}...`);
    const data = await fn();
    const detail = detailFn ? detailFn(data) : undefined;
    results.serverSteps.push({ step: `Extract ${stepName}`, status: 'success', ...(detail && { detail }) });
    return data;
  } catch (error) {
    results.serverSteps.push({ step: `Extract ${stepName}`, status: 'failed', error: error.message });
    logger.error(`Failed to extract ${stepName}: ${error.message}`);
    return undefined;
  }
}

export async function extractServerWideData(sqClient, allProjects, results, perfConfig) {
  const qualityGates = await runNonFatalExtraction(results, 'quality gates',
    () => extractQualityGates(sqClient), d => `${d.length} found`) || [];

  const qualityProfiles = await runNonFatalExtraction(results, 'quality profiles',
    () => extractQualityProfiles(sqClient), d => `${d.length} found`) || [];

  const groups = await runNonFatalExtraction(results, 'groups',
    () => extractGroups(sqClient), d => `${d.length} found`) || [];

  const globalPermissions = await runNonFatalExtraction(results, 'global permissions',
    () => extractGlobalPermissions(sqClient)) || [];

  const permissionTemplates = await runNonFatalExtraction(results, 'permission templates',
    () => extractPermissionTemplates(sqClient)) || { templates: [], defaultTemplates: [] };

  const portfolios = await runNonFatalExtraction(results, 'portfolios',
    () => extractPortfolios(sqClient), d => `${d.length} found`) || [];

  let almSettings = [];
  let projectBindings = new Map();
  const bindingsResult = await runNonFatalExtraction(results, 'DevOps bindings', async () => {
    const alm = await extractAlmSettings(sqClient);
    const bindings = await extractAllProjectBindings(sqClient, allProjects, {
      concurrency: perfConfig.maxConcurrency
    });
    return { alm, bindings };
  });
  if (bindingsResult) {
    almSettings = bindingsResult.alm;
    projectBindings = bindingsResult.bindings;
  }

  const projectBranches = await runNonFatalExtraction(results, 'project branches',
    () => extractAllProjectBranches(sqClient, allProjects, perfConfig),
    d => `branches for ${d.size} projects`) || new Map();

  const serverInfo = await runNonFatalExtraction(results, 'server info',
    () => extractServerInfo(sqClient)) || { system: {}, plugins: [], settings: [] };

  const serverWebhooks = await runNonFatalExtraction(results, 'webhooks',
    () => extractWebhooks(sqClient)) || [];

  return {
    projects: allProjects, qualityGates, qualityProfiles, groups,
    globalPermissions, permissionTemplates, portfolios, almSettings,
    projectBindings, projectBranches, serverInfo, serverWebhooks
  };
}

export async function extractAllProjectBranches(sqClient, allProjects, perfConfig) {
  const concurrency = perfConfig.maxConcurrency || 10;
  logger.info(`Extracting branches for ${allProjects.length} projects (concurrency=${concurrency})...`);

  const results = await mapConcurrent(
    allProjects,
    async (project) => {
      const branches = await sqClient.getBranches(project.key);
      return { key: project.key, branches };
    },
    { concurrency, settled: true }
  );

  const branchMap = new Map();
  for (const r of results) {
    if (r.status === 'fulfilled') {
      branchMap.set(r.value.key, r.value.branches);
    } else {
      logger.warn(`Failed to fetch branches for a project: ${r.reason?.message}`);
    }
  }

  logger.info(`Extracted branches for ${branchMap.size}/${allProjects.length} projects`);
  return branchMap;
}
