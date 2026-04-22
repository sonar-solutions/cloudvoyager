import logger from '../../../../../shared/utils/logger.js';
import { extractIssues } from '../issues.js';
import { getCommonMetricKeys } from '../metrics.js';
import { extractMeasures, extractComponentMeasures } from '../measures.js';
import { extractSources } from '../sources.js';
import { extractChangesets } from '../changesets.js';
import { extractSymbols } from '../symbols.js';
import { extractSyntaxHighlighting } from '../syntax-highlighting.js';
import { extractHotspotsAsIssues } from '../hotspots-to-issues.js';
import { extractDuplications } from '../duplications.js';
import { parseMaxSourceFiles } from './extraction-utils.js';

// -------- Extract Branch Data --------

export async function extractBranch(extractor, branch, mainData) {
  logger.info(`Extracting data for branch: ${branch}`);
  const startTime = Date.now();
  const metricKeys = getCommonMetricKeys(mainData.metrics);
  const components = await extractComponentMeasures(extractor.client, metricKeys, branch);
  const sourceFilesList = await extractor.client.getSourceFiles(branch);
  const issues = await extractIssues(extractor.client, extractor.state, branch);
  const hotspotIssues = await extractHotspotsAsIssues(extractor.client, branch);
  if (hotspotIssues.length > 0) {
    issues.push(...hotspotIssues);
    logger.info(`  [${branch}] Added ${hotspotIssues.length} hotspots (total: ${issues.length})`);
  }
  const measures = await extractMeasures(extractor.client, metricKeys, branch);
  const maxFiles = parseMaxSourceFiles();
  const srcConc = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const sources = await extractSources(extractor.client, branch, maxFiles, { concurrency: srcConc });
  const dupConc = extractor.performanceConfig.sourceExtraction?.concurrency || 5;
  const duplications = await extractDuplications(extractor.client, components, branch, { concurrency: dupConc });
  const changesets = await extractChangesets(extractor.client, sourceFilesList, components, issues);
  const symbols = await extractSymbols(extractor.client, sourceFilesList);
  const syntaxHighlightings = await extractSyntaxHighlighting(extractor.client, sourceFilesList);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`  [${branch}] Branch extraction completed in ${duration}s`);
  return {
    project: mainData.project, metrics: mainData.metrics,
    activeRules: mainData.activeRules, issues, measures, components,
    sources, duplications, changesets, symbols, syntaxHighlightings,
    metadata: { extractedAt: new Date().toISOString(), mode: extractor.config.transfer.mode },
  };
}
