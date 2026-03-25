// -------- Version Router --------

import { parseSonarQubeVersion } from '../shared/utils/version.js';
import logger from '../shared/utils/logger.js';
import { resolvePipelineId } from './helpers/resolve-pipeline-id.js';
import { fetchServerVersion } from './helpers/fetch-server-version.js';

export { resolvePipelineId } from './helpers/resolve-pipeline-id.js';

export async function detectAndRoute(sonarqubeConfig) {
  const versionStr = await fetchServerVersion(sonarqubeConfig);
  const parsed = parseSonarQubeVersion(versionStr);
  const pipelineId = resolvePipelineId(parsed);

  logger.info(`SonarQube server version: ${parsed.raw} → using pipeline: ${pipelineId}`);

  const [transferMod, migrateMod] = await Promise.all([
    import(`../pipelines/${pipelineId}/transfer-pipeline.js`),
    import(`../pipelines/${pipelineId}/migrate-pipeline.js`),
  ]);

  return {
    pipelineId,
    parsedVersion: parsed,
    transferProject: transferMod.transferProject,
    migrateAll: migrateMod.migrateAll,
  };
}
