import { extractIssues } from '../issues.js';
import { extractComponentMeasures } from '../measures.js';
import { extractHotspotsAsIssues } from '../hotspots-to-issues.js';

// -------- Branch Phases Part 1: Components through Hotspots --------

export function buildBranchPhasesPart1(extractor, branch, metricKeys, ctx) {
  return [
    { name: 'extract:components', label: `[${branch}] Extracting component measures`,
      fn: async () => { ctx.components = await extractComponentMeasures(extractor.client, metricKeys, branch); return ctx.components; },
      restore: (d) => { ctx.components = d; } },
    { name: 'extract:source_file_list', label: `[${branch}] Extracting source file list`,
      fn: async () => { ctx.sourceFilesList = await extractor.client.getSourceFiles(branch); return ctx.sourceFilesList; },
      restore: (d) => { ctx.sourceFilesList = d; } },
    { name: 'extract:issues', label: `[${branch}] Extracting issues`,
      fn: async () => { ctx.issues = await extractIssues(extractor.client, extractor.state, branch); return ctx.issues; },
      restore: (d) => { ctx.issues = d; } },
    { name: 'extract:hotspots', label: `[${branch}] Extracting security hotspots`,
      fn: async () => { ctx.hotspotIssues = await extractHotspotsAsIssues(extractor.client, branch); return ctx.hotspotIssues; },
      restore: (d) => { ctx.hotspotIssues = d; } },
  ];
}
