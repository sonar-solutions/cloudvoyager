// -------- Metric Data Factory --------

export function createMetricData(metric) {
  return {
    key: metric.key,
    name: metric.name,
    description: metric.description,
    domain: metric.domain,
    type: metric.type,
    direction: metric.direction,
    qualitative: metric.qualitative,
    hidden: metric.hidden,
  };
}
