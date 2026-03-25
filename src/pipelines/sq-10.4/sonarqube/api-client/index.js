import { createSonarQubeClient } from './helpers/create-sonarqube-client.js';

// -------- Main Logic --------

export { createSonarQubeClient };

// Thin class wrapper for backward compatibility.
export class SonarQubeClient {
  constructor(config) {
    const instance = createSonarQubeClient(config);
    Object.assign(this, instance);
  }
}
