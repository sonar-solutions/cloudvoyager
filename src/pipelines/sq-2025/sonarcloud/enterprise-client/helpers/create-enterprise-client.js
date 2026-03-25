import { createEnterpriseAxios } from './create-enterprise-axios.js';
import { attachPortfolioMethods } from './portfolio-methods.js';
import { attachPaginatedMethods } from './paginated-methods.js';

// -------- Create Enterprise Client --------

/** Factory function: create an Enterprise API client instance. */
export function createEnterpriseClient({ url, token, rateLimit = {} }) {
  const parsed = new URL(url);
  const baseURL = `${parsed.protocol}//api.${parsed.host}/enterprises`;
  const maxRetries = rateLimit.maxRetries ?? 3;
  const baseDelay = rateLimit.baseDelay ?? 1000;

  const inst = {
    baseURL,
    token,
    client: createEnterpriseAxios(baseURL, token, maxRetries, baseDelay),
  };

  attachPortfolioMethods(inst);
  attachPaginatedMethods(inst);

  return inst;
}
