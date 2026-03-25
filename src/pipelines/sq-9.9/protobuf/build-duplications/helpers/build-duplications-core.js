import logger from '../../../../../shared/utils/logger.js';
import { processComponentDuplications } from './process-component-duplications.js';

// -------- Build Duplication Protobuf Messages --------

export function buildDuplications(builder) {
  logger.info('Building duplication messages...');
  const duplicationsMap = builder.data.duplications;
  if (!duplicationsMap || duplicationsMap.size === 0) {
    logger.info('No duplications to build');
    return new Map();
  }

  const duplicationsByComponent = new Map();
  let total = 0;

  duplicationsMap.forEach((data, componentKey) => {
    const componentRef = builder.componentRefMap.get(componentKey);
    if (!componentRef) return;
    const duplications = processComponentDuplications(data, componentKey, builder.componentRefMap);
    if (duplications.length > 0) {
      duplicationsByComponent.set(componentRef, duplications);
      total += duplications.length;
    }
  });

  logger.info(`Built ${total} duplication messages across ${duplicationsByComponent.size} components`);
  return duplicationsByComponent;
}
