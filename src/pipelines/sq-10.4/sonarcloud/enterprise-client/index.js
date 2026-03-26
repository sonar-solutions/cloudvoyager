import { createEnterpriseClient } from './helpers/create-enterprise-client.js';

// -------- Main Logic --------

export { createEnterpriseClient };

// Thin class wrapper for backward compatibility.
// Uses prototype-aware assignment so sinon stubs work.
export class EnterpriseClient {
  constructor(config) {
    const instance = createEnterpriseClient(config);
    for (const [key, value] of Object.entries(instance)) {
      if (typeof value === 'function' && typeof this[key]?.isSinonProxy !== 'undefined') continue;
      this[key] = value;
    }
  }

  // Prototype method placeholders for sinon stub compatibility.
  resolveEnterpriseId() {}
  listPortfolios() {}
  createPortfolio() {}
  updatePortfolio() {}
  deletePortfolio() {}
  getSelectableOrganizations() {}
  getSelectableProjects() {}
}
