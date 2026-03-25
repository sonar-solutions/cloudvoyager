// -------- Format Summary Section --------

import { collectSkippedChecks } from './collect-skipped.js';

/**
 * Format the summary section with check counts and skipped details.
 * @param {object} results - Verification results
 * @returns {string}
 */
export function formatSummary(results) {
  const s = results.summary;
  const lines = ['## Summary\n'];
  const overall = s.failed === 0 && s.errors === 0
    ? 'ALL CHECKS PASSED'
    : `${s.failed} FAILED, ${s.errors} ERRORS`;

  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total checks | ${s.totalChecks} |`);
  lines.push(`| Passed | ${s.passed} |`);
  lines.push(`| Failed | ${s.failed} |`);
  lines.push(`| Warnings (unsyncable) | ${s.warnings} |`);
  lines.push(`| Skipped | ${s.skipped} |`);
  lines.push(`| Errors | ${s.errors} |`);
  lines.push(`| **Overall** | **${overall}** |`);
  lines.push('');

  const skippedChecks = collectSkippedChecks(results);
  if (skippedChecks.length > 0) {
    lines.push('**Skipped checks:**\n');
    for (const { checkName, context, reason } of skippedChecks) {
      const where = context ? ` (${context})` : '';
      lines.push(`- **${checkName}**${where}: ${reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
