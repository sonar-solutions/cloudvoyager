import * as api from './extractor-apis.js';

// -------- Checkpoint Phase Definitions (Main Branch) --------
export function buildMainBranchPhases(extractor, ctx) {
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const srcConc = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConc = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  return [
    { name: 'extract:project_metadata', label: 'Step 1: Extracting project data',
      fn: async () => { ctx.project = await api.extractProjectData(extractor.client); const r = await extractor.client.getLatestAnalysisRevision(); if (r) { ctx.scmRevisionId = r; } return { project: ctx.project, scmRevisionId: ctx.scmRevisionId }; },
      restore: (d) => { ctx.project = d.project; ctx.scmRevisionId = d.scmRevisionId; } },
    { name: 'extract:metrics', label: 'Step 2: Extracting metrics',
      fn: async () => { ctx.metrics = await api.extractMetrics(extractor.client); ctx.metricKeys = api.getCommonMetricKeys(ctx.metrics); return { metrics: ctx.metrics, metricKeys: ctx.metricKeys }; },
      restore: (d) => { ctx.metrics = d.metrics; ctx.metricKeys = d.metricKeys; } },
    { name: 'extract:components', label: 'Step 3: Extracting component measures',
      fn: async () => { ctx.components = await api.extractComponentMeasures(extractor.client, ctx.metricKeys); return ctx.components; },
      restore: (d) => { ctx.components = d; } },
    { name: 'extract:source_file_list', label: 'Step 3b: Extracting source file list',
      fn: async () => { ctx.sourceFilesList = await extractor.client.getSourceFiles(); return ctx.sourceFilesList; },
      restore: (d) => { ctx.sourceFilesList = d; } },
    { name: 'extract:rules', label: 'Step 4: Extracting active rules',
      fn: async () => { ctx.activeRules = await api.extractActiveRules(extractor.client, ctx.sourceFilesList); return ctx.activeRules; },
      restore: (d) => { ctx.activeRules = d; } },
    { name: 'extract:issues', label: 'Step 5: Extracting issues',
      fn: async () => { ctx.issues = await api.extractIssues(extractor.client, extractor.state); return ctx.issues; },
      restore: (d) => { ctx.issues = d; } },
    { name: 'extract:hotspots', label: 'Step 5b: Extracting security hotspots',
      fn: async () => { ctx.hotspotIssues = await api.extractHotspotsAsIssues(extractor.client); return ctx.hotspotIssues; },
      restore: (d) => { ctx.hotspotIssues = d; } },
    { name: 'extract:measures', label: 'Step 6: Extracting project measures',
      fn: async () => { ctx.measures = await api.extractMeasures(extractor.client, ctx.metricKeys); return ctx.measures; },
      restore: (d) => { ctx.measures = d; } },
    { name: 'extract:sources', label: 'Step 7: Extracting source code',
      fn: async () => { ctx.sources = await api.extractSources(extractor.client, null, maxFiles, { concurrency: srcConc }); return ctx.sources; },
      restore: (d) => { ctx.sources = d; } },
    { name: 'extract:duplications', label: 'Step 7b: Extracting duplications',
      fn: async () => { ctx.duplications = await api.extractDuplications(extractor.client, ctx.components, null, { concurrency: dupConc }); return ctx.duplications; },
      restore: (d) => { ctx.duplications = d; } },
    { name: 'extract:changesets', label: 'Step 8: Extracting changesets',
      fn: async () => { ctx.changesets = await api.extractChangesets(extractor.client, ctx.sourceFilesList, ctx.components); return ctx.changesets; },
      restore: (d) => { ctx.changesets = d; } },
    { name: 'extract:symbols', label: 'Step 9: Extracting symbols',
      fn: async () => { ctx.symbols = await api.extractSymbols(extractor.client, ctx.sourceFilesList); return ctx.symbols; },
      restore: (d) => { ctx.symbols = d; } },
    { name: 'extract:syntax_highlighting', label: 'Step 10: Extracting syntax highlighting',
      fn: async () => { ctx.syntaxHighlightings = await api.extractSyntaxHighlighting(extractor.client, ctx.sourceFilesList); return ctx.syntaxHighlightings; },
      restore: (d) => { ctx.syntaxHighlightings = d; } },
  ];
}
