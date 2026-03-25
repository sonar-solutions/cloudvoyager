// -------- PDF Cell Helpers --------
import { formatDuration } from '../../shared.js';

export function h(text) { return { text, style: 'tableHeader' }; }
export function c(text) { return { text, style: 'tableCell' }; }
export function dur(ms) { return ms != null ? formatDuration(ms) : '—'; }
export function sumDurations(steps) { return steps.reduce((sum, s) => sum + (s.durationMs || 0), 0); }

export function stepDur(project, stepName) {
  const step = project.steps.find(s => s.step === stepName);
  if (!step || step.durationMs == null) return '—';
  if (step.status === 'skipped') return 'skipped';
  return formatDuration(step.durationMs);
}

export function configDur(project) {
  const mainSteps = new Set(['Upload scanner report', 'Sync issues', 'Sync hotspots']);
  const total = project.steps.filter(s => !mainSteps.has(s.step)).reduce((sum, s) => sum + (s.durationMs || 0), 0);
  return total > 0 ? formatDuration(total) : '—';
}
