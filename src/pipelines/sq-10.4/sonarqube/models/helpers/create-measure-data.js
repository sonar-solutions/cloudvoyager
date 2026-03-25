// -------- Main Logic --------

// Create a measure data object from a SonarQube measure.
export function createMeasureData(measure, componentKey) {
  return {
    metric: measure.metric,
    value: measure.value,
    component: componentKey,
    bestValue: measure.bestValue,
    period: measure.period,
  };
}
