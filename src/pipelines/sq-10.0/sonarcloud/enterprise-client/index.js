import { createEnterpriseHttpClient } from './helpers/create-enterprise-http-client.js';
import { bindEnterpriseMethods } from './helpers/enterprise-methods.js';
import { bindEnterprisePaginatedMethods } from './helpers/enterprise-paginated-methods.js';

// -------- Create Enterprise Client --------

export function createEnterpriseClient({ url, token, rateLimit = {} }) {
  const parsed = new URL(url);
  const baseURL = `${parsed.protocol}//api.${parsed.host}/enterprises`;

  const ctx = {
    baseURL,
    token,
    client: createEnterpriseHttpClient(baseURL, token, rateLimit),
  };

  bindEnterpriseMethods(ctx);
  bindEnterprisePaginatedMethods(ctx);
  return ctx;
}

export class EnterpriseClient {
  constructor(opts) {
    Object.assign(this, createEnterpriseClient(opts));
  }
}
