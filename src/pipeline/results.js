import logger from '../utils/logger.js';
import { getNewCodePeriodSkippedProjects } from '../reports/shared.js';

export function createEmptyResults() {
  return {
    startTime: new Date().toISOString(),
    endTime: null,
    dryRun: false,
    serverSteps: [],
    orgResults: [],
    projects: [],
    qualityGates: 0,
    qualityProfiles: 0,
    groups: 0,
    portfolios: 0,
    issueSyncStats: { matched: 0, transitioned: 0 },
    hotspotSyncStats: { matched: 0, statusChanged: 0 },
    projectKeyWarnings: [],
    errors: [],
    totalLinesOfCode: 0,
    projectLinesOfCode: [],
    environment: null,
    configuration: null
  };
}

export async function runFatalStep(results, stepName, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    results.serverSteps.push({ step: stepName, status: 'success', durationMs: Date.now() - start });
    return result;
  } catch (error) {
    results.serverSteps.push({ step: stepName, status: 'failed', error: error.message, durationMs: Date.now() - start });
    throw error;
  }
}

export function finalizeProjectResult(projectResult) {
  const failedSteps = projectResult.steps.filter(s => s.status === 'failed');
  const nonSkippedSteps = projectResult.steps.filter(s => s.status !== 'skipped');
  if (failedSteps.length === 0) {
    projectResult.status = 'success';
  } else if (failedSteps.length === nonSkippedSteps.length) {
    projectResult.status = 'failed';
  } else {
    projectResult.status = 'partial';
  }
  projectResult.success = projectResult.status === 'success';
}

export function recordProjectOutcome(project, projectResult, results) {
  const failedSteps = projectResult.steps.filter(s => s.status === 'failed');
  if (failedSteps.length > 0) {
    results.errors.push({
      project: project.key,
      failedSteps: failedSteps.map(s => ({ step: s.step, error: s.error }))
    });
  }
  if (projectResult.status === 'success') {
    logger.info(`Project ${project.key} migrated successfully`);
  } else if (projectResult.status === 'partial') {
    logger.warn(`Project ${project.key} partially migrated (${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.step).join(', ')})`);
  } else {
    logger.error(`Project ${project.key} FAILED (${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.step).join(', ')})`);
  }
}

export function logMigrationSummary(results, outputDir) {
  const duration = ((Date.now() - new Date(results.startTime).getTime()) / 1000).toFixed(2);
  const succeeded = results.projects.filter(p => p.status === 'success').length;
  const partial = results.projects.filter(p => p.status === 'partial').length;
  const failed = results.projects.filter(p => p.status === 'failed').length;

  logger.info('\n=== Migration Summary ===');
  logger.info(`Duration: ${duration}s`);
  if (results.totalLinesOfCode > 0) {
    logger.info(`Lines of Code: ${results.totalLinesOfCode.toLocaleString()}`);
  }
  logger.info(`Projects: ${succeeded} succeeded, ${partial} partial, ${failed} failed, ${results.projects.length} total`);
  logger.info(`Quality Gates: ${results.qualityGates} migrated`);
  logger.info(`Quality Profiles: ${results.qualityProfiles} migrated`);
  logger.info(`Groups: ${results.groups} created`);
  logger.info(`Portfolios: ${results.portfolios} created`);
  logger.info(`Issues synced: ${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned`);
  logger.info(`Hotspots synced: ${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`);
  if (results.projectKeyWarnings.length > 0) {
    logger.warn(`Project key conflicts: ${results.projectKeyWarnings.length} project(s) could not use the original SonarQube key on SonarCloud`);
    for (const w of results.projectKeyWarnings) {
      logger.warn(`  "${w.sqKey}" -> "${w.scKey}" (key taken by org "${w.owner}")`);
    }
  }
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  if (ncpSkipped.length > 0) {
    logger.warn(`New code period NOT set: ${ncpSkipped.length} project(s) have unsupported new code period types (e.g. REFERENCE_BRANCH)`);
    for (const { projectKey, detail } of ncpSkipped) {
      logger.warn(`  ${projectKey}: ${detail}`);
    }
  }
  logger.info(`Output: ${outputDir}`);
  logger.info('========================');
}
