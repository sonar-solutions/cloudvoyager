// -------- Duration Helpers --------
import { formatDuration } from '../../shared.js';

export function sumDurations(steps) {
  return (steps || []).reduce((sum, s) => sum + (s.durationMs || 0), 0);
}

export function getStepDuration(project, stepName) {
  const step = project.steps.find(s => s.step === stepName);
  if (!step || step.durationMs == null) return '—';
  if (step.status === 'skipped') return 'skipped';
  return formatDuration(step.durationMs);
}

export function getConfigDuration(project) {
  const mainSteps = new Set(['Upload scanner report', 'Sync issues', 'Sync hotspots']);
  const total = project.steps.filter(s => !mainSteps.has(s.step)).reduce((sum, s) => sum + (s.durationMs || 0), 0);
  return total > 0 ? formatDuration(total) : '—';
}
