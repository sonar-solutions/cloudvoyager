// -------- Build Status Banner --------

export function buildStatusBanner(stats, overallStatus) {
  const successRate = stats.total > 0
    ? ((stats.succeeded / stats.total) * 100).toFixed(1) : '0.0';
  let bannerStyle = 'bannerSuccess';
  if (overallStatus === 'FAILED') bannerStyle = 'bannerFail';
  else if (overallStatus === 'PARTIAL SUCCESS') bannerStyle = 'bannerPartial';
  const nodes = [
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#cccccc' }], margin: [0, 10, 0, 0] },
    { text: `Overall Status: ${overallStatus}`, style: bannerStyle },
  ];
  if (stats.total === 0) {
    nodes.push({ text: 'No projects were migrated.', style: 'bodyText' });
  } else if (stats.failed === 0 && stats.partial === 0) {
    nodes.push({ text: `Migration of ${stats.total} project(s) completed with a ${successRate}% success rate.`, style: 'bodyText' });
  } else {
    nodes.push({ text: `Migration of ${stats.total} project(s) completed with ${stats.succeeded} fully migrated (${successRate}% success rate).`, style: 'bodyText' });
    if (stats.partial > 0) nodes.push({ text: `${stats.partial} project(s) partially migrated (some steps failed).`, style: 'bodyText' });
    if (stats.failed > 0) nodes.push({ text: `${stats.failed} project(s) failed entirely.`, style: 'bodyText' });
  }
  return nodes;
}
