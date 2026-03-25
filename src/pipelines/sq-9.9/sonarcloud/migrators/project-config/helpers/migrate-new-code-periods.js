import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate New Code Period Definitions --------

export async function migrateNewCodePeriods(projectKey, newCodeData, client) {
  if (!newCodeData) return;

  const { projectLevel, branchOverrides } = newCodeData;
  if (!projectLevel && (!branchOverrides || branchOverrides.length === 0)) return;

  const settings = resolveNewCodeSettings(projectLevel, branchOverrides);

  if (!settings.resolved) {
    const types = [projectLevel?.type, ...((branchOverrides || []).map(b => b.type))].filter(Boolean);
    const reason = `unsupported type(s) ${types.join(', ')} (only NUMBER_OF_DAYS and PREVIOUS_VERSION are supported)`;
    logger.warn(`Cannot migrate new code definition for ${projectKey}: ${reason}`);
    return { skipped: true, detail: reason };
  }

  const settingsDesc = settings.values.map(s => `${s.key}=${s.value}`).join(', ');
  logger.info(`Setting new code definition for ${projectKey}: ${settingsDesc} (from ${settings.sourceLabel})`);

  try {
    for (const setting of settings.values) {
      await client.setProjectSetting(setting.key, setting.value, projectKey);
    }
  } catch (error) {
    logger.warn(`Failed to set new code definition for ${projectKey}: ${error.message}`);
    throw error;
  }
}

function resolveNewCodeSettings(projectLevel, branchOverrides) {
  if (projectLevel?.settings) {
    return { resolved: true, values: projectLevel.settings, sourceLabel: `project-level ${projectLevel.type}` };
  }

  if (branchOverrides?.length > 0) {
    const mainBranch = branchOverrides.find(b => b.branchKey === 'main' || b.branchKey === 'master');
    const fallback = mainBranch || branchOverrides[0];
    if (fallback.settings) {
      return { resolved: true, values: fallback.settings, sourceLabel: `branch-level ${fallback.type} (branch: ${fallback.branchKey})` };
    }
  }

  return { resolved: false };
}
