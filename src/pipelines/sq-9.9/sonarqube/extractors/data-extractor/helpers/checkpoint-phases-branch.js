import { extractIssues, getCommonMetricKeys, extractMeasures, extractComponentMeasures, extractSources, extractChangesets, extractSymbols, extractSyntaxHighlighting, extractHotspotsAsIssues, extractDuplications } from './extractor-apis.js';

// -------- Checkpoint Phase Definitions (Branch) --------

export function buildBranchPhases(extractor, branch, mainData, ctx) {
  const metricKeys = getCommonMetricKeys(mainData.metrics);
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const srcConc = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConc = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  return [
    { name: 'extract:scm_revision', label: `[${branch}] Fetching SCM revision`,
      fn: async () => { const r = await extractor.client.getLatestAnalysisRevision(branch); if (r) { ctx.scmRevisionId = r; } return ctx.scmRevisionId; },
      restore: (d) => { ctx.scmRevisionId = d; } },
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
    { name: 'extract:measures', label: `[${branch}] Extracting project measures`,
      fn: async () => { ctx.measures = await extractMeasures(extractor.client, metricKeys, branch); return ctx.measures; },
      restore: (d) => { ctx.measures = d; } },
    { name: 'extract:sources', label: `[${branch}] Extracting source code`,
      fn: async () => { ctx.sources = await extractSources(extractor.client, branch, maxFiles, { concurrency: srcConc }); return ctx.sources; },
      restore: (d) => { ctx.sources = d; } },
    { name: 'extract:duplications', label: `[${branch}] Extracting duplications`,
      fn: async () => { ctx.duplications = await extractDuplications(extractor.client, ctx.components, branch, { concurrency: dupConc }); return ctx.duplications; },
      restore: (d) => { ctx.duplications = d; } },
    { name: 'extract:changesets', label: `[${branch}] Extracting changesets`,
      fn: async () => { ctx.changesets = await extractChangesets(extractor.client, ctx.sourceFilesList, ctx.components); return ctx.changesets; },
      restore: (d) => { ctx.changesets = d; } },
    { name: 'extract:symbols', label: `[${branch}] Extracting symbols`,
      fn: async () => { ctx.symbols = await extractSymbols(extractor.client, ctx.sourceFilesList); return ctx.symbols; },
      restore: (d) => { ctx.symbols = d; } },
    { name: 'extract:syntax_highlighting', label: `[${branch}] Extracting syntax highlighting`,
      fn: async () => { ctx.syntaxHighlightings = await extractSyntaxHighlighting(extractor.client, ctx.sourceFilesList); return ctx.syntaxHighlightings; },
      restore: (d) => { ctx.syntaxHighlightings = d; } },
  ];
}
