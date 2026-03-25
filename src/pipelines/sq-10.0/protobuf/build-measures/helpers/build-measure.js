// -------- Build Measure --------

import { parseMeasureValue } from './parse-measure-value.js';
import { STRING_METRICS } from './string-metrics.js';

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
