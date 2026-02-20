import { join } from 'node:path';
import { SonarQubeClient } from '../sonarqube/api-client.js';
import { SonarCloudClient } from '../sonarcloud/api-client.js';
import { transferProject } from '../transfer-pipeline.js';
import { extractHotspots } from '../sonarqube/extractors/hotspots.js';
import { extractProjectSettings } from '../sonarqube/extractors/project-settings.js';
import { extractProjectTags } from '../sonarqube/extractors/project-tags.js';
import { extractProjectLinks } from '../sonarqube/extractors/project-links.js';
import { extractNewCodePeriods } from '../sonarqube/extractors/new-code-periods.js';
import { extractProjectPermissions } from '../sonarqube/extractors/permissions.js';
import { assignQualityGatesToProjects } from '../sonarcloud/migrators/quality-gates.js';
import { migrateProjectSettings, migrateProjectTags, migrateProjectLinks, migrateNewCodePeriods, migrateDevOpsBinding } from '../sonarcloud/migrators/project-config.js';
import { migrateProjectPermissions } from '../sonarcloud/migrators/permissions.js';
import { syncIssues } from '../sonarcloud/migrators/issue-sync.js';
import { syncHotspots } from '../sonarcloud/migrators/hotspot-sync.js';
import logger from '../utils/logger.js';
import { finalizeProjectResult, recordProjectOutcome } from './results.js';

export async function migrateOrgProjects(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const projectKeyMap = new Map();
  const projectKeyWarnings = [];
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const { scProjectKey, warning } = await resolveProjectKey(project, org, scClient);
    if (warning) projectKeyWarnings.push(warning);
    projectKeyMap.set(project.key, scProjectKey);
    logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} -> ${scProjectKey} ---`);
    const projectResult = await migrateOneProject({ project, scProjectKey, org, gateMapping, extractedData, results, ctx, builtInProfileMapping });
    results.projects.push(projectResult);
    if (projectResult.linesOfCode > 0) {
      results.totalLinesOfCode += projectResult.linesOfCode;
      results.projectLinesOfCode.push({ projectKey: project.key, linesOfCode: projectResult.linesOfCode });
    }
    recordProjectOutcome(project, projectResult, results);
  }
  return { projectKeyMap, projectKeyWarnings };
}

async function resolveProjectKey(project, org, scClient) {
  let scProjectKey = project.key;
  let warning = null;
  const globalCheck = await scClient.isProjectKeyTakenGlobally(project.key);
  if (globalCheck.taken && globalCheck.owner !== org.key) {
    scProjectKey = `${org.key}_${project.key}`;
    logger.warn(`Project key "${project.key}" is already taken by organization "${globalCheck.owner}" on SonarCloud. Using prefixed key "${scProjectKey}" instead.`);
    warning = { sqKey: project.key, scKey: scProjectKey, owner: globalCheck.owner };
  }
  return { scProjectKey, warning };
}

async function migrateOneProject({ project, scProjectKey, org, gateMapping, extractedData, results, ctx, builtInProfileMapping }) {
  const projectStart = Date.now();
  const projectResult = { projectKey: project.key, scProjectKey, status: 'success', steps: [], errors: [] };
  const projectSqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token, projectKey: project.key });
  const projectScClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io', token: org.token,
    organization: org.key, projectKey: scProjectKey, rateLimit: ctx.rateLimitConfig
  });
  const reportUploadOk = await uploadScannerReport(project, scProjectKey, org, projectResult, ctx);
  await syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient);
  await syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient);
  await migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping);
  finalizeProjectResult(projectResult);
  projectResult.durationMs = Date.now() - projectStart;
  return projectResult;
}

async function uploadScannerReport(project, scProjectKey, org, projectResult, ctx) {
  const start = Date.now();
  try {
    const stateFile = join(ctx.outputDir, 'state', `.state.${project.key}.json`);
    const transferResult = await transferProject({
      sonarqubeConfig: { url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token, projectKey: project.key },
      sonarcloudConfig: { url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, projectKey: scProjectKey, rateLimit: ctx.rateLimitConfig },
      transferConfig: { mode: ctx.transferConfig.mode, stateFile, batchSize: ctx.transferConfig.batchSize },
      performanceConfig: ctx.perfConfig,
      wait: ctx.wait, skipConnectionTest: true, projectName: project.name
    });
    projectResult.linesOfCode = transferResult.stats.linesOfCode || 0;
    projectResult.steps.push({ step: 'Upload scanner report', status: 'success', durationMs: Date.now() - start });
    return true;
  } catch (error) {
    projectResult.linesOfCode = 0;
    projectResult.steps.push({ step: 'Upload scanner report', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
    return false;
  }
}

async function syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient) {
  if (ctx.skipIssueSync) {
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Disabled by config', durationMs: 0 });
    return;
  }
  if (!reportUploadOk) {
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Report upload failed', durationMs: 0 });
    return;
  }
  const start = Date.now();
  try {
    logger.info('Syncing issue metadata...');
    const sqIssues = await projectSqClient.getIssuesWithComments();
    const issueStats = await syncIssues(scProjectKey, sqIssues, projectScClient, { concurrency: ctx.perfConfig.issueSync.concurrency });
    results.issueSyncStats.matched += issueStats.matched;
    results.issueSyncStats.transitioned += issueStats.transitioned;
    projectResult.steps.push({ step: 'Sync issues', status: 'success', detail: `${issueStats.matched} matched, ${issueStats.transitioned} transitioned`, durationMs: Date.now() - start });
  } catch (error) {
    projectResult.steps.push({ step: 'Sync issues', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}

async function syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient) {
  if (ctx.skipHotspotSync) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Disabled by config', durationMs: 0 });
    return;
  }
  if (!reportUploadOk) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Report upload failed', durationMs: 0 });
    return;
  }
  const start = Date.now();
  try {
    logger.info('Syncing hotspot metadata...');
    const sqHotspots = await extractHotspots(projectSqClient, null, { concurrency: ctx.perfConfig.hotspotExtraction.concurrency });
    const hotspotStats = await syncHotspots(scProjectKey, sqHotspots, projectScClient, { concurrency: ctx.perfConfig.hotspotSync.concurrency });
    results.hotspotSyncStats.matched += hotspotStats.matched;
    results.hotspotSyncStats.statusChanged += hotspotStats.statusChanged;
    projectResult.steps.push({ step: 'Sync hotspots', status: 'success', detail: `${hotspotStats.matched} matched, ${hotspotStats.statusChanged} status changed`, durationMs: Date.now() - start });
  } catch (error) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}

async function runProjectStep(projectResult, stepName, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    if (result && result.skipped) {
      projectResult.steps.push({ step: stepName, status: 'skipped', detail: result.detail || '', durationMs });
    } else {
      projectResult.steps.push({ step: stepName, status: 'success', durationMs });
    }
  } catch (error) {
    projectResult.steps.push({ step: stepName, status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}

async function migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping) {
  await runProjectStep(projectResult, 'Project settings', async () => {
    const projectSettings = await extractProjectSettings(projectSqClient, project.key);
    await migrateProjectSettings(scProjectKey, projectSettings, projectScClient);
  });
  await runProjectStep(projectResult, 'Project tags', async () => {
    const projectTags = await extractProjectTags(projectSqClient);
    await migrateProjectTags(scProjectKey, projectTags, projectScClient);
  });
  await runProjectStep(projectResult, 'Project links', async () => {
    const projectLinks = await extractProjectLinks(projectSqClient, project.key);
    await migrateProjectLinks(scProjectKey, projectLinks, projectScClient);
  });
  await runProjectStep(projectResult, 'New code definitions', async () => {
    const newCodePeriods = await extractNewCodePeriods(projectSqClient, project.key);
    return await migrateNewCodePeriods(scProjectKey, newCodePeriods, projectScClient);
  });
  await runProjectStep(projectResult, 'DevOps binding', async () => {
    const binding = extractedData.projectBindings.get(project.key);
    await migrateDevOpsBinding(scProjectKey, binding, projectScClient);
  });
  await runProjectStep(projectResult, 'Assign quality gate', async () => {
    const projectGate = await projectSqClient.getQualityGate();
    if (projectGate && gateMapping.has(projectGate.name)) {
      await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: projectGate.name }], projectScClient);
    }
  });
  if (builtInProfileMapping && builtInProfileMapping.size > 0) {
    await runProjectStep(projectResult, 'Assign quality profiles', async () => {
      let assigned = 0;
      for (const [language, profileName] of builtInProfileMapping) {
        try {
          await projectScClient.addQualityProfileToProject(language, profileName, scProjectKey);
          assigned++;
        } catch (error) {
          logger.debug(`Could not assign profile "${profileName}" (${language}) to ${scProjectKey}: ${error.message}`);
        }
      }
      return `${assigned} profiles assigned`;
    });
  }
  await runProjectStep(projectResult, 'Project permissions', async () => {
    const projectPerms = await extractProjectPermissions(projectSqClient, project.key);
    await migrateProjectPermissions(scProjectKey, projectPerms, projectScClient);
  });
}
