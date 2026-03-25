// -------- Markdown Project Results --------

import { formatDetailSections } from '../detail-sections.js';
import { buildCheckRows } from './helpers/build-check-rows.js';

/**
 * Format all per-project check results as markdown.
 * @param {object} results - Full verification results
 * @param {function} statusIcon - Status icon helper
 * @returns {string} Formatted markdown string
 */
export function formatProjectResults(results, statusIcon) {
  if (results.projectResults.length === 0) return '';

  const lines = ['## Per-Project Checks\n'];

  for (const project of results.projectResults) {
    const checks = Object.values(project.checks || {});
    const fails = checks.filter(c => c.status === 'fail').length;
    const icon = fails === 0 ? statusIcon('pass') : statusIcon('fail');

    lines.push(`### ${icon} ${project.sqProjectKey} → ${project.scProjectKey}\n`);
    lines.push(...buildCheckRows(project.checks, statusIcon));
    lines.push('');
    formatDetailSections(project.checks, lines);
  }

  return lines.join('\n');
}
