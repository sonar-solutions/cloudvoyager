// -------- Create Empty Results --------

/**
 * Create a fresh empty results object for the verification pipeline.
 * @returns {object} Empty results structure
 */
export function createEmptyResults() {
  return {
    startTime: null,
    endTime: null,
    summary: { totalChecks: 0, passed: 0, failed: 0, warnings: 0, skipped: 0, errors: 0 },
    orgResults: [],
    projectResults: [],
    portfolios: null,
    environment: null,
  };
}
