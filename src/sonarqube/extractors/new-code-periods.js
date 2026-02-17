import logger from '../../utils/logger.js';

/**
 * Map SonarQube new code period types to sonar.leak.period values for SonarCloud.
 * SonarCloud staging does not have the /api/new_code_periods/* endpoints.
 * Instead, new code definitions are set via api/settings/set with key=sonar.leak.period.
 *
 * sonar.leak.period accepts:
 *   - A number (number of days, e.g. "30")
 *   - "previous_version"
 */
const LEAK_PERIOD_VALUE_MAP = {
  'NUMBER_OF_DAYS': (period) => period.value,
  'PREVIOUS_VERSION': () => 'previous_version',
};

/**
 * Extract new code period definitions for a project.
 * Fetches both the project-level definition (/show) and branch-level overrides (/list).
 * Returns a structure the migrator can use to set sonar.leak.period on SonarCloud.
 *
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} [projectKey] - Project key (defaults to client's projectKey)
 * @returns {Promise<{projectLevel: object|null, branchOverrides: Array}>}
 */
export async function extractNewCodePeriods(client, projectKey = null) {
  const { projectLevel, branchOverrides } = await client.getNewCodePeriods(projectKey);

  const result = { projectLevel: null, branchOverrides: [] };

  // Process project-level definition
  if (projectLevel && !projectLevel.inherited) {
    const mapper = LEAK_PERIOD_VALUE_MAP[projectLevel.type];
    result.projectLevel = {
      type: projectLevel.type,
      value: projectLevel.value || null,
      leakPeriodValue: mapper ? mapper(projectLevel) : null,
    };
    const valueSuffix = projectLevel.value ? '=' + projectLevel.value : '';
    logger.info(`Project-level new code definition: ${projectLevel.type}${valueSuffix}`);
  }

  // Process branch-level overrides
  for (const branch of branchOverrides) {
    if (branch.inherited) continue;
    const mapper = LEAK_PERIOD_VALUE_MAP[branch.type];
    result.branchOverrides.push({
      branchKey: branch.branchKey,
      type: branch.type,
      value: branch.value || null,
      leakPeriodValue: mapper ? mapper(branch) : null,
    });
  }

  if (result.branchOverrides.length > 0) {
    logger.info(`Found ${result.branchOverrides.length} branch-level new code definition overrides`);
  }

  return result;
}
