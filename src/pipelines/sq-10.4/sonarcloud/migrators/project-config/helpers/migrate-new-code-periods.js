import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Migrate new code period definitions.
export async function migrateNewCodePeriods(projectKey, newCodeData, client) {
  if (!newCodeData) return;
  const { projectLevel, branchOverrides } = newCodeData;
  if (!projectLevel && (!branchOverrides || branchOverrides.length === 0)) return;

  const { settings, sourceLabel } = resolveNewCodeSettings(projectLevel, branchOverrides);
  if (!settings) {
    const types = [projectLevel?.type, ...((branchOverrides || []).map(b => b.type))].filter(Boolean);
    const reason = `unsupported type(s) ${types.join(', ')} (only NUMBER_OF_DAYS and PREVIOUS_VERSION are supported)`;
    logger.warn(`Cannot migrate new code definition for ${projectKey}: ${reason}`);
    return { skipped: true, detail: reason };
  }

  logger.info(`Setting new code definition for ${projectKey}: ${settings.map(s => `${s.key}=${s.value}`).join(', ')} (from ${sourceLabel})`);
  try {
    for (const setting of settings) await client.setProjectSetting(setting.key, setting.value, projectKey);
  } catch (error) {
    logger.warn(`Failed to set new code definition for ${projectKey}: ${error.message}`);
    throw error;
  }
}

function resolveNewCodeSettings(projectLevel, branchOverrides) {
  if (projectLevel?.settings) return { settings: projectLevel.settings, sourceLabel: `project-level ${projectLevel.type}` };
  if (branchOverrides?.length > 0) {
    const fallback = branchOverrides.find(b => b.branchKey === 'main' || b.branchKey === 'master') || branchOverrides[0];
    if (fallback.settings) return { settings: fallback.settings, sourceLabel: `branch-level ${fallback.type} (branch: ${fallback.branchKey})` };
  }
  return { settings: null, sourceLabel: null };
}
