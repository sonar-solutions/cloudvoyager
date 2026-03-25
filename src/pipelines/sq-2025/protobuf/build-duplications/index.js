import { processComponentDuplications } from './helpers/process-component-duplications.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Build Duplications --------

/** Build Duplication protobuf messages from extracted SonarQube duplication data. */
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
    const componentRef = builder.componentRefMap.get(componentKey);
    if (!componentRef) return;

    // Attach _componentKey for the helper to use
    data._componentKey = componentKey;
    const duplications = processComponentDuplications(data, builder.componentRefMap);

    if (duplications.length > 0) {
      duplicationsByComponent.set(componentRef, duplications);
      totalDuplications += duplications.length;
    }
  });

  logger.info(`Built ${totalDuplications} duplication messages across ${duplicationsByComponent.size} components`);
  return duplicationsByComponent;
}
