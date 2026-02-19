import logger from '../utils/logger.js';

const STRING_METRICS = new Set([
  'alert_status', 'quality_gate_details',
  'executable_lines_data', 'ncloc_data',
  'conditions_by_line', 'covered_conditions_by_line',
  'it_conditions_by_line', 'it_covered_conditions_by_line'
]);

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

export function buildMeasure(measure) {
  const msg = { metricKey: measure.metric };
  const rawValue = measure.value;

  if (STRING_METRICS.has(measure.metric)) {
    msg.stringValue = { value: String(rawValue) };
  } else if (typeof rawValue === 'boolean') {
    msg.booleanValue = { value: rawValue };
  } else {
    Object.assign(msg, parseMeasureValue(rawValue));
  }

  return msg;
}

export function parseMeasureValue(rawValue) {
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed) || rawValue === '' || rawValue === null || rawValue === undefined) {
    return { stringValue: { value: String(rawValue) } };
  }
  if (Number.isInteger(parsed)) {
    if (parsed >= -2147483648 && parsed <= 2147483647) {
      return { intValue: { value: parsed } };
    }
    return { longValue: { value: parsed } };
  }
  return { doubleValue: { value: parsed } };
}
