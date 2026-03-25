// -------- Format Server Steps --------
import { statusIcon } from './status-icon.js';

export function formatServerSteps(results) {
  if (results.serverSteps.length === 0) return null;
  const lines = [
    '## Server-Wide Steps\n',
    '| Step | Status | Detail |',
    '|------|--------|--------|',
  ];
  for (const step of results.serverSteps) {
    const detail = step.detail || step.error || '';
    lines.push(`| ${step.step} | ${statusIcon(step.status)} | ${detail} |`);
  }
  lines.push('');
  return lines.join('\n');
}
