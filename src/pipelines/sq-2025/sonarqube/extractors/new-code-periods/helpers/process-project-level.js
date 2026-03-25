import logger from '../../../../../../shared/utils/logger.js';
import { LEAK_PERIOD_MAP } from './leak-period-map.js';

// -------- Process Project Level --------

/** Process project-level new code period definition. */
export function processProjectLevel(projectLevel) {
  if (!projectLevel) return null;

  const mapper = LEAK_PERIOD_MAP[projectLevel.type];
  const valueSuffix = projectLevel.value ? '=' + projectLevel.value : '';
  const inheritedLabel = projectLevel.inherited ? ' (inherited from instance)' : '';
  logger.info(`Project-level new code definition: ${projectLevel.type}${valueSuffix}${inheritedLabel}`);

  return {
    type: projectLevel.type,
    value: projectLevel.value || null,
    settings: mapper ? mapper(projectLevel) : null,
  };
}
