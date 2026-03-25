// -------- Collect Skipped Checks for PDF --------

/**
 * Collect all skipped checks from results.
 * @param {object} results - Verification results
 * @returns {Array<{checkName: string, context: string, reason: string}>}
 */
export function collectSkippedChecks(results) {
  const skipped = [];

  for (const org of results.orgResults) {
    for (const [name, check] of Object.entries(org.checks || {})) {
      if (check?.status === 'skipped') {
        skipped.push({
          checkName: name,
          context: `org: ${org.orgKey}`,
          reason: check.details || check.error || 'No reason provided',
        });
      }
    }
  }

  for (const project of results.projectResults) {
    for (const [name, check] of Object.entries(project.checks || {})) {
      if (check?.status === 'skipped') {
        skipped.push({
          checkName: name,
          context: `project: ${project.sqProjectKey}`,
          reason: check.details || check.error || 'No reason provided',
        });
      }
    }
  }

  if (results.portfolios?.status === 'skipped') {
    skipped.push({
      checkName: 'Portfolios',
      context: '',
      reason: results.portfolios.details || 'No reason provided',
    });
  }

  return skipped;
}
