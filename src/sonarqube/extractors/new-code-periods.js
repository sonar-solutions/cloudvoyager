import logger from '../../utils/logger.js';

/**
 * Map SonarQube new code period types to SonarCloud settings.
 * SonarCloud staging does not have the /api/new_code_periods/* endpoints.
 * Instead, new code definitions are set via api/settings/set with key=sonar.leak.period:
 *   - PREVIOUS_VERSION → sonar.leak.period=previous_version
 *   - NUMBER_OF_DAYS   → sonar.leak.period=<number>
 *
 * Returns the value to set for sonar.leak.period.
 */
const LEAK_PERIOD_MAP = {
  'NUMBER_OF_DAYS': (period) => [
    { key: 'sonar.leak.period', value: period.value },
    { key: 'sonar.leak.period.type', value: 'days' },
  ],
  'PREVIOUS_VERSION': () => [
    { key: 'sonar.leak.period', value: 'previous_version' },
    { key: 'sonar.leak.period.type', value: 'previous_version' },
  ],
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

  // Process project-level definition (include inherited to preserve effective setting)
  if (projectLevel) {
    const mapper = LEAK_PERIOD_MAP[projectLevel.type];
    result.projectLevel = {
      type: projectLevel.type,
      value: projectLevel.value || null,
      settings: mapper ? mapper(projectLevel) : null,
    };
    const valueSuffix = projectLevel.value ? '=' + projectLevel.value : '';
    const inheritedLabel = projectLevel.inherited ? ' (inherited from instance)' : '';
    logger.info(`Project-level new code definition: ${projectLevel.type}${valueSuffix}${inheritedLabel}`);
  }

  // Process branch-level overrides (include inherited to preserve effective settings)
  for (const branch of branchOverrides) {
    const mapper = LEAK_PERIOD_MAP[branch.type];
    result.branchOverrides.push({
      branchKey: branch.branchKey,
      type: branch.type,
      value: branch.value || null,
      settings: mapper ? mapper(branch) : null,
    });
  }

  if (result.branchOverrides.length > 0) {
    logger.info(`Found ${result.branchOverrides.length} branch-level new code definition overrides`);
  }

  return result;
}
