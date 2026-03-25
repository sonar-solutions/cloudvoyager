import logger from '../../../../../../shared/utils/logger.js';
import { LEAK_PERIOD_MAP } from './leak-period-map.js';

// -------- Process Branch Overrides --------

/** Process branch-level new code period overrides. */
export function processBranchOverrides(branchOverrides) {
  const result = [];

  for (const branch of branchOverrides) {
    const mapper = LEAK_PERIOD_MAP[branch.type];
    result.push({
      branchKey: branch.branchKey,
      type: branch.type,
      value: branch.value || null,
      settings: mapper ? mapper(branch) : null,
    });
  }

  if (result.length > 0) {
    logger.info(`Found ${result.length} branch-level new code definition overrides`);
  }

  return result;
}
