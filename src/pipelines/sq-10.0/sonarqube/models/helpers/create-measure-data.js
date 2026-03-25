// -------- Create Measure Data --------

export function createMeasureData(measure, componentKey) {
  return {
    metric: measure.metric,
    value: measure.value,
    component: componentKey,
    bestValue: measure.bestValue,
    period: measure.period,
  };
}
