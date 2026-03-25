import logger from '../../../../../shared/utils/logger.js';
import { buildMeasure } from './build-measure.js';

// -------- Main Logic --------

// Build measure protobuf messages grouped by component.
export function buildMeasures(builder) {
  logger.info('Building measure messages...');

  const measuresByComponent = new Map();

  builder.data.components.forEach(comp => {
    if (comp.qualifier !== 'FIL') return;
    if (!builder.componentRefMap.has(comp.key)) return;

    const componentRef = builder.componentRefMap.get(comp.key);
    const measures = comp.measures.map(m => buildMeasure(m));

    if (measures.length > 0) measuresByComponent.set(componentRef, measures);
  });

  let totalMeasures = 0;
  measuresByComponent.forEach(measures => { totalMeasures += measures.length; });

  logger.info(`Built ${totalMeasures} measure messages across ${measuresByComponent.size} components`);
  return measuresByComponent;
}
