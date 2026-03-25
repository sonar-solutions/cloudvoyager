import logger from '../../../../../shared/utils/logger.js';
import { processComponentDuplications } from './process-component-duplications.js';

// -------- Main Logic --------

// Build Duplication protobuf messages from extracted SonarQube duplication data.
export function buildDuplications(builder) {
  logger.info('Building duplication messages...');

  const duplicationsMap = builder.data.duplications;
  if (!duplicationsMap || duplicationsMap.size === 0) {
    logger.info('No duplications to build');
    return new Map();
  }

  const duplicationsByComponent = new Map();
  let totalDuplications = 0;

  duplicationsMap.forEach((data, componentKey) => {
    const result = processComponentDuplications(componentKey, data, builder.componentRefMap);
    if (result) {
      duplicationsByComponent.set(result.componentRef, result.duplications);
      totalDuplications += result.duplications.length;
    }
  });

  logger.info(`Built ${totalDuplications} duplication messages across ${duplicationsByComponent.size} components`);
  return duplicationsByComponent;
}
