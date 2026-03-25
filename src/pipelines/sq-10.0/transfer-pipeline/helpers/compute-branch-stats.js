// -------- Compute Branch Stats --------

/**
 * Compute transfer stats for a single branch from extracted data.
 * @param {object} extractedData - Extracted branch data
 * @returns {object} Stats object
 */
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
