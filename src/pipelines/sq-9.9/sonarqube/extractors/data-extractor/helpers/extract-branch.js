import logger from '../../../../../../shared/utils/logger.js';
import { getCommonMetricKeys } from '../../metrics.js';
import { extractBranchData } from './extract-branch-data.js';

// -------- Branch Extraction --------

export async function extractBranch(extractor, branch, mainData) {
  logger.info(`Extracting data for branch: ${branch}`);
  const startTime = Date.now();
  const metricKeys = getCommonMetricKeys(mainData.metrics);
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);

  const branchData = await extractBranchData(extractor, branch, metricKeys, maxFiles);
  const scmRevision = await extractor.client.getLatestAnalysisRevision(branch);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`  [${branch}] Branch extraction completed in ${duration}s`);

  return {
    project: mainData.project, metrics: mainData.metrics,
    activeRules: mainData.activeRules,
    issues: branchData.issues, measures: branchData.measures,
    components: branchData.components, sources: branchData.sources,
    duplications: branchData.duplications, changesets: branchData.changesets,
    symbols: branchData.symbols, syntaxHighlightings: branchData.syntaxHighlightings,
    metadata: {
      extractedAt: new Date().toISOString(),
      mode: extractor.config.transfer.mode,
      ...(scmRevision ? { scmRevisionId: scmRevision } : {}),
    },
  };
}
