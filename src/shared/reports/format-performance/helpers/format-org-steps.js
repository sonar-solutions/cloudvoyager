// -------- Format Org Steps --------
import { formatDuration } from '../../shared.js';
import { sumDurations } from '../../perf-tables.js';

export function formatOrgSteps(results) {
  if (!results.orgResults || results.orgResults.length === 0) return null;
  const sections = [];
  for (const org of results.orgResults) {
    const lines = [`## Organization: ${org.key}\n`];
    if (org.durationMs != null) lines.push(`**Total org migration time:** ${formatDuration(org.durationMs)}\n`);
    if (org.steps && org.steps.length > 0) {
      lines.push('| Step | Duration | Status | Detail |');
      lines.push('|------|----------|--------|--------|');
      for (const step of org.steps) {
        const dur = step.durationMs != null ? formatDuration(step.durationMs) : '—';
        const detail = step.detail || step.error || '';
        lines.push(`| ${step.step} | ${dur} | ${step.status} | ${detail} |`);
      }
      const total = sumDurations(org.steps);
      lines.push(`| **Total (org steps)** | **${formatDuration(total)}** | | |`);
    }
    lines.push('');
    sections.push(lines.join('\n'));
  }
  return sections.join('\n');
}
