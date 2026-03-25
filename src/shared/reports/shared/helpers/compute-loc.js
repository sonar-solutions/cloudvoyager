// -------- Compute LOC --------
import { computeTotalDurationMs } from './compute-duration.js';

export function computeTotalLoc(results) {
  return results.totalLinesOfCode || 0;
}

export function computeLocThroughput(results) {
  const totalLoc = computeTotalLoc(results);
  const durationMs = computeTotalDurationMs(results);
  const projectCount = results.projects.length;
  const durationSec = durationMs != null && durationMs > 0 ? durationMs / 1000 : null;
  return {
    locPerSecond: durationSec != null ? Math.round(totalLoc / durationSec) : null,
    locPerMinute: durationSec != null ? Math.round(totalLoc / (durationSec / 60)) : null,
    avgLocPerProject: projectCount > 0 ? Math.round(totalLoc / projectCount) : 0,
  };
}
