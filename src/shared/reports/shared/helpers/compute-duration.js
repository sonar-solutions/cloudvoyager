// -------- Compute Total Duration --------

export function computeTotalDurationMs(results) {
  if (!results.startTime || !results.endTime) return null;
  return new Date(results.endTime) - new Date(results.startTime);
}
