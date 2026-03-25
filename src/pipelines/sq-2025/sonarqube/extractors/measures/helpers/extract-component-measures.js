import logger from '../../../../../../shared/utils/logger.js';
import { createComponentData } from '../../../models.js';

// -------- Extract Component Measures --------

/** Extract component tree with measures and log breakdown. */
export async function extractComponentMeasures(client, metricKeys, branch = null) {
  logger.info('Extracting component tree with measures...');
  const components = await client.getComponentTree(branch, metricKeys);
  const componentData = components.map(component => createComponentData(component));
  logger.info(`Extracted measures for ${componentData.length} components`);

  const qualifierCounts = {};
  componentData.forEach(comp => {
    qualifierCounts[comp.qualifier] = (qualifierCounts[comp.qualifier] || 0) + 1;
  });

  logger.info('Component breakdown:');
  Object.entries(qualifierCounts).forEach(([qualifier, count]) => {
    logger.info(`  ${qualifier}: ${count}`);
  });

  return componentData;
}
