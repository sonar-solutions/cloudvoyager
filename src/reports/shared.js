/**
 * Shared computation helpers used by all report formatters.
 */

/**
 * Format milliseconds as human-readable duration.
 */
export function formatDuration(ms) {
  if (ms == null || ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  if (seconds > 0) {
    return `${seconds}s`;
  }
  return `${ms}ms`;
}

/**
 * Compute project status counts from results.
 */
export function computeProjectStats(results) {
  const succeeded = results.projects.filter(p => p.status === 'success').length;
  const partial = results.projects.filter(p => p.status === 'partial').length;
  const failed = results.projects.filter(p => p.status === 'failed').length;
  const total = results.projects.length;
  return { succeeded, partial, failed, total };
}

/**
 * Determine overall migration status label.
 */
export function computeOverallStatus(stats) {
  if (stats.failed === 0 && stats.partial === 0) return 'SUCCESS';
  if (stats.failed === 0) return 'PARTIAL SUCCESS';
  if (stats.succeeded === 0 && stats.partial === 0) return 'FAILED';
  return 'PARTIAL SUCCESS';
}

/**
 * Collect projects where new code period was skipped due to unsupported types.
 */
export function getNewCodePeriodSkippedProjects(results) {
  const skipped = [];
  for (const project of results.projects) {
    const ncpStep = project.steps.find(s => s.step === 'New code definitions' && s.status === 'skipped');
    if (ncpStep) {
      skipped.push({ projectKey: project.projectKey, detail: ncpStep.detail });
    }
  }
  return skipped;
}

/**
 * Get projects that are not fully successful.
 */
export function getProblemProjects(results) {
  return results.projects.filter(p => p.status !== 'success');
}

/**
 * Compute total migration duration in ms from results timestamps.
 */
export function computeTotalDurationMs(results) {
  if (!results.startTime || !results.endTime) return null;
  return new Date(results.endTime) - new Date(results.startTime);
}
