import logger from '../../../../../../shared/utils/logger.js';
import { extractIssues } from '../../issues.js';
import { extractMeasures, extractComponentMeasures } from '../../measures.js';
import { extractSources } from '../../sources.js';
import { extractChangesets } from '../../changesets.js';
import { extractSymbols } from '../../symbols.js';
import { extractSyntaxHighlighting } from '../../syntax-highlighting.js';
import { extractHotspotsAsIssues } from '../../hotspots-to-issues.js';
import { extractDuplications } from '../../duplications.js';

// -------- Branch Data Extraction Steps --------

export async function extractBranchData(extractor, branch, metricKeys, maxFiles) {
  const { client, state, performanceConfig } = extractor;

  const components = await extractComponentMeasures(client, metricKeys, branch);
  const sourceFilesList = await client.getSourceFiles(branch);
  const issues = await extractIssues(client, state, branch);

  const hotspotIssues = await extractHotspotsAsIssues(client, branch);
  if (hotspotIssues.length > 0) {
    issues.push(...hotspotIssues);
    logger.info(`  [${branch}] Added ${hotspotIssues.length} hotspots (total: ${issues.length})`);
  }

  const measures = await extractMeasures(client, metricKeys, branch);
  const sources = await extractSources(client, branch, maxFiles, {
    concurrency: performanceConfig.sourceExtraction?.concurrency || 10,
  });
  const duplications = await extractDuplications(client, components, branch, {
    concurrency: performanceConfig.sourceExtraction?.concurrency || 5,
  });
  const changesets = await extractChangesets(client, sourceFilesList, components);
  const symbols = await extractSymbols(client, sourceFilesList);
  const syntaxHighlightings = await extractSyntaxHighlighting(client, sourceFilesList);

  return { components, issues, measures, sources, duplications, changesets, symbols, syntaxHighlightings };
}
