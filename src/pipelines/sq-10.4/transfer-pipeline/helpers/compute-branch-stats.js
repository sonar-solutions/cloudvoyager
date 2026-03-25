// -------- Main Logic --------

/**
 * Compute transfer statistics for a branch.
 *
 * @param {object} extractedData - Data from extractAll() or extractBranch()
 * @returns {object} Branch transfer stats
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
