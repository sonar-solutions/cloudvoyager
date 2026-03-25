import logger from '../../../../../../shared/utils/logger.js';
import { extractProjectData } from '../../projects.js';
import { extractIssues } from '../../issues.js';
import { extractMetrics, getCommonMetricKeys } from '../../metrics.js';
import { extractMeasures, extractComponentMeasures } from '../../measures.js';
import { extractSources } from '../../sources.js';
import { extractActiveRules } from '../../rules.js';
import { extractChangesets } from '../../changesets.js';
import { extractSymbols } from '../../symbols.js';
import { extractSyntaxHighlighting } from '../../syntax-highlighting.js';
import { extractHotspotsAsIssues } from '../../hotspots-to-issues.js';
import { extractDuplications } from '../../duplications.js';

// -------- Run All Extraction Steps --------

export async function runAllExtractionSteps(extractor, data) {
  const { client, state, performanceConfig } = extractor;
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);

  data.project = await extractProjectData(client);
  const scmRevision = await client.getLatestAnalysisRevision();
  if (scmRevision) data.metadata.scmRevisionId = scmRevision;

  data.metrics = await extractMetrics(client);
  const metricKeys = getCommonMetricKeys(data.metrics);

  data.components = await extractComponentMeasures(client, metricKeys);
  const sourceFilesList = await client.getSourceFiles();
  data.activeRules = await extractActiveRules(client, sourceFilesList);
  data.issues = await extractIssues(client, state);

  const hotspotIssues = await extractHotspotsAsIssues(client);
  if (hotspotIssues.length > 0) {
    data.issues.push(...hotspotIssues);
    logger.info(`Added ${hotspotIssues.length} hotspots (total: ${data.issues.length})`);
  }

  data.measures = await extractMeasures(client, metricKeys);
  data.sources = await extractSources(client, null, maxFiles, {
    concurrency: performanceConfig.sourceExtraction?.concurrency || 10,
  });
  data.duplications = await extractDuplications(client, data.components, null, {
    concurrency: performanceConfig.sourceExtraction?.concurrency || 5,
  });
  data.changesets = await extractChangesets(client, sourceFilesList, data.components);
  data.symbols = await extractSymbols(client, sourceFilesList);
  data.syntaxHighlightings = await extractSyntaxHighlighting(client, sourceFilesList);
}
