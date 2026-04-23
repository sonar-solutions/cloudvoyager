import { randomBytes } from 'node:crypto';
import { computeBatchPlan, computeBatchDate, createBatchExtractedData } from '../../../../shared/utils/batch-distributor.js';
import { buildAndEncodeReport } from './build-and-encode-report.js';
import { uploadReport } from './upload-report.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Batched Branch Transfer --------

/** Split issues into batches and upload each as a separate scanner report. */
export async function transferBranchBatched(opts) {
  const { extractedData, sonarcloudConfig, sonarCloudProfiles, branchName,
    referenceBranchName, sonarCloudClient, label, isMainBranch,
    sonarCloudRepos, ruleEnrichmentMap, wait = true } = opts;

  extractedData.issues.sort((a, b) => (a.component || '').localeCompare(b.component || ''));

  const plan = computeBatchPlan(extractedData.issues.length);
  const baseDate = extractedData.metadata.extractedAt;

  logger.info(`[${label}] Splitting ${extractedData.issues.length} issues into ${plan.length} batches of up to 5,000`);

  let lastCeTask;
  for (const batch of plan) {
    const batchDate = computeBatchDate(baseDate, batch.batchIndex, plan.length);
    const batchData = createBatchExtractedData(extractedData, batch, batchDate, randomBytes(20).toString('hex'));
    const batchLabel = `${label} batch ${batch.batchIndex + 1}/${plan.length}`;

    logger.info(`[${batchLabel}] Issues ${batch.startIndex + 1}-${batch.endIndex} | date=${batchDate}`);

    const encodedReport = await buildAndEncodeReport({
      extractedData: batchData, sonarcloudConfig, sonarCloudProfiles,
      branchName, referenceBranchName, label: batchLabel, sonarCloudRepos, ruleEnrichmentMap,
    });
    lastCeTask = await uploadReport({
      encodedReport, sonarcloudConfig, sonarCloudClient, branchName, isMainBranch, wait, label: batchLabel,
    });
    logger.info(`[${batchLabel}] CE task completed: ${lastCeTask.id}`);
  }

  return lastCeTask;
}
