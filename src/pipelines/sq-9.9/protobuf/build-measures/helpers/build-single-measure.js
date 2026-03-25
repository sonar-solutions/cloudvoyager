import { parseMeasureValue } from './parse-measure-value.js';

// -------- Build a Single Measure Message --------

const STRING_METRICS = new Set([
  'alert_status', 'quality_gate_details',
  'executable_lines_data', 'ncloc_data',
  'conditions_by_line', 'covered_conditions_by_line',
  'it_conditions_by_line', 'it_covered_conditions_by_line'
]);

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
