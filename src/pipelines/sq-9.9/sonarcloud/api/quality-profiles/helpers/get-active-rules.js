import logger from '../../../../../../shared/utils/logger.js';

// -------- Fetch Active Rules for a Quality Profile --------

export async function getActiveRules(client, organization, profileKey) {
  logger.debug(`Fetching active rules for SC profile: ${profileKey}`);
  const allRules = await fetchPaginatedRules(client, organization, profileKey, {});
  logger.debug(`Retrieved ${allRules.length} active rules for profile ${profileKey}`);
  return allRules;
}

export async function getActiveRulesWithCleanCodeFields(client, organization, profileKey) {
  logger.debug(`Fetching active rules with Clean Code fields for SC profile: ${profileKey}`);
  const allRules = await fetchPaginatedRules(client, organization, profileKey, { f: 'cleanCodeAttribute,impacts' });
  logger.debug(`Retrieved ${allRules.length} active rules with Clean Code fields for profile ${profileKey}`);
  return allRules;
}

async function fetchPaginatedRules(client, organization, profileKey, extraParams) {
  let allRules = [];
  let page = 1;
  const pageSize = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get('/api/rules/search', {
      params: { qprofile: profileKey, organization, activation: 'true', ps: pageSize, p: page, ...extraParams }
    });
    const rules = response.data.rules || [];
    allRules = allRules.concat(rules);
    const total = response.data.total || 0;
    if (page * pageSize >= total || rules.length < pageSize) break;
    page++;
  }

  return allRules;
}
