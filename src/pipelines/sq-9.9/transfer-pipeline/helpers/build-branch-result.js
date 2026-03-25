// -------- Build Branch Transfer Result --------

export function buildBranchResult(extractedData, ceTask) {
  const nclocMeasure = (extractedData.measures.measures || []).find(m => m.metric === 'ncloc');
  const hotspotCount = extractedData.issues.filter(i => i.type === 'SECURITY_HOTSPOT').length;

  return {
    stats: {
      issuesTransferred: extractedData.issues.length - hotspotCount,
      hotspotsTransferred: hotspotCount,
      componentsTransferred: extractedData.components.length,
      sourcesTransferred: extractedData.sources.length,
      linesOfCode: nclocMeasure ? Number.parseInt(nclocMeasure.value, 10) || 0 : 0,
    },
    ceTask,
  };
}
