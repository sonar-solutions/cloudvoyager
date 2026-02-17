import logger from '../../utils/logger.js';

/**
 * Map SonarQube new code period types to SonarCloud types
 */
const TYPE_MAP = {
  'NUMBER_OF_DAYS': 'days',
  'PREVIOUS_VERSION': 'previous_version',
  'SPECIFIC_ANALYSIS': 'specific_analysis',
  'REFERENCE_BRANCH': 'reference_branch'
};

/**
 * Extract new code period definitions for a project (per-project and per-branch)
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} [projectKey] - Project key (defaults to client's projectKey)
 * @returns {Promise<Array>} New code period definitions
 */
export async function extractNewCodePeriods(client, projectKey = null) {
  const periods = await client.getNewCodePeriods(projectKey);
  logger.info(`Found ${periods.length} new code period definitions`);

  return periods.map(period => ({
    projectKey: period.projectKey,
    branchKey: period.branchKey || null,
    type: TYPE_MAP[period.type] || period.type,
    value: period.value || null,
    effectiveValue: period.effectiveValue || null,
    inherited: period.inherited || false
  }));
}
