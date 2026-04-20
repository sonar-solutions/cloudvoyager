import { randomBytes } from 'node:crypto';
import { computeBatchPlan, computeBatchDate, createBatchExtractedData } from '../../../../shared/utils/batch-distributor.js';
import { ProtobufBuilder } from '../../protobuf/builder.js';
import { ProtobufEncoder } from '../../protobuf/encoder.js';
import { ReportUploader } from '../../sonarcloud/uploader.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Batched Branch Transfer --------

/** Split issues into batches and upload each as a separate scanner report. */
export async function transferBranchBatched(opts) {
  const { extractedData, sonarcloudConfig, sonarCloudProfiles, branchName,
    referenceBranchName, sonarCloudClient, label, isMainBranch,
    sonarCloudRepos, ruleEnrichmentMap } = opts;

  const plan = computeBatchPlan(extractedData.issues.length);
  const baseDate = extractedData.metadata.extractedAt;

  logger.info(`[${label}] Splitting ${extractedData.issues.length} issues into ${plan.length} batches of up to 5,000`);

  let lastCeTask;
  for (const batch of plan) {
    const batchDate = computeBatchDate(baseDate, batch.batchIndex, plan.length);
    const batchData = createBatchExtractedData(extractedData, batch, batchDate, randomBytes(20).toString('hex'));
    const batchLabel = `${label} batch ${batch.batchIndex + 1}/${plan.length}`;

    logger.info(`[${batchLabel}] Issues ${batch.startIndex + 1}-${batch.endIndex} | date=${batchDate}`);

    const builder = new ProtobufBuilder(batchData, sonarcloudConfig, sonarCloudProfiles, {
      sonarCloudBranchName: branchName, referenceBranchName, sonarCloudRepos, ruleEnrichmentMap,
    });
    const messages = builder.buildAll();
    const encoder = new ProtobufEncoder();
    await encoder.loadSchemas();
    const encodedReport = encoder.encodeAll(messages);
    const uploader = new ReportUploader(sonarCloudClient);
    const metadata = {
      projectKey: sonarcloudConfig.projectKey, organization: sonarcloudConfig.organization,
      version: '1.0.0', ...(!isMainBranch && branchName ? { branchName } : {}),
    };

    lastCeTask = await uploader.uploadAndWait(encodedReport, metadata);
    logger.info(`[${batchLabel}] CE task completed: ${lastCeTask.id}`);
  }

  return lastCeTask;
}
