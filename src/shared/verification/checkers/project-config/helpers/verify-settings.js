// -------- Verify Project Settings --------

import logger from '../../../../utils/logger.js';

/** Verify project settings between SonarQube and SonarCloud. */
export async function verifyProjectSettings(sqClient, scClient, sqProjectKey, scProjectKey) {
  const result = { status: 'pass', mismatches: [], sqOnly: [], scOnly: [] };

  let sqSettings, scSettings;
  try { sqSettings = await sqClient.getProjectSettings(sqProjectKey); } catch (e) { logger.debug(`Failed to get SQ project settings: ${e.message}`); sqSettings = []; }
  try { scSettings = await scClient.getProjectSettings(scProjectKey); } catch (e) { logger.debug(`Failed to get SC project settings: ${e.message}`); scSettings = []; }

  const sqNonInherited = sqSettings.filter(s => !s.inherited);
  const scMap = new Map(scSettings.map(s => [s.key, s]));

  for (const sqSetting of sqNonInherited) {
    const scSetting = scMap.get(sqSetting.key);
    if (!scSetting) { result.sqOnly.push({ key: sqSetting.key, value: sqSetting.value || sqSetting.values }); continue; }
    const sqVal = JSON.stringify(sqSetting.value || sqSetting.values || '');
    const scVal = JSON.stringify(scSetting.value || scSetting.values || '');
    if (sqVal !== scVal) {
      result.mismatches.push({ key: sqSetting.key, sqValue: sqSetting.value || sqSetting.values, scValue: scSetting.value || scSetting.values });
    }
  }

  if (result.mismatches.length > 0 || result.sqOnly.length > 0) result.status = 'fail';
  return result;
}
