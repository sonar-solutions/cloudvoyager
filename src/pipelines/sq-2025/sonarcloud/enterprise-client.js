// -------- Re-export (dual-export: factory + class wrapper) --------

export { createEnterpriseClient } from './enterprise-client/index.js';

import { createEnterpriseClient } from './enterprise-client/index.js';

/** Backward-compatible class wrapper around createEnterpriseClient. */
export class EnterpriseClient {
  constructor(config) {
    const instance = createEnterpriseClient(config);
    Object.assign(this, instance);
  }
}
