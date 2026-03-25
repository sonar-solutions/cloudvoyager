// -------- Format Server Steps --------
import { formatStepLine } from './step-helpers.js';

export function formatServerSteps(lines, results, subsep) {
  if (results.serverSteps.length === 0) return;
  lines.push('SERVER-WIDE STEPS', subsep);
  for (const step of results.serverSteps) {
    formatStepLine(lines, step);
  }
  lines.push('');
}
