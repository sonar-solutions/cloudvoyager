// -------- Process Branch Overrides --------

import { LEAK_PERIOD_MAP } from './leak-period-map.js';

export function processBranchOverrides(branchOverrides) {
  return branchOverrides.map(branch => {
    const mapper = LEAK_PERIOD_MAP[branch.type];
    return {
      branchKey: branch.branchKey,
      type: branch.type,
      value: branch.value || null,
      settings: mapper ? mapper(branch) : null,
    };
  });
}
