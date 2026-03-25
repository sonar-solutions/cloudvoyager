import { extractProjectData } from '../projects.js';
import { extractIssues } from '../issues.js';
import { extractMetrics, getCommonMetricKeys } from '../metrics.js';
import { extractComponentMeasures } from '../measures.js';
import { extractActiveRules } from '../rules.js';
import { extractHotspotsAsIssues } from '../hotspots-to-issues.js';

// -------- Main Logic --------

/**
 * Build core extraction phases (project, metrics, components, rules, issues, hotspots).
 *
 * @param {object} extractor - DataExtractor instance
 * @param {object} ctx - Mutable context accumulator
 * @returns {Array<object>} Phase definitions
 */
export function buildMainCorePhases(extractor, ctx) {
  return [
    { name: 'extract:project_metadata', label: 'Step 1: Extracting project data',
      fn: async () => { ctx.project = await extractProjectData(extractor.client); const r = await extractor.client.getLatestAnalysisRevision(); if (r) ctx.scmRevisionId = r; return { project: ctx.project, scmRevisionId: ctx.scmRevisionId }; },
      restore: (d) => { ctx.project = d.project; ctx.scmRevisionId = d.scmRevisionId; } },
    { name: 'extract:metrics', label: 'Step 2: Extracting metrics',
      fn: async () => { ctx.metrics = await extractMetrics(extractor.client); ctx.metricKeys = getCommonMetricKeys(ctx.metrics); return { metrics: ctx.metrics, metricKeys: ctx.metricKeys }; },
      restore: (d) => { ctx.metrics = d.metrics; ctx.metricKeys = d.metricKeys; } },
    { name: 'extract:components', label: 'Step 3: Extracting component measures',
      fn: async () => { ctx.components = await extractComponentMeasures(extractor.client, ctx.metricKeys); return ctx.components; },
      restore: (d) => { ctx.components = d; } },
    { name: 'extract:source_file_list', label: 'Step 3b: Extracting source file list',
      fn: async () => { ctx.sourceFilesList = await extractor.client.getSourceFiles(); return ctx.sourceFilesList; },
      restore: (d) => { ctx.sourceFilesList = d; } },
    { name: 'extract:rules', label: 'Step 4: Extracting active rules',
      fn: async () => { ctx.activeRules = await extractActiveRules(extractor.client, ctx.sourceFilesList); return ctx.activeRules; },
      restore: (d) => { ctx.activeRules = d; } },
    { name: 'extract:issues', label: 'Step 5: Extracting issues',
      fn: async () => { ctx.issues = await extractIssues(extractor.client, extractor.state); return ctx.issues; },
      restore: (d) => { ctx.issues = d; } },
    { name: 'extract:hotspots', label: 'Step 5b: Extracting security hotspots',
      fn: async () => { ctx.hotspotIssues = await extractHotspotsAsIssues(extractor.client); return ctx.hotspotIssues; },
      restore: (d) => { ctx.hotspotIssues = d; } },
  ];
}
