// -------- Format Organization Results --------

import { formatCheckRows } from './format-org-results/format-check-rows.js';
import { formatMissingItems } from './format-org-results/format-missing-items.js';

/**
 * Format the organization-level checks section.
 * @param {object} results - Verification results
 * @returns {string}
 */
export function formatOrgResults(results) {
  if (results.orgResults.length === 0) return '';

  const lines = ['## Organization-Level Checks\n'];

  for (const org of results.orgResults) {
    lines.push(`### Organization: ${org.orgKey}\n`);

    if (org.error) {
      lines.push(`**Error:** ${org.error}\n`);
      continue;
    }

    const checks = org.checks || {};
    lines.push(`| Check | Status | Details |`);
    lines.push(`|-------|--------|---------|`);

    formatCheckRows(checks, lines);
    lines.push('');
    formatMissingItems(checks, lines);
  }

  return lines.join('\n');
}
