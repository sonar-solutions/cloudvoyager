// -------- Format Org Results --------
import { statusIcon } from './status-icon.js';

export function formatOrgResults(results) {
  if (!results.orgResults || results.orgResults.length === 0) return null;
  const sections = [];
  for (const org of results.orgResults) {
    const lines = [
      `## Organization: ${org.key} (${org.projectCount} projects)\n`,
      '| Step | Status | Detail |',
      '|------|--------|--------|',
    ];
    for (const step of (org.steps || [])) {
      const detail = step.detail || step.error || '';
      lines.push(`| ${step.step} | ${statusIcon(step.status)} | ${detail} |`);
    }
    lines.push('');
    sections.push(lines.join('\n'));
  }
  return sections.join('\n');
}
