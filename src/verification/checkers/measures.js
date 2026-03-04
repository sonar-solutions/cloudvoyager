import logger from '../../utils/logger.js';

const KEY_METRICS = [
  'ncloc', 'lines', 'statements', 'functions', 'classes', 'files',
  'complexity', 'cognitive_complexity',
  'violations', 'bugs', 'vulnerabilities', 'code_smells',
  'coverage', 'line_coverage', 'branch_coverage',
  'duplicated_lines_density', 'duplicated_blocks', 'duplicated_lines'
];

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
      result.mismatches.push({ metric, sqValue: sqVal, scValue: scVal });
    }
  }

  if (result.mismatches.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Measures verification: ${result.compared} compared, ${result.mismatches.length} mismatches`);
  return result;
}
