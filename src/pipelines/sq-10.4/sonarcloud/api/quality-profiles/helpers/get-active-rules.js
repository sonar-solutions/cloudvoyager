import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch active rules for a SC quality profile (paginated).
export async function getActiveRules(client, organization, profileKey) {
  logger.debug(`Fetching active rules for SC profile: ${profileKey}`);
  let allRules = [], page = 1;
  const pageSize = 100;
  while (true) { // eslint-disable-line no-constant-condition
    const response = await client.get('/api/rules/search', { params: { qprofile: profileKey, organization, activation: 'true', ps: pageSize, p: page } });
    const rules = response.data.rules || [];
    allRules = allRules.concat(rules);
    const total = response.data.total || 0;
    if (page * pageSize >= total || rules.length < pageSize) break;
    page++;
  }
  logger.debug(`Retrieved ${allRules.length} active rules for profile ${profileKey}`);
  return allRules;
}
