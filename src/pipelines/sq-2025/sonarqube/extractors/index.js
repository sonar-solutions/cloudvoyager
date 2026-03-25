import { createDataExtractor } from './helpers/create-data-extractor.js';

// -------- Factory (primary export) --------

export { createDataExtractor } from './helpers/create-data-extractor.js';

// -------- Class wrapper (backward compatibility) --------

/**
 * Thin class wrapper around createDataExtractor factory.
 * Preserved for backward compatibility with existing imports.
 */
export class DataExtractor {
  constructor(client, config, state = null, performanceConfig = {}) {
    const instance = createDataExtractor(client, config, state, performanceConfig);
    Object.assign(this, instance);
  }
}
