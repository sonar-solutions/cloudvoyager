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
 * Main extractor orchestrator
 * Coordinates extraction of all data from SonarQube
 */
export class DataExtractor {
  constructor(client, config, state = null, performanceConfig = {}) {
    this.client = client;
    this.config = config;
    this.state = state;
    this.performanceConfig = performanceConfig;
  }

  /**
   * Extract all data from SonarQube
   * @returns {Promise<object>} Extracted data
   */
  async extractAll() {
    logger.info('Starting full data extraction from SonarQube...');

    const startTime = Date.now();
    const extractedData = {
      project: null,
      metrics: [],
      issues: [],
      measures: {},
      components: [],
      sources: [],
      activeRules: [],
      duplications: new Map(),
      changesets: new Map(),
      symbols: new Map(),
      syntaxHighlightings: new Map(),
      metadata: {
        extractedAt: new Date().toISOString(),
        mode: this.config.transfer.mode
      }
    };

    try {
      // 1. Extract project data
      logger.info('Step 1/7: Extracting project data...');
      extractedData.project = await extractProjectData(this.client);

      // Get SCM revision from latest analysis
      const scmRevision = await this.client.getLatestAnalysisRevision();
      if (scmRevision) {
        extractedData.metadata.scmRevisionId = scmRevision;
      }

      // 2. Extract metrics definitions
      logger.info('Step 2/7: Extracting metrics...');
      extractedData.metrics = await extractMetrics(this.client);
      const metricKeys = getCommonMetricKeys(extractedData.metrics);

      // 3. Extract component tree with measures (needed for determining languages)
      logger.info('Step 3/7: Extracting component measures...');
      extractedData.components = await extractComponentMeasures(this.client, metricKeys);

      // 3b. Extract source files to determine languages used
      logger.info('Step 3b/7: Extracting source file list for language detection...');
      const sourceFilesList = await this.client.getSourceFiles();

      // 4. Extract active rules from quality profiles (filtered by languages in source files)
      logger.info('Step 4/7: Extracting active rules...');
      extractedData.activeRules = await extractActiveRules(this.client, sourceFilesList);

      // 5. Extract issues (with incremental support)
      logger.info('Step 5/7: Extracting issues...');
      extractedData.issues = await extractIssues(this.client, this.state);

      // 5b. Extract security hotspots and include them as issues in the report.
      // SonarQube's /api/issues/search does not return hotspots — they have a
      // separate API.  By converting them to issue format, the protobuf builder
      // will include them in the scanner report so SonarCloud's CE creates the
      // corresponding hotspot entities (enabling the later hotspot metadata sync).
      logger.info('Step 5b: Extracting security hotspots for scanner report...');
      const hotspotIssues = await extractHotspotsAsIssues(this.client);
      if (hotspotIssues.length > 0) {
        extractedData.issues.push(...hotspotIssues);
        logger.info(`Added ${hotspotIssues.length} hotspots to issue list (total: ${extractedData.issues.length})`);
      }

      // 6. Extract project measures
      logger.info('Step 6/7: Extracting project measures...');
      extractedData.measures = await extractMeasures(this.client, metricKeys);

      // 7. Extract source code (optional, can be limited)
      logger.info('Step 7/7: Extracting source code...');
      const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
      extractedData.sources = await extractSources(this.client, null, maxFiles, {
        concurrency: this.performanceConfig.sourceExtraction?.concurrency || 10
      });

      // 7b. Extract duplications
      logger.info('Step 7b: Extracting duplications...');
      extractedData.duplications = await extractDuplications(this.client, extractedData.components, null, {
        concurrency: this.performanceConfig.sourceExtraction?.concurrency || 5
      });

      // 8. Extract changesets (SCM blame data)
      logger.info('Step 8/10: Extracting changesets...');
      extractedData.changesets = await extractChangesets(this.client, sourceFilesList, extractedData.components);

      // 9. Extract symbols (symbol tables)
      logger.info('Step 9/10: Extracting symbols...');
      extractedData.symbols = await extractSymbols(this.client, sourceFilesList);

      // 10. Extract syntax highlighting
      logger.info('Step 10/10: Extracting syntax highlighting...');
      extractedData.syntaxHighlightings = await extractSyntaxHighlighting(this.client, sourceFilesList);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`Data extraction completed in ${duration}s`);

      // Log summary
      this.logExtractionSummary(extractedData);

      return extractedData;

    } catch (error) {
      logger.error(`Data extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract data for a specific branch.
   *
   * Returns the same shape as extractAll() so the result can be fed directly
   * into ProtobufBuilder.  Project-level data that does not vary across
   * branches (project metadata, active rules, metric definitions) is taken
   * from the previously-extracted main-branch data passed via `mainData`.
   *
   * @param {string} branch - Branch name
   * @param {object} mainData - Data previously returned by extractAll() (used
   *   for project metadata, active rules, and metric definitions)
   * @returns {Promise<object>} Extracted data (same shape as extractAll output)
   */
  async extractBranch(branch, mainData) {
    logger.info(`Extracting data for branch: ${branch}`);

    const startTime = Date.now();

    // Reuse metric definitions from the main extraction
    const metricKeys = getCommonMetricKeys(mainData.metrics);

    // Extract branch-specific data
    logger.info(`  [${branch}] Extracting component measures...`);
    const components = await extractComponentMeasures(this.client, metricKeys, branch);

    logger.info(`  [${branch}] Extracting source file list...`);
    const sourceFilesList = await this.client.getSourceFiles(branch);

    logger.info(`  [${branch}] Extracting issues...`);
    const issues = await extractIssues(this.client, this.state, branch);

    // Include security hotspots as issues in the branch report
    logger.info(`  [${branch}] Extracting security hotspots for scanner report...`);
    const hotspotIssues = await extractHotspotsAsIssues(this.client, branch);
    if (hotspotIssues.length > 0) {
      issues.push(...hotspotIssues);
      logger.info(`  [${branch}] Added ${hotspotIssues.length} hotspots to issue list (total: ${issues.length})`);
    }

    logger.info(`  [${branch}] Extracting project measures...`);
    const measures = await extractMeasures(this.client, metricKeys, branch);

    logger.info(`  [${branch}] Extracting source code...`);
    const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
    const sources = await extractSources(this.client, branch, maxFiles, {
      concurrency: this.performanceConfig.sourceExtraction?.concurrency || 10
    });

    logger.info(`  [${branch}] Extracting duplications...`);
    const duplications = await extractDuplications(this.client, components, branch, {
      concurrency: this.performanceConfig.sourceExtraction?.concurrency || 5
    });

    logger.info(`  [${branch}] Extracting changesets...`);
    const changesets = await extractChangesets(this.client, sourceFilesList, components);

    logger.info(`  [${branch}] Extracting symbols...`);
    const symbols = await extractSymbols(this.client, sourceFilesList);

    logger.info(`  [${branch}] Extracting syntax highlighting...`);
    const syntaxHighlightings = await extractSyntaxHighlighting(this.client, sourceFilesList);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`  [${branch}] Branch extraction completed in ${duration}s — ${issues.length} issues, ${components.length} components, ${sources.length} sources`);

    // Get SCM revision for this branch (needed for duplicate report detection)
    const scmRevision = await this.client.getLatestAnalysisRevision(branch);

    // Return the same shape as extractAll() so ProtobufBuilder works unchanged
    return {
      project: mainData.project,
      metrics: mainData.metrics,
      activeRules: mainData.activeRules,
      issues,
      measures,
      components,
      sources,
      duplications,
      changesets,
      symbols,
      syntaxHighlightings,
      metadata: {
        extractedAt: new Date().toISOString(),
        mode: this.config.transfer.mode,
        ...(scmRevision ? { scmRevisionId: scmRevision } : {}),
      }
    };
  }

  /**
   * Log extraction summary
   * @param {object} data - Extracted data
   */
  logExtractionSummary(data) {
    logger.info('=== Extraction Summary ===');
    logger.info(`Project: ${data.project.project.name}`);
    logger.info(`Branches: ${data.project.branches.length}`);
    logger.info(`Metrics: ${data.metrics.length}`);
    logger.info(`Active Rules: ${data.activeRules.length}`);
    const hotspotCount = data.issues.filter(i => i.type === 'SECURITY_HOTSPOT').length;
    logger.info(`Issues: ${data.issues.length - hotspotCount} (+ ${hotspotCount} security hotspots)`);
    logger.info(`Project Measures: ${data.measures.measures.length}`);
    logger.info(`Components: ${data.components.length}`);
    logger.info(`Source Files: ${data.sources.length}`);
    logger.info('=========================');
  }

  /**
   * Extract all data with checkpoint support for pause/resume.
   *
   * Each extraction step is guarded by the journal: completed phases are loaded
   * from cache, in-progress phases are re-executed, and shutdown checks run
   * between phases for graceful interruption.
   *
   * @param {import('../../state/checkpoint.js').CheckpointJournal} journal
   * @param {import('../../state/extraction-cache.js').ExtractionCache} cache
   * @param {Function} shutdownCheck - () => boolean
   * @returns {Promise<object>} Extracted data (same shape as extractAll)
   */
  async extractAllWithCheckpoints(journal, cache, shutdownCheck) {
    logger.info('Starting checkpoint-aware data extraction from SonarQube...');

    const startTime = Date.now();
    const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
    const sourceConcurrency = this.performanceConfig.sourceExtraction?.concurrency || 10;
    const dupConcurrency = this.performanceConfig.sourceExtraction?.concurrency || 5;

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
          ctx.project = await extractProjectData(this.client);
          const scmRevision = await this.client.getLatestAnalysisRevision();
          if (scmRevision) ctx.scmRevisionId = scmRevision;
          return { project: ctx.project, scmRevisionId: ctx.scmRevisionId };
        },
        restore: (data) => { ctx.project = data.project; ctx.scmRevisionId = data.scmRevisionId; },
      },
      {
        name: 'extract:metrics',
        label: 'Step 2: Extracting metrics',
        fn: async () => {
          ctx.metrics = await extractMetrics(this.client);
          ctx.metricKeys = getCommonMetricKeys(ctx.metrics);
          return { metrics: ctx.metrics, metricKeys: ctx.metricKeys };
        },
        restore: (data) => { ctx.metrics = data.metrics; ctx.metricKeys = data.metricKeys; },
      },
      {
        name: 'extract:components',
        label: 'Step 3: Extracting component measures',
        fn: async () => {
          ctx.components = await extractComponentMeasures(this.client, ctx.metricKeys);
          return ctx.components;
        },
        restore: (data) => { ctx.components = data; },
      },
      {
        name: 'extract:source_file_list',
        label: 'Step 3b: Extracting source file list',
        fn: async () => {
          ctx.sourceFilesList = await this.client.getSourceFiles();
          return ctx.sourceFilesList;
        },
        restore: (data) => { ctx.sourceFilesList = data; },
      },
      {
        name: 'extract:rules',
        label: 'Step 4: Extracting active rules',
        fn: async () => {
          ctx.activeRules = await extractActiveRules(this.client, ctx.sourceFilesList);
          return ctx.activeRules;
        },
        restore: (data) => { ctx.activeRules = data; },
      },
      {
        name: 'extract:issues',
        label: 'Step 5: Extracting issues',
        fn: async () => {
          ctx.issues = await extractIssues(this.client, this.state);
          return ctx.issues;
        },
        restore: (data) => { ctx.issues = data; },
      },
      {
        name: 'extract:hotspots',
        label: 'Step 5b: Extracting security hotspots',
        fn: async () => {
          ctx.hotspotIssues = await extractHotspotsAsIssues(this.client);
          return ctx.hotspotIssues;
        },
        restore: (data) => { ctx.hotspotIssues = data; },
      },
      {
        name: 'extract:measures',
        label: 'Step 6: Extracting project measures',
        fn: async () => {
          ctx.measures = await extractMeasures(this.client, ctx.metricKeys);
          return ctx.measures;
        },
        restore: (data) => { ctx.measures = data; },
      },
      {
        name: 'extract:sources',
        label: 'Step 7: Extracting source code',
        fn: async () => {
          ctx.sources = await extractSources(this.client, null, maxFiles, { concurrency: sourceConcurrency });
          return ctx.sources;
        },
        restore: (data) => { ctx.sources = data; },
      },
      {
        name: 'extract:duplications',
        label: 'Step 7b: Extracting duplications',
        fn: async () => {
          ctx.duplications = await extractDuplications(this.client, ctx.components, null, { concurrency: dupConcurrency });
          return ctx.duplications;
        },
        restore: (data) => { ctx.duplications = data; },
      },
      {
        name: 'extract:changesets',
        label: 'Step 8: Extracting changesets',
        fn: async () => {
          ctx.changesets = await extractChangesets(this.client, ctx.sourceFilesList, ctx.components);
          return ctx.changesets;
        },
        restore: (data) => { ctx.changesets = data; },
      },
      {
        name: 'extract:symbols',
        label: 'Step 9: Extracting symbols',
        fn: async () => {
          ctx.symbols = await extractSymbols(this.client, ctx.sourceFilesList);
          return ctx.symbols;
        },
        restore: (data) => { ctx.symbols = data; },
      },
      {
        name: 'extract:syntax_highlighting',
        label: 'Step 10: Extracting syntax highlighting',
        fn: async () => {
          ctx.syntaxHighlightings = await extractSyntaxHighlighting(this.client, ctx.sourceFilesList);
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
        mode: this.config.transfer.mode,
        ...(ctx.scmRevisionId ? { scmRevisionId: ctx.scmRevisionId } : {}),
      },
    };

    this.logExtractionSummary(extractedData);
    return extractedData;
  }

  /**
   * Extract data for a specific branch with checkpoint support.
   *
   * @param {string} branch - Branch name
   * @param {object} mainData - Data from main branch extraction
   * @param {import('../../state/checkpoint.js').CheckpointJournal} journal
   * @param {import('../../state/extraction-cache.js').ExtractionCache} cache
   * @param {Function} shutdownCheck - () => boolean
   * @returns {Promise<object>} Extracted data (same shape as extractAll)
   */
  async extractBranchWithCheckpoints(branch, mainData, journal, cache, shutdownCheck) {
    logger.info(`Checkpoint-aware extraction for branch: ${branch}`);

    const startTime = Date.now();
    const metricKeys = getCommonMetricKeys(mainData.metrics);
    const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
    const sourceConcurrency = this.performanceConfig.sourceExtraction?.concurrency || 10;
    const dupConcurrency = this.performanceConfig.sourceExtraction?.concurrency || 5;

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
          const scmRevision = await this.client.getLatestAnalysisRevision(branch);
          if (scmRevision) ctx.scmRevisionId = scmRevision;
          return ctx.scmRevisionId;
        },
        restore: (data) => { ctx.scmRevisionId = data; },
      },
      {
        name: 'extract:components',
        label: `[${branch}] Extracting component measures`,
        fn: async () => {
          ctx.components = await extractComponentMeasures(this.client, metricKeys, branch);
          return ctx.components;
        },
        restore: (data) => { ctx.components = data; },
      },
      {
        name: 'extract:source_file_list',
        label: `[${branch}] Extracting source file list`,
        fn: async () => {
          ctx.sourceFilesList = await this.client.getSourceFiles(branch);
          return ctx.sourceFilesList;
        },
        restore: (data) => { ctx.sourceFilesList = data; },
      },
      {
        name: 'extract:issues',
        label: `[${branch}] Extracting issues`,
        fn: async () => {
          ctx.issues = await extractIssues(this.client, this.state, branch);
          return ctx.issues;
        },
        restore: (data) => { ctx.issues = data; },
      },
      {
        name: 'extract:hotspots',
        label: `[${branch}] Extracting security hotspots`,
        fn: async () => {
          ctx.hotspotIssues = await extractHotspotsAsIssues(this.client, branch);
          return ctx.hotspotIssues;
        },
        restore: (data) => { ctx.hotspotIssues = data; },
      },
      {
        name: 'extract:measures',
        label: `[${branch}] Extracting project measures`,
        fn: async () => {
          ctx.measures = await extractMeasures(this.client, metricKeys, branch);
          return ctx.measures;
        },
        restore: (data) => { ctx.measures = data; },
      },
      {
        name: 'extract:sources',
        label: `[${branch}] Extracting source code`,
        fn: async () => {
          ctx.sources = await extractSources(this.client, branch, maxFiles, { concurrency: sourceConcurrency });
          return ctx.sources;
        },
        restore: (data) => { ctx.sources = data; },
      },
      {
        name: 'extract:duplications',
        label: `[${branch}] Extracting duplications`,
        fn: async () => {
          ctx.duplications = await extractDuplications(this.client, ctx.components, branch, { concurrency: dupConcurrency });
          return ctx.duplications;
        },
        restore: (data) => { ctx.duplications = data; },
      },
      {
        name: 'extract:changesets',
        label: `[${branch}] Extracting changesets`,
        fn: async () => {
          ctx.changesets = await extractChangesets(this.client, ctx.sourceFilesList, ctx.components);
          return ctx.changesets;
        },
        restore: (data) => { ctx.changesets = data; },
      },
      {
        name: 'extract:symbols',
        label: `[${branch}] Extracting symbols`,
        fn: async () => {
          ctx.symbols = await extractSymbols(this.client, ctx.sourceFilesList);
          return ctx.symbols;
        },
        restore: (data) => { ctx.symbols = data; },
      },
      {
        name: 'extract:syntax_highlighting',
        label: `[${branch}] Extracting syntax highlighting`,
        fn: async () => {
          ctx.syntaxHighlightings = await extractSyntaxHighlighting(this.client, ctx.sourceFilesList);
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
        mode: this.config.transfer.mode,
        ...(ctx.scmRevisionId ? { scmRevisionId: ctx.scmRevisionId } : {}),
      },
    };
  }
}
