import logger from '../../../../shared/utils/logger.js';
import { extractProjectData } from './projects.js';
import { extractIssues } from './issues.js';
import { extractMetrics, getCommonMetricKeys } from './metrics.js';
import { extractMeasures, extractComponentMeasures } from './measures.js';
import { extractSources } from './sources.js';
import { extractActiveRules } from './rules.js';
import { extractChangesets } from './changesets.js';
import { extractSymbols } from './symbols.js';
import { extractSyntaxHighlighting } from './syntax-highlighting.js';
import { extractHotspotsAsIssues } from './hotspots-to-issues.js';
import { extractDuplications } from './duplications.js';
import { checkShutdown } from '../../../../shared/utils/shutdown.js';

/**
 * Extract all data with checkpoint support for pause/resume.
 *
 * Each extraction step is guarded by the journal: completed phases are loaded
 * from cache, in-progress phases are re-executed, and shutdown checks run
 * between phases for graceful interruption.
 *
 * @param {import('./index.js').DataExtractor} extractor - DataExtractor instance
 * @param {import('../../../../shared/state/checkpoint.js').CheckpointJournal} journal
 * @param {import('../../../../shared/state/extraction-cache.js').ExtractionCache} cache
 * @param {Function} shutdownCheck - () => boolean
 * @returns {Promise<object>} Extracted data (same shape as extractAll)
 */
export async function extractAllWithCheckpoints(extractor, journal, cache, shutdownCheck) {
  logger.info('Starting checkpoint-aware data extraction from SonarQube...');

  const startTime = Date.now();
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const sourceConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  // Accumulated context that phases can read from and write to
  const ctx = {
    project: null,
    metrics: [],
    metricKeys: [],
    components: [],
    sourceFilesList: [],
    activeRules: [],
    issues: [],
    hotspotIssues: [],
    measures: {},
    sources: [],
    duplications: new Map(),
    changesets: new Map(),
    symbols: new Map(),
    syntaxHighlightings: new Map(),
    scmRevisionId: null,
  };

  const phases = [
    {
      name: 'extract:project_metadata',
      label: 'Step 1: Extracting project data',
      fn: async () => {
        ctx.project = await extractProjectData(extractor.client);
        const scmRevision = await extractor.client.getLatestAnalysisRevision();
        if (scmRevision) ctx.scmRevisionId = scmRevision;
        return { project: ctx.project, scmRevisionId: ctx.scmRevisionId };
      },
      restore: (data) => { ctx.project = data.project; ctx.scmRevisionId = data.scmRevisionId; },
    },
    {
      name: 'extract:metrics',
      label: 'Step 2: Extracting metrics',
      fn: async () => {
        ctx.metrics = await extractMetrics(extractor.client);
        ctx.metricKeys = getCommonMetricKeys(ctx.metrics);
        return { metrics: ctx.metrics, metricKeys: ctx.metricKeys };
      },
      restore: (data) => { ctx.metrics = data.metrics; ctx.metricKeys = data.metricKeys; },
    },
    {
      name: 'extract:components',
      label: 'Step 3: Extracting component measures',
      fn: async () => {
        ctx.components = await extractComponentMeasures(extractor.client, ctx.metricKeys);
        return ctx.components;
      },
      restore: (data) => { ctx.components = data; },
    },
    {
      name: 'extract:source_file_list',
      label: 'Step 3b: Extracting source file list',
      fn: async () => {
        ctx.sourceFilesList = await extractor.client.getSourceFiles();
        return ctx.sourceFilesList;
      },
      restore: (data) => { ctx.sourceFilesList = data; },
    },
    {
      name: 'extract:rules',
      label: 'Step 4: Extracting active rules',
      fn: async () => {
        ctx.activeRules = await extractActiveRules(extractor.client, ctx.sourceFilesList);
        return ctx.activeRules;
      },
      restore: (data) => { ctx.activeRules = data; },
    },
    {
      name: 'extract:issues',
      label: 'Step 5: Extracting issues',
      fn: async () => {
        ctx.issues = await extractIssues(extractor.client, extractor.state);
        return ctx.issues;
      },
      restore: (data) => { ctx.issues = data; },
    },
    {
      name: 'extract:hotspots',
      label: 'Step 5b: Extracting security hotspots',
      fn: async () => {
        ctx.hotspotIssues = await extractHotspotsAsIssues(extractor.client);
        return ctx.hotspotIssues;
      },
      restore: (data) => { ctx.hotspotIssues = data; },
    },
    {
      name: 'extract:measures',
      label: 'Step 6: Extracting project measures',
      fn: async () => {
        ctx.measures = await extractMeasures(extractor.client, ctx.metricKeys);
        return ctx.measures;
      },
      restore: (data) => { ctx.measures = data; },
    },
    {
      name: 'extract:sources',
      label: 'Step 7: Extracting source code',
      fn: async () => {
        ctx.sources = await extractSources(extractor.client, null, maxFiles, { concurrency: sourceConcurrency });
        return ctx.sources;
      },
      restore: (data) => { ctx.sources = data; },
    },
    {
      name: 'extract:duplications',
      label: 'Step 7b: Extracting duplications',
      fn: async () => {
        ctx.duplications = await extractDuplications(extractor.client, ctx.components, null, { concurrency: dupConcurrency });
        return ctx.duplications;
      },
      restore: (data) => { ctx.duplications = data; },
    },
    {
      name: 'extract:changesets',
      label: 'Step 8: Extracting changesets',
      fn: async () => {
        ctx.changesets = await extractChangesets(extractor.client, ctx.sourceFilesList, ctx.components);
        return ctx.changesets;
      },
      restore: (data) => { ctx.changesets = data; },
    },
    {
      name: 'extract:symbols',
      label: 'Step 9: Extracting symbols',
      fn: async () => {
        ctx.symbols = await extractSymbols(extractor.client, ctx.sourceFilesList);
        return ctx.symbols;
      },
      restore: (data) => { ctx.symbols = data; },
    },
    {
      name: 'extract:syntax_highlighting',
      label: 'Step 10: Extracting syntax highlighting',
      fn: async () => {
        ctx.syntaxHighlightings = await extractSyntaxHighlighting(extractor.client, ctx.sourceFilesList);
        return ctx.syntaxHighlightings;
      },
      restore: (data) => { ctx.syntaxHighlightings = data; },
    },
  ];

  for (const phase of phases) {
    checkShutdown(shutdownCheck);

    if (journal.isPhaseCompleted(phase.name)) {
      // Load from cache
      logger.info(`${phase.label} — cached, loading from disk`);
      const cached = await cache.load(phase.name, 'main');
      if (cached !== null) {
        phase.restore(cached);
        continue;
      }
      // Cache miss — re-extract
      logger.warn(`Cache miss for ${phase.name}, re-extracting`);
    }

    logger.info(`${phase.label}...`);
    await journal.startPhase(phase.name);
    try {
      const result = await phase.fn();
      await cache.save(phase.name, 'main', result);
      await journal.completePhase(phase.name);
    } catch (error) {
      await journal.failPhase(phase.name, error.message);
      throw error;
    }
  }

  // Merge hotspots into issues
  if (ctx.hotspotIssues.length > 0) {
    ctx.issues = ctx.issues.concat(ctx.hotspotIssues);
    logger.info(`Added ${ctx.hotspotIssues.length} hotspots to issue list (total: ${ctx.issues.length})`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`Checkpoint-aware extraction completed in ${duration}s`);

  const extractedData = {
    project: ctx.project,
    metrics: ctx.metrics,
    issues: ctx.issues,
    measures: ctx.measures,
    components: ctx.components,
    sources: ctx.sources,
    activeRules: ctx.activeRules,
    duplications: ctx.duplications,
    changesets: ctx.changesets,
    symbols: ctx.symbols,
    syntaxHighlightings: ctx.syntaxHighlightings,
    metadata: {
      extractedAt: new Date().toISOString(),
      mode: extractor.config.transfer.mode,
      ...(ctx.scmRevisionId ? { scmRevisionId: ctx.scmRevisionId } : {}),
    },
  };

  extractor.logExtractionSummary(extractedData);
  return extractedData;
}

/**
 * Extract data for a specific branch with checkpoint support.
 *
 * @param {import('./index.js').DataExtractor} extractor - DataExtractor instance
 * @param {string} branch - Branch name
 * @param {object} mainData - Data from main branch extraction
 * @param {import('../../../../shared/state/checkpoint.js').CheckpointJournal} journal
 * @param {import('../../../../shared/state/extraction-cache.js').ExtractionCache} cache
 * @param {Function} shutdownCheck - () => boolean
 * @returns {Promise<object>} Extracted data (same shape as extractAll)
 */
export async function extractBranchWithCheckpoints(extractor, branch, mainData, journal, cache, shutdownCheck) {
  logger.info(`Checkpoint-aware extraction for branch: ${branch}`);

  const startTime = Date.now();
  const metricKeys = getCommonMetricKeys(mainData.metrics);
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const sourceConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConcurrency = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  const ctx = {
    components: [],
    sourceFilesList: [],
    issues: [],
    hotspotIssues: [],
    measures: {},
    sources: [],
    duplications: new Map(),
    changesets: new Map(),
    symbols: new Map(),
    syntaxHighlightings: new Map(),
    scmRevisionId: null,
  };

  const phases = [
    {
      name: 'extract:scm_revision',
      label: `[${branch}] Fetching SCM revision`,
      fn: async () => {
        const scmRevision = await extractor.client.getLatestAnalysisRevision(branch);
        if (scmRevision) ctx.scmRevisionId = scmRevision;
        return ctx.scmRevisionId;
      },
      restore: (data) => { ctx.scmRevisionId = data; },
    },
    {
      name: 'extract:components',
      label: `[${branch}] Extracting component measures`,
      fn: async () => {
        ctx.components = await extractComponentMeasures(extractor.client, metricKeys, branch);
        return ctx.components;
      },
      restore: (data) => { ctx.components = data; },
    },
    {
      name: 'extract:source_file_list',
      label: `[${branch}] Extracting source file list`,
      fn: async () => {
        ctx.sourceFilesList = await extractor.client.getSourceFiles(branch);
        return ctx.sourceFilesList;
      },
      restore: (data) => { ctx.sourceFilesList = data; },
    },
    {
      name: 'extract:issues',
      label: `[${branch}] Extracting issues`,
      fn: async () => {
        ctx.issues = await extractIssues(extractor.client, extractor.state, branch);
        return ctx.issues;
      },
      restore: (data) => { ctx.issues = data; },
    },
    {
      name: 'extract:hotspots',
      label: `[${branch}] Extracting security hotspots`,
      fn: async () => {
        ctx.hotspotIssues = await extractHotspotsAsIssues(extractor.client, branch);
        return ctx.hotspotIssues;
      },
      restore: (data) => { ctx.hotspotIssues = data; },
    },
    {
      name: 'extract:measures',
      label: `[${branch}] Extracting project measures`,
      fn: async () => {
        ctx.measures = await extractMeasures(extractor.client, metricKeys, branch);
        return ctx.measures;
      },
      restore: (data) => { ctx.measures = data; },
    },
    {
      name: 'extract:sources',
      label: `[${branch}] Extracting source code`,
      fn: async () => {
        ctx.sources = await extractSources(extractor.client, branch, maxFiles, { concurrency: sourceConcurrency });
        return ctx.sources;
      },
      restore: (data) => { ctx.sources = data; },
    },
    {
      name: 'extract:duplications',
      label: `[${branch}] Extracting duplications`,
      fn: async () => {
        ctx.duplications = await extractDuplications(extractor.client, ctx.components, branch, { concurrency: dupConcurrency });
        return ctx.duplications;
      },
      restore: (data) => { ctx.duplications = data; },
    },
    {
      name: 'extract:changesets',
      label: `[${branch}] Extracting changesets`,
      fn: async () => {
        ctx.changesets = await extractChangesets(extractor.client, ctx.sourceFilesList, ctx.components);
        return ctx.changesets;
      },
      restore: (data) => { ctx.changesets = data; },
    },
    {
      name: 'extract:symbols',
      label: `[${branch}] Extracting symbols`,
      fn: async () => {
        ctx.symbols = await extractSymbols(extractor.client, ctx.sourceFilesList);
        return ctx.symbols;
      },
      restore: (data) => { ctx.symbols = data; },
    },
    {
      name: 'extract:syntax_highlighting',
      label: `[${branch}] Extracting syntax highlighting`,
      fn: async () => {
        ctx.syntaxHighlightings = await extractSyntaxHighlighting(extractor.client, ctx.sourceFilesList);
        return ctx.syntaxHighlightings;
      },
      restore: (data) => { ctx.syntaxHighlightings = data; },
    },
  ];

  for (const phase of phases) {
    checkShutdown(shutdownCheck);

    if (journal.isBranchPhaseCompleted(branch, phase.name)) {
      logger.info(`${phase.label} — cached, loading from disk`);
      const cached = await cache.load(phase.name, branch);
      if (cached !== null) {
        phase.restore(cached);
        continue;
      }
      logger.warn(`Cache miss for ${phase.name} on branch '${branch}', re-extracting`);
    }

    logger.info(`${phase.label}...`);
    await journal.startBranchPhase(branch, phase.name);
    try {
      const result = await phase.fn();
      await cache.save(phase.name, branch, result);
      await journal.completeBranchPhase(branch, phase.name);
    } catch (error) {
      await journal.failBranchPhase(branch, phase.name, error.message);
      throw error;
    }
  }

  // Merge hotspots into issues
  if (ctx.hotspotIssues.length > 0) {
    ctx.issues.push(...ctx.hotspotIssues);
    logger.info(`[${branch}] Added ${ctx.hotspotIssues.length} hotspots to issue list (total: ${ctx.issues.length})`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`[${branch}] Checkpoint-aware branch extraction completed in ${duration}s — ${ctx.issues.length} issues, ${ctx.components.length} components, ${ctx.sources.length} sources`);

  return {
    project: mainData.project,
    metrics: mainData.metrics,
    activeRules: mainData.activeRules,
    issues: ctx.issues,
    measures: ctx.measures,
    components: ctx.components,
    sources: ctx.sources,
    duplications: ctx.duplications,
    changesets: ctx.changesets,
    symbols: ctx.symbols,
    syntaxHighlightings: ctx.syntaxHighlightings,
    metadata: {
      extractedAt: new Date().toISOString(),
      mode: extractor.config.transfer.mode,
      ...(ctx.scmRevisionId ? { scmRevisionId: ctx.scmRevisionId } : {}),
    },
  };
}
