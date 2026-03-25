// -------- Compute Overall Status --------

export function computeOverallStatus(stats) {
  if (stats.failed === 0 && stats.partial === 0) return 'SUCCESS';
  if (stats.failed === 0) return 'PARTIAL SUCCESS';
  if (stats.succeeded === 0 && stats.partial === 0) return 'FAILED';
  return 'PARTIAL SUCCESS';
}
