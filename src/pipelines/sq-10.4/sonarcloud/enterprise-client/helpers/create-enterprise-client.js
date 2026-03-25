import { createEnterpriseHttpClient } from './create-enterprise-http-client.js';
import { buildPortfolioMethods } from './portfolio-methods.js';
import { buildEnterpriseQueryMethods } from './query-methods.js';

// -------- Main Logic --------

// Factory function to create an Enterprise API client.
export function createEnterpriseClient({ url, token, rateLimit = {} }) {
  const parsed = new URL(url);
  const baseURL = `${parsed.protocol}//api.${parsed.host}/enterprises`;
  const client = createEnterpriseHttpClient(baseURL, token, rateLimit);

  return {
    baseURL, token, client,
    ...buildPortfolioMethods(client),
    ...buildEnterpriseQueryMethods(client),
  };
}
