import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch active rules with Clean Code taxonomy fields (cleanCodeAttribute, impacts).
export async function getActiveRulesWithCleanCodeFields(client, organization, profileKey) {
  logger.debug(`Fetching active rules with Clean Code fields for SC profile: ${profileKey}`);
  let allRules = [], page = 1;
  const pageSize = 100;
  while (true) { // eslint-disable-line no-constant-condition
    const response = await client.get('/api/rules/search', {
      params: { qprofile: profileKey, organization, activation: 'true', f: 'cleanCodeAttribute,impacts', ps: pageSize, p: page }
    });
    const rules = response.data.rules || [];
    allRules = allRules.concat(rules);
    const total = response.data.total || 0;
    if (page * pageSize >= total || rules.length < pageSize) break;
    page++;
  }
  logger.debug(`Retrieved ${allRules.length} active rules with Clean Code fields for profile ${profileKey}`);
  return allRules;
}
