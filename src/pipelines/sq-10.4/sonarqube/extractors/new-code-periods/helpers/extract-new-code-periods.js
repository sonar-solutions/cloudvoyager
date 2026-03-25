import logger from '../../../../../../shared/utils/logger.js';
import { LEAK_PERIOD_MAP } from './leak-period-map.js';

// -------- Main Logic --------

// Extract new code period definitions for a project.
export async function extractNewCodePeriods(client, projectKey = null) {
  const { projectLevel, branchOverrides } = await client.getNewCodePeriods(projectKey);
  const result = { projectLevel: null, branchOverrides: [] };

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
