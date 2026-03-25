import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate New Code Periods --------

/** Migrate new code period definitions to SonarCloud via settings API. */
export async function migrateNewCodePeriods(projectKey, newCodeData, client) {
  if (!newCodeData) return;
  const { projectLevel, branchOverrides } = newCodeData;
  if (!projectLevel && (!branchOverrides || branchOverrides.length === 0)) return;

  let settings = null;
  let sourceLabel = null;

  if (projectLevel && projectLevel.settings) {
    settings = projectLevel.settings;
    sourceLabel = `project-level ${projectLevel.type}`;
  }

  if (!settings && branchOverrides && branchOverrides.length > 0) {
    const mainBranch = branchOverrides.find(b => b.branchKey === 'main' || b.branchKey === 'master');
    const fallback = mainBranch || branchOverrides[0];
    if (fallback.settings) {
      settings = fallback.settings;
      sourceLabel = `branch-level ${fallback.type} (branch: ${fallback.branchKey})`;
    }
  }

  if (!settings) {
    const types = [projectLevel?.type, ...((branchOverrides || []).map(b => b.type))].filter(Boolean);
    const reason = `unsupported type(s) ${types.join(', ')} (only NUMBER_OF_DAYS and PREVIOUS_VERSION are supported)`;
    logger.warn(`Cannot migrate new code definition for ${projectKey}: ${reason}`);
    return { skipped: true, detail: reason };
  }

  const settingsDesc = settings.map(s => `${s.key}=${s.value}`).join(', ');
  logger.info(`Setting new code definition for ${projectKey}: ${settingsDesc} (from ${sourceLabel})`);

  try {
    for (const setting of settings) await client.setProjectSetting(setting.key, setting.value, projectKey);
  } catch (error) {
    logger.warn(`Failed to set new code definition for ${projectKey}: ${error.message}`);
    throw error;
  }
}
