import logger from '../../../../../shared/utils/logger.js';
import { extractProjectData } from '../projects.js';
import { extractIssues } from '../issues.js';
import { extractMetrics, getCommonMetricKeys } from '../metrics.js';
import { extractMeasures, extractComponentMeasures } from '../measures.js';
import { extractSources } from '../sources.js';
import { extractActiveRules } from '../rules.js';
import { extractChangesets } from '../changesets.js';
import { extractSymbols } from '../symbols.js';
import { extractSyntaxHighlighting } from '../syntax-highlighting.js';
import { extractHotspotsAsIssues } from '../hotspots-to-issues.js';
import { extractDuplications } from '../duplications.js';
import { createEmptyExtractedData, parseMaxSourceFiles } from './extraction-utils.js';
export { createEmptyExtractedData, parseMaxSourceFiles } from './extraction-utils.js';

// -------- Extract All Data --------

export async function extractAll(extractor) {
  logger.info('Starting full data extraction from SonarQube...');
  const startTime = Date.now();
  const data = createEmptyExtractedData(extractor.config.transfer.mode);
  data.project = await extractProjectData(extractor.client);
  const scmRevision = await extractor.client.getLatestAnalysisRevision();
  if (scmRevision) data.metadata.scmRevisionId = scmRevision;
  data.metrics = await extractMetrics(extractor.client);
  const metricKeys = getCommonMetricKeys(data.metrics);
  data.components = await extractComponentMeasures(extractor.client, metricKeys);
  const sourceFilesList = await extractor.client.getSourceFiles();
  data.activeRules = await extractActiveRules(extractor.client, sourceFilesList);
  data.issues = await extractIssues(extractor.client, extractor.state);
  const hotspotIssues = await extractHotspotsAsIssues(extractor.client);
  if (hotspotIssues.length > 0) data.issues.push(...hotspotIssues);
  data.measures = await extractMeasures(extractor.client, metricKeys);
  const maxFiles = parseMaxSourceFiles();
  const conc = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  data.sources = await extractSources(extractor.client, null, maxFiles, { concurrency: conc });
  const dupConc = extractor.performanceConfig.sourceExtraction?.concurrency || 5;
  data.duplications = await extractDuplications(extractor.client, data.components, null, { concurrency: dupConc });
  data.changesets = await extractChangesets(extractor.client, sourceFilesList, data.components);
  data.symbols = await extractSymbols(extractor.client, sourceFilesList);
  data.syntaxHighlightings = await extractSyntaxHighlighting(extractor.client, sourceFilesList);
  logger.info(`Data extraction completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
  return data;
}
