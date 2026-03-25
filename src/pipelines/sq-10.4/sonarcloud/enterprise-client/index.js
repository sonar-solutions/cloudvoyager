import { createEnterpriseClient } from './helpers/create-enterprise-client.js';

// -------- Main Logic --------

export { createEnterpriseClient };

// Thin class wrapper for backward compatibility.
export class EnterpriseClient {
  constructor(config) {
    const instance = createEnterpriseClient(config);
    Object.assign(this, instance);
  }
}
