import { getCommonMetricKeys } from '../../metrics.js';
import { extractComponentMeasures } from '../../measures.js';
import { extractMeasures } from '../../measures.js';
import { extractBranchIssues } from './helpers/extract-branch-issues.js';
import { extractBranchSources, extractBranchDuplications } from './helpers/extract-branch-sources.js';
import { extractBranchScm } from './helpers/extract-branch-scm.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Branch Extraction --------

/** Extract data for a specific branch. */
export async function extractBranch(extractor, branch, mainData) {
  logger.info(`Extracting data for branch: ${branch}`);
  const startTime = Date.now();
  const metricKeys = getCommonMetricKeys(mainData.metrics);

  logger.info(`  [${branch}] Extracting component measures...`);
  const components = await extractComponentMeasures(extractor.client, metricKeys, branch);
  const sourceFilesList = await extractor.client.getSourceFiles(branch);
  const issues = await extractBranchIssues(extractor, branch);

  logger.info(`  [${branch}] Extracting project measures...`);
  const measures = await extractMeasures(extractor.client, metricKeys, branch);
  const sources = await extractBranchSources(extractor, branch);
  const duplications = await extractBranchDuplications(extractor, branch, components);
  const scmData = await extractBranchScm(extractor, branch, sourceFilesList, components);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`  [${branch}] Branch extraction completed in ${duration}s — ${issues.length} issues, ${components.length} components, ${sources.length} sources`);

  return {
    project: mainData.project, metrics: mainData.metrics,
    activeRules: mainData.activeRules, issues, measures, components,
    sources, duplications, ...scmData,
    metadata: { extractedAt: new Date().toISOString(), mode: extractor.config.transfer.mode },
  };
}
