// -------- Compute Summary --------

import { countCheck } from './count-check.js';

/**
 * Compute the summary totals from all check results.
 * Mutates `results.summary` in place.
 * @param {object} results - Full verification results
 */
export function computeSummary(results) {
  const counters = { total: 0, passed: 0, failed: 0, warnings: 0, skipped: 0, errors: 0 };

  for (const org of results.orgResults) {
    for (const check of Object.values(org.checks || {})) {
      countCheck(check, counters);
    }
  }

  for (const project of results.projectResults) {
    for (const check of Object.values(project.checks || {})) {
      countCheck(check, counters);
    }
  }

  if (results.portfolios) countCheck(results.portfolios, counters);

  results.summary = {
    totalChecks: counters.total,
    passed: counters.passed,
    failed: counters.failed,
    warnings: counters.warnings,
    skipped: counters.skipped,
    errors: counters.errors,
  };
}
