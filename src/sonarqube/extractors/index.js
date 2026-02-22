import logger from '../../utils/logger.js';
import { extractProjectData } from './projects.js';
import { extractIssues } from './issues.js';
import { extractMetrics, getCommonMetricKeys } from './metrics.js';
import { extractMeasures, extractComponentMeasures } from './measures.js';
import { extractSources } from './sources.js';
import { extractActiveRules } from './rules.js';
import { extractChangesets } from './changesets.js';
import { extractSymbols } from './symbols.js';
import { extractSyntaxHighlighting } from './syntax-highlighting.js';

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

      // 6. Extract project measures
      logger.info('Step 6/7: Extracting project measures...');
      extractedData.measures = await extractMeasures(this.client, metricKeys);

      // 7. Extract source code (optional, can be limited)
      logger.info('Step 7/7: Extracting source code...');
      const maxFiles = Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10);
      extractedData.sources = await extractSources(this.client, null, maxFiles, {
        concurrency: this.performanceConfig.sourceExtraction?.concurrency || 10
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

    logger.info(`  [${branch}] Extracting project measures...`);
    const measures = await extractMeasures(this.client, metricKeys, branch);

    logger.info(`  [${branch}] Extracting source code...`);
    const maxFiles = Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10);
    const sources = await extractSources(this.client, branch, maxFiles, {
      concurrency: this.performanceConfig.sourceExtraction?.concurrency || 10
    });

    logger.info(`  [${branch}] Extracting changesets...`);
    const changesets = await extractChangesets(this.client, sourceFilesList, components);

    logger.info(`  [${branch}] Extracting symbols...`);
    const symbols = await extractSymbols(this.client, sourceFilesList);

    logger.info(`  [${branch}] Extracting syntax highlighting...`);
    const syntaxHighlightings = await extractSyntaxHighlighting(this.client, sourceFilesList);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`  [${branch}] Branch extraction completed in ${duration}s — ${issues.length} issues, ${components.length} components, ${sources.length} sources`);

    // Return the same shape as extractAll() so ProtobufBuilder works unchanged
    return {
      project: mainData.project,
      metrics: mainData.metrics,
      activeRules: mainData.activeRules,
      issues,
      measures,
      components,
      sources,
      changesets,
      symbols,
      syntaxHighlightings,
      metadata: {
        extractedAt: new Date().toISOString(),
        mode: this.config.transfer.mode
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
    logger.info(`Issues: ${data.issues.length}`);
    logger.info(`Project Measures: ${data.measures.measures.length}`);
    logger.info(`Components: ${data.components.length}`);
    logger.info(`Source Files: ${data.sources.length}`);
    logger.info('=========================');
  }
}
