import { createSonarCloudClient } from './helpers/create-sonarcloud-client.js';

// -------- Main Logic --------

export { createSonarCloudClient };

/**
 * Thin class wrapper for backward compatibility.
 * Delegates all work to createSonarCloudClient factory function.
 */
export class SonarCloudClient {
  constructor(config) {
    const instance = createSonarCloudClient(config);
    // Copy all properties and methods onto this class instance
    Object.assign(this, instance);
  }
}
