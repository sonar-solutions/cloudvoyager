// -------- Compare Metrics --------

import { KEY_METRICS, ISSUE_DERIVED_METRICS, TOLERANCE_METRICS, DUPLICATION_METRICS } from './metric-constants.js';

/** Compare SQ and SC measures and populate result. */
export function compareMetrics(sqMeasures, scMeasures, result) {
  const sqMap = new Map(sqMeasures.map(m => [m.metric, m.value]));
  const scMap = new Map(scMeasures.map(m => [m.metric, m.value]));

  for (const metric of KEY_METRICS) {
    const sqVal = sqMap.get(metric);
    const scVal = scMap.get(metric);

    if (sqVal === undefined && scVal === undefined) continue;
    if (sqVal !== undefined && scVal === undefined) { result.sqOnly.push({ metric, sqValue: sqVal }); continue; }
    if (sqVal === undefined && scVal !== undefined) { result.scOnly.push({ metric, scValue: scVal }); continue; }

    result.compared++;
    if (sqVal === scVal) continue;
    if (ISSUE_DERIVED_METRICS.has(metric)) continue;
    if (DUPLICATION_METRICS.has(metric)) continue;

    if (TOLERANCE_METRICS.has(metric)) {
      const sqNum = Number.parseFloat(sqVal);
      const scNum = Number.parseFloat(scVal);
      if (!Number.isNaN(sqNum) && !Number.isNaN(scNum) && sqNum > 0) {
        if (Math.abs(sqNum - scNum) / sqNum <= 0.01) continue;
      }
    }

    result.mismatches.push({ metric, sqValue: sqVal, scValue: scVal });
  }
}
