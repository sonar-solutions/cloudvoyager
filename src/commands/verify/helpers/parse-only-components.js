// -------- Parse Only Components --------

import logger from '../../../shared/utils/logger.js';

const VALID_ONLY_COMPONENTS = [
  'scan-data', 'scan-data-all-branches', 'portfolios', 'quality-gates',
  'quality-profiles', 'permission-templates', 'permissions',
  'issue-metadata', 'hotspot-metadata', 'project-settings'
];

export function parseOnlyComponents(options) {
  if (!options.only) return null;

  const onlyComponents = options.only.split(',').map(s => s.trim()).filter(Boolean);
  const invalid = onlyComponents.filter(c => !VALID_ONLY_COMPONENTS.includes(c));
  if (invalid.length > 0) {
    logger.error(`Invalid --only component(s): ${invalid.join(', ')}`);
    logger.error(`Valid components: ${VALID_ONLY_COMPONENTS.join(', ')}`);
    process.exit(1);
  }
  logger.info(`Selective verification: only checking [${onlyComponents.join(', ')}]`);
  return onlyComponents;
}
