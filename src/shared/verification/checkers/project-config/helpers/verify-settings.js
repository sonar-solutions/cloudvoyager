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

  const pick = (s) => s.value !== undefined && s.value !== null ? s.value : (s.values?.length ? s.values : undefined);

  for (const sqSetting of sqNonInherited) {
    const scSetting = scMap.get(sqSetting.key);
    if (!scSetting) { result.sqOnly.push({ key: sqSetting.key, value: pick(sqSetting) }); continue; }
    const sqVal = JSON.stringify(pick(sqSetting) ?? '');
    const scVal = JSON.stringify(pick(scSetting) ?? '');
    if (sqVal !== scVal) {
      result.mismatches.push({ key: sqSetting.key, sqValue: pick(sqSetting), scValue: pick(scSetting) });
    }
  }

  if (result.mismatches.length > 0 || result.sqOnly.length > 0) result.status = 'fail';
  return result;
}
