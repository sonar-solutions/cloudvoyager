import logger from '../../utils/logger.js';

const KEY_METRICS = [
  'ncloc', 'lines', 'statements', 'functions', 'classes', 'files',
  'complexity', 'cognitive_complexity',
  'violations', 'bugs', 'vulnerabilities', 'code_smells',
  'coverage', 'line_coverage', 'branch_coverage',
  'duplicated_lines_density', 'duplicated_blocks', 'duplicated_lines'
];

// Metrics that are derived from issue/hotspot counts — already verified by
// the issues/hotspots checkers. Small differences are expected when issue
// counts differ, so these are excluded from strict measure comparison.
const ISSUE_DERIVED_METRICS = new Set([
  'violations', 'bugs', 'vulnerabilities', 'code_smells', 'security_hotspots'
]);

// Metrics where scanner implementation differences can cause small deltas
// (e.g., line counting). Allow a tolerance of 1% for these.
const TOLERANCE_METRICS = new Set(['lines', 'ncloc']);

// Duplication metrics may differ because SQ and SC use different CPD engines
// or configurations. The migration transfers source code but duplication
// detection is recalculated by SC's own engine.
const DUPLICATION_METRICS = new Set([
  'duplicated_lines_density', 'duplicated_blocks', 'duplicated_lines'
]);

/**
 * Verify measures between SonarQube and SonarCloud for a project.
 *
 * @param {object} sqClient - SonarQube client
 * @param {object} scClient - SonarCloud client
 * @param {string} scProjectKey - SonarCloud project key
 * @returns {Promise<object>} Check result
 */
export async function verifyMeasures(sqClient, scClient, scProjectKey) {
  const result = {
    status: 'pass',
    compared: 0,
    mismatches: [],
    sqOnly: [],
    scOnly: []
  };

  let sqMeasures, scMeasures;
  try {
    const sqComponent = await sqClient.getMeasures(null, KEY_METRICS);
    sqMeasures = sqComponent.measures || [];
  } catch (error) {
    logger.warn(`Failed to fetch SQ measures: ${error.message}`);
    sqMeasures = [];
  }

  try {
    const scComponent = await scClient.getProjectMeasures(scProjectKey, KEY_METRICS);
    scMeasures = scComponent.measures || [];
  } catch (error) {
    logger.warn(`Failed to fetch SC measures: ${error.message}`);
    scMeasures = [];
  }

  const sqMap = new Map(sqMeasures.map(m => [m.metric, m.value]));
  const scMap = new Map(scMeasures.map(m => [m.metric, m.value]));

  for (const metric of KEY_METRICS) {
    const sqVal = sqMap.get(metric);
    const scVal = scMap.get(metric);

    if (sqVal === undefined && scVal === undefined) continue;
    if (sqVal !== undefined && scVal === undefined) {
      result.sqOnly.push({ metric, sqValue: sqVal });
      continue;
    }
    if (sqVal === undefined && scVal !== undefined) {
      result.scOnly.push({ metric, scValue: scVal });
      continue;
    }

    result.compared++;
    if (sqVal !== scVal) {
      // Skip issue-derived metrics (already verified by issues/hotspots checker)
      if (ISSUE_DERIVED_METRICS.has(metric)) continue;

      // Skip duplication metrics (recalculated by SC's own engine)
      if (DUPLICATION_METRICS.has(metric)) continue;

      // For line-count metrics, allow 1% tolerance due to scanner differences
      if (TOLERANCE_METRICS.has(metric)) {
        const sqNum = Number.parseFloat(sqVal);
        const scNum = Number.parseFloat(scVal);
        if (!Number.isNaN(sqNum) && !Number.isNaN(scNum) && sqNum > 0) {
          const pctDiff = Math.abs(sqNum - scNum) / sqNum;
          if (pctDiff <= 0.01) continue;
        }
      }

      result.mismatches.push({ metric, sqValue: sqVal, scValue: scVal });
    }
  }

  if (result.mismatches.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Measures verification: ${result.compared} compared, ${result.mismatches.length} mismatches`);
  return result;
}
