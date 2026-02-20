/**
 * Text report formatter — extracted from migrate-pipeline.js.
 * Produces a human-readable plain-text migration report.
 */

import { formatDuration, formatTimestamp, computeProjectStats, getNewCodePeriodSkippedProjects, formatNumber, computeTotalLoc } from './shared.js';

/**
 * Format results as a human-readable text report.
 */
export function formatTextReport(results) {
  const lines = [];
  const sep = '='.repeat(70);
  const subsep = '-'.repeat(70);

  formatReportHeader(lines, results, sep);
  formatReportSummary(lines, results, subsep);
  formatKeyConflicts(lines, results, subsep);
  formatNewCodePeriodWarnings(lines, results, subsep);
  formatServerSteps(lines, results, subsep);
  formatOrgResults(lines, results, subsep);
  formatProblemProjects(lines, results, subsep);
  formatAllProjects(lines, results, subsep);
  formatEnvironment(lines, results, subsep);
  formatConfiguration(lines, results, subsep);

  lines.push(sep);
  return lines.join('\n');
}

function formatReportHeader(lines, results, sep) {
  lines.push(sep, 'CLOUDVOYAGER MIGRATION REPORT', sep, '',
    `Started:  ${formatTimestamp(results.startTime) || results.startTime}`, `Finished: ${formatTimestamp(results.endTime) || 'In progress'}`);
  if (results.startTime && results.endTime) {
    const durationMs = new Date(results.endTime) - new Date(results.startTime);
    lines.push(`Duration: ${formatDuration(durationMs)}`);
  }
  if (results.dryRun) {
    lines.push('Mode:     DRY RUN (no data migrated)');
  }
  lines.push('');
}

function formatReportSummary(lines, results, subsep) {
  const { succeeded, partial, failed, total } = computeProjectStats(results);

  lines.push('SUMMARY', subsep);
  if (total > 0) {
    lines.push(`  Projects:         ${succeeded} succeeded, ${partial} partial, ${failed} failed (${total} total)`);
  } else {
    lines.push('  Projects:         0 (no projects migrated)');
  }
  lines.push(
    `  Quality Gates:    ${results.qualityGates} migrated`,
    `  Quality Profiles: ${results.qualityProfiles} migrated`,
    `  Groups:           ${results.groups} created`,
    `  Portfolios:       ${results.portfolios} created`,
    `  Issues:           ${results.issueSyncStats.matched} matched, ${results.issueSyncStats.transitioned} transitioned`,
    `  Hotspots:         ${results.hotspotSyncStats.matched} matched, ${results.hotspotSyncStats.statusChanged} status changed`,
  );
  const totalLoc = computeTotalLoc(results);
  if (totalLoc > 0) {
    lines.push(`  Lines of Code:    ${formatNumber(totalLoc)} total`);
  }
  lines.push('');
}

function formatKeyConflicts(lines, results, subsep) {
  const keyWarnings = results.projectKeyWarnings || [];
  if (keyWarnings.length === 0) return;

  lines.push(
    'PROJECT KEY CONFLICTS',
    subsep,
    `  ${keyWarnings.length} project(s) could not use the original SonarQube key because`,
    '  the key is already taken by another organization on SonarCloud.',
    '  The migration tool uses the original SonarQube project key by default.',
    '  When a conflict is detected, it falls back to a prefixed key ({org}_{key}).',
    '',
  );
  for (const w of keyWarnings) {
    lines.push(`  [WARN] "${w.sqKey}" -> "${w.scKey}" (taken by org "${w.owner}")`);
  }
  lines.push('');
}

function formatNewCodePeriodWarnings(lines, results, subsep) {
  const ncpSkipped = getNewCodePeriodSkippedProjects(results);
  if (ncpSkipped.length === 0) return;

  lines.push(
    'NEW CODE PERIOD NOT SET',
    subsep,
    `  ${ncpSkipped.length} project(s) use unsupported new code period types (e.g. REFERENCE_BRANCH)`,
    '  that cannot be migrated to SonarCloud. The new code period for these projects',
    '  was NOT set — please configure it manually in SonarCloud.',
    '',
  );
  for (const { projectKey, detail } of ncpSkipped) {
    lines.push(`  [SKIP] ${projectKey}: ${detail}`);
  }
  lines.push('');
}

function formatStepLine(lines, step) {
  const icon = step.status === 'success' ? 'OK  ' : 'FAIL';
  const detail = step.detail ? ` (${step.detail})` : '';
  lines.push(`  [${icon}] ${step.step}${detail}`);
  if (step.error) {
    lines.push(`         ${step.error}`);
  }
}

function formatServerSteps(lines, results, subsep) {
  if (results.serverSteps.length === 0) return;

  lines.push('SERVER-WIDE STEPS', subsep);
  for (const step of results.serverSteps) {
    formatStepLine(lines, step);
  }
  lines.push('');
}

function formatOrgResults(lines, results, subsep) {
  for (const org of (results.orgResults || [])) {
    lines.push(`ORGANIZATION: ${org.key} (${org.projectCount} projects)`, subsep);
    for (const step of (org.steps || [])) {
      formatStepLine(lines, step);
    }
    lines.push('');
  }
}

function formatProblemProjects(lines, results, subsep) {
  const problemProjects = results.projects.filter(p => p.status !== 'success');
  if (problemProjects.length === 0) return;

  lines.push('FAILED / PARTIAL PROJECTS (DETAILED)', subsep);
  for (const project of problemProjects) {
    formatProblemProjectDetail(lines, project);
  }
}

function formatProblemProjectDetail(lines, project) {
  const statusLabel = project.status === 'failed' ? 'FAIL   ' : 'PARTIAL';
  lines.push(`  [${statusLabel}] ${project.projectKey} -> ${project.scProjectKey}`);
  for (const step of project.steps) {
    if (step.status === 'success') {
      lines.push(`    [OK  ] ${step.step}`);
    } else if (step.status === 'failed') {
      lines.push(`    [FAIL] ${step.step}`, `           ${step.error}`);
    } else if (step.status === 'skipped') {
      lines.push(`    [SKIP] ${step.step} -- ${step.detail || ''}`);
    }
  }
  lines.push('');
}

function formatAllProjects(lines, results, subsep) {
  if (results.projects.length === 0) return;

  lines.push('ALL PROJECTS', subsep);
  for (const project of results.projects) {
    formatProjectSummaryLine(lines, project);
  }
  lines.push('');
}

function formatProjectSummaryLine(lines, project) {
  const failedSteps = project.steps.filter(s => s.status === 'failed');
  const icon = getProjectStatusIcon(project.status);
  const detail = failedSteps.length > 0
    ? ` (failed: ${failedSteps.map(s => s.step).join(', ')})`
    : '';
  lines.push(`  [${icon}] ${project.projectKey}${detail}`);
}

function getProjectStatusIcon(status) {
  if (status === 'success') return 'OK     ';
  if (status === 'partial') return 'PARTIAL';
  return 'FAIL   ';
}

function formatEnvironment(lines, results, subsep) {
  const env = results.environment;
  if (!env) return;

  lines.push('RUNTIME ENVIRONMENT', subsep);
  lines.push(`  Platform:     ${env.platform} (${env.arch})`);
  lines.push(`  CPU:          ${env.cpuModel} (${env.cpuCores} cores)`);
  lines.push(`  Memory:       ${formatNumber(env.totalMemoryMB)} MB total`);
  lines.push(`  Node.js:      ${env.nodeVersion}`);
  lines.push(`  Heap Limit:   ${formatNumber(env.heapLimitMB)} MB`);
  lines.push('');
}

function formatConfiguration(lines, results, subsep) {
  const cfg = results.configuration;
  if (!cfg) return;

  lines.push('CONFIGURATION', subsep);
  lines.push(`  Transfer Mode:       ${cfg.transferMode}`);
  lines.push(`  Batch Size:          ${cfg.batchSize}`);
  lines.push(`  Auto-Tune:           ${cfg.autoTune ? 'enabled' : 'disabled'}`);
  lines.push(`  Max Concurrency:     ${cfg.performance.maxConcurrency}`);
  lines.push(`  Source Extraction:   ${cfg.performance.sourceExtraction.concurrency} concurrent`);
  lines.push(`  Hotspot Extraction:  ${cfg.performance.hotspotExtraction.concurrency} concurrent`);
  lines.push(`  Issue Sync:          ${cfg.performance.issueSync.concurrency} concurrent`);
  lines.push(`  Hotspot Sync:        ${cfg.performance.hotspotSync.concurrency} concurrent`);
  lines.push(`  Project Migration:   ${cfg.performance.projectMigration.concurrency} concurrent`);
  if (cfg.rateLimit) {
    lines.push(`  Rate Limit Retries:  ${cfg.rateLimit.maxRetries}`);
    lines.push(`  Rate Limit Delay:    ${cfg.rateLimit.baseDelay}ms`);
    lines.push(`  Min Request Interval: ${cfg.rateLimit.minRequestInterval}ms`);
  }
  lines.push('');
}
