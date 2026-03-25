// -------- Build Measures --------

import logger from '../../../../shared/utils/logger.js';
import { buildMeasure } from './helpers/build-measure.js';

export { buildMeasure } from './helpers/build-measure.js';
export { parseMeasureValue } from './helpers/parse-measure-value.js';

export function buildMeasures(builder) {
  logger.info('Building measure messages...');
  const measuresByComponent = new Map();

  builder.data.components.forEach(comp => {
    if (comp.qualifier !== 'FIL') return;
    if (!builder.componentRefMap.has(comp.key)) return;

    const componentRef = builder.componentRefMap.get(comp.key);
    const measures = comp.measures.map(m => buildMeasure(m));
    if (measures.length > 0) {
      measuresByComponent.set(componentRef, measures);
    }
  });

  let totalMeasures = 0;
  measuresByComponent.forEach(measures => { totalMeasures += measures.length; });

  logger.info(`Built ${totalMeasures} measure messages across ${measuresByComponent.size} components`);
  return measuresByComponent;
}
