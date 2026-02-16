import logger from '../../utils/logger.js';
import { MeasureData, ComponentData } from '../models.js';

/**
 * Extract measures for project
 * @param {SonarQubeClient} client - SonarQube client
 * @param {Array<string>} metricKeys - Metric keys to extract
 * @param {string} branch - Branch name (optional)
 * @returns {Promise<object>}
 */
export async function extractMeasures(client, metricKeys, branch = null) {
  logger.info('Extracting project measures...');

  const projectMeasures = await client.getMeasures(branch, metricKeys);

  const measures = (projectMeasures.measures || []).map(
    measure => new MeasureData(measure, projectMeasures.key)
  );

  logger.info(`Extracted ${measures.length} project-level measures`);

  return {
    component: projectMeasures.key,
    measures
  };
}

/**
 * Extract component tree with measures
 * @param {SonarQubeClient} client - SonarQube client
 * @param {Array<string>} metricKeys - Metric keys to extract
 * @param {string} branch - Branch name (optional)
 * @returns {Promise<Array<ComponentData>>}
 */
export async function extractComponentMeasures(client, metricKeys, branch = null) {
  logger.info('Extracting component tree with measures...');

  const components = await client.getComponentTree(branch, metricKeys);

  const componentData = components.map(component => new ComponentData(component));

  logger.info(`Extracted measures for ${componentData.length} components`);

  // Log breakdown by qualifier
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
