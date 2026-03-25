import { extractIssues } from '../issues.js';
import { extractComponentMeasures } from '../measures.js';
import { extractHotspotsAsIssues } from '../hotspots-to-issues.js';

// -------- Main Logic --------

/**
 * Build core extraction phases for a branch (components, files, issues, hotspots).
 *
 * @param {object} extractor - DataExtractor instance
 * @param {string} branch - Branch name
 * @param {object} ctx - Mutable context accumulator
 * @param {object} opts - { metricKeys }
 * @returns {Array<object>} Phase definitions
 */
export function buildBranchCorePhases(extractor, branch, ctx, opts) {
  const { metricKeys } = opts;
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
