// -------- Parse Measure Value --------

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
