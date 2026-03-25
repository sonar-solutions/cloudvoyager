import logger from '../../../../../../shared/utils/logger.js';

// -------- Get Active Rules --------

/** Fetch paginated active rules for a SC quality profile. */
export async function getActiveRules(client, organization, profileKey) {
  logger.debug(`Fetching active rules for SC profile: ${profileKey}`);
  let allRules = [];
  let page = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get('/api/rules/search', { params: { qprofile: profileKey, organization, activation: 'true', ps: 100, p: page } });
    const rules = response.data.rules || [];
    allRules = allRules.concat(rules);
    if (page * 100 >= (response.data.total || 0) || rules.length < 100) break;
    page++;
  }

  logger.debug(`Retrieved ${allRules.length} active rules for profile ${profileKey}`);
  return allRules;
}
