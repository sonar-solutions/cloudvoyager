/**
 * Version Router — detects the SonarQube server version and dynamically
 * loads the correct version-specific pipeline.
 *
 * Supported pipelines:
 *   sq-9.9   — SonarQube 9.9 LTS (legacy statuses, no Clean Code, enrichment from SC)
 *   sq-10.0  — SonarQube 10.0–10.3 (legacy statuses, native Clean Code)
 *   sq-10.4  — SonarQube 10.4–10.8 (modern issueStatuses, native Clean Code)
 *   sq-2025  — SonarQube 2025.1+ (modern issueStatuses, Web API V2)
 */

import axios from 'axios';
import { parseSonarQubeVersion } from './shared/utils/version.js';
import logger from './shared/utils/logger.js';

/**
 * Resolve the pipeline identifier for a given parsed SQ version.
 * @param {{ major: number, minor: number }} v - Parsed version
 * @returns {string} Pipeline folder name (e.g., 'sq-9.9')
 */
export function resolvePipelineId(v) {
  if (v.major === 0 && v.minor === 0) {
    logger.warn('Could not determine SonarQube version. Falling back to sq-9.9 pipeline. This may produce incorrect results if the server is running a newer version.');
    return 'sq-9.9';
  }
  if (v.major >= 2025) return 'sq-2025';
  if ((v.major === 10 && v.minor >= 4) || (v.major > 10 && v.major < 2025)) return 'sq-10.4';
  if (v.major >= 10) return 'sq-10.0';
  return 'sq-9.9';
}

/**
 * Detect the SonarQube server version via a lightweight API call,
 * then dynamically import the matching pipeline modules.
 *
 * @param {object} sonarqubeConfig - { url, token }
 * @returns {Promise<{ pipelineId: string, parsedVersion: object, transferProject: Function, migrateAll: Function }>}
 */
export async function detectAndRoute(sonarqubeConfig) {
  const versionStr = await fetchServerVersion(sonarqubeConfig);
  const parsed = parseSonarQubeVersion(versionStr);
  const pipelineId = resolvePipelineId(parsed);

  logger.info(`SonarQube server version: ${parsed.raw} → using pipeline: ${pipelineId}`);

  // Dynamic import of the version-specific pipeline
  const [transferMod, migrateMod] = await Promise.all([
    import(`./pipelines/${pipelineId}/transfer-pipeline.js`),
    import(`./pipelines/${pipelineId}/migrate-pipeline.js`),
  ]);

  return {
    pipelineId,
    parsedVersion: parsed,
    transferProject: transferMod.transferProject,
    migrateAll: migrateMod.migrateAll,
  };
}

/**
 * Fetch just the server version string from SonarQube.
 * Uses a minimal HTTP call — no full client instantiation needed.
 *
 * @param {object} config - { url, token }
 * @returns {Promise<string>} Version string (e.g., '9.9.0.65466')
 */
async function fetchServerVersion(config) {
  try {
    const response = await axios.get(`${config.url}/api/system/status`, {
      auth: { username: config.token, password: '' },
      timeout: 10000,
    });
    return response.data.version || 'unknown';
  } catch (error) {
    logger.warn(`Failed to detect SonarQube version: ${error.message}. Falling back to sq-9.9 pipeline.`);
    return 'unknown';
  }
}
