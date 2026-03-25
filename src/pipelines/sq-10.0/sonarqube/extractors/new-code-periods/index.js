// -------- Extract New Code Periods --------

import logger from '../../../../../shared/utils/logger.js';
import { LEAK_PERIOD_MAP } from './helpers/leak-period-map.js';
import { processProjectLevel } from './helpers/process-project-level.js';
import { processBranchOverrides } from './helpers/process-branch-overrides.js';

export async function extractNewCodePeriods(client, projectKey = null) {
  const { projectLevel, branchOverrides } = await client.getNewCodePeriods(projectKey);
  const result = { projectLevel: null, branchOverrides: [] };

  if (projectLevel) {
    result.projectLevel = processProjectLevel(projectLevel);
    const valueSuffix = projectLevel.value ? '=' + projectLevel.value : '';
    const inheritedLabel = projectLevel.inherited ? ' (inherited from instance)' : '';
    logger.info(`Project-level new code definition: ${projectLevel.type}${valueSuffix}${inheritedLabel}`);
  }

  result.branchOverrides = processBranchOverrides(branchOverrides);

  if (result.branchOverrides.length > 0) {
    logger.info(`Found ${result.branchOverrides.length} branch-level new code definition overrides`);
  }

  return result;
}
