// -------- Compute Branch Stats --------

/** Compute transfer stats for a branch. */
export function computeBranchStats(extractedData) {
  const nclocMeasure = (extractedData.measures.measures || []).find(m => m.metric === 'ncloc');
  const hotspotCount = extractedData.issues.filter(i => i.type === 'SECURITY_HOTSPOT').length;

  return {
    issuesTransferred: extractedData.issues.length - hotspotCount,
    hotspotsTransferred: hotspotCount,
    componentsTransferred: extractedData.components.length,
    sourcesTransferred: extractedData.sources.length,
    linesOfCode: nclocMeasure ? parseInt(nclocMeasure.value, 10) || 0 : 0,
  };
}
