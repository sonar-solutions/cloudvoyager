// -------- Re-export (dual-export: factory + class wrapper) --------

export { createSonarQubeClient } from './api-client/index.js';

import { createSonarQubeClient } from './api-client/index.js';

/** Backward-compatible class wrapper around createSonarQubeClient. */
export class SonarQubeClient {
  constructor(config) {
    const instance = createSonarQubeClient(config);
    Object.assign(this, instance);
  }
}
