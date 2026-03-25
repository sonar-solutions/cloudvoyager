// Re-export from folder structure for backward compatibility
export { createSonarCloudClient } from './api-client/index.js';

// -------- Backward-Compatible Class Wrapper --------

import { createSonarCloudClient } from './api-client/index.js';

export class SonarCloudClient {
  constructor(config) {
    const instance = createSonarCloudClient(config);
    Object.assign(this, instance);
  }
}
