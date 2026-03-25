import { extractProjectData } from '../../../projects.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Extract Project Metadata --------

/** Step 1: Extract project data and SCM revision. */
export async function extractProjectMetadata(ext, data) {
  logger.info('Step 1/7: Extracting project data...');
  data.project = await extractProjectData(ext.client);
  const scmRevision = await ext.client.getLatestAnalysisRevision();
  if (scmRevision) data.metadata.scmRevisionId = scmRevision;
}
