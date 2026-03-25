// -------- Aggregate Branch Results --------

/** Aggregate stats from settled branch transfer results. */
export function aggregateBranchResults(branchResults, aggregatedStats) {
  for (const r of branchResults) {
    if (r.status !== 'fulfilled') continue;
    const val = r.value;
    if (!val) continue;
    if (val.skipped) {
      if (val.addToTransferred) aggregatedStats.branchesTransferred.push(val.branchName);
      continue;
    }
    if (val.branchResult) {
      aggregatedStats.issuesTransferred += val.branchResult.stats.issuesTransferred || 0;
      aggregatedStats.hotspotsTransferred += val.branchResult.stats.hotspotsTransferred || 0;
      aggregatedStats.componentsTransferred += val.branchResult.stats.componentsTransferred || 0;
      aggregatedStats.sourcesTransferred += val.branchResult.stats.sourcesTransferred || 0;
      aggregatedStats.linesOfCode += val.branchResult.stats.linesOfCode || 0;
      aggregatedStats.branchesTransferred.push(val.branchName);
    }
  }
}
