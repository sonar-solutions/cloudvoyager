// -------- Process Project Level --------

import { LEAK_PERIOD_MAP } from './leak-period-map.js';

export function processProjectLevel(projectLevel) {
  const mapper = LEAK_PERIOD_MAP[projectLevel.type];
  return {
    type: projectLevel.type,
    value: projectLevel.value || null,
    settings: mapper ? mapper(projectLevel) : null,
  };
}
