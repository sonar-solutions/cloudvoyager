import logger from '../../../../../../shared/utils/logger.js';

// -------- Get All Rules --------

/** Fetch ALL rules from SonarCloud (not profile-specific). Paginated. */
export async function getAllRules(client, organization) {
  logger.info('Fetching all SonarCloud rules...');
  let allRules = [];
  let page = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get('/api/rules/search', {
      params: { organization, ps: 500, p: page },
    });
    const rules = response.data.rules || [];
    allRules = allRules.concat(rules);
    const total = response.data.total || 0;
    if (page * 500 >= total || rules.length < 500) break;
    page++;
  }

  logger.info(`Retrieved ${allRules.length} total SonarCloud rules`);
  return allRules;
}
