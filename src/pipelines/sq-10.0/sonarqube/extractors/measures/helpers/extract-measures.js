// -------- Extract Measures --------

import logger from '../../../../../../shared/utils/logger.js';
import { createMeasureData } from '../../../models.js';

export async function extractMeasures(client, metricKeys, branch = null) {
  logger.info('Extracting project measures...');
  const projectMeasures = await client.getMeasures(branch, metricKeys);

  const measures = (projectMeasures.measures || []).map(
    measure => createMeasureData(measure, projectMeasures.key)
  );

  logger.info(`Extracted ${measures.length} project-level measures`);
  return { component: projectMeasures.key, measures };
}
