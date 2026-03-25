import { buildMainCorePhases } from './build-main-core-phases.js';
import { buildMainSourcePhases } from './build-main-source-phases.js';

// -------- Main Logic --------

/**
 * Build the ordered list of all extraction phases for the main branch.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {object} ctx - Mutable context accumulator
 * @param {object} opts - { maxFiles, sourceConcurrency, dupConcurrency }
 * @returns {Array<object>} Phase definitions
 */
export function buildMainPhases(extractor, ctx, opts) {
  return [
    ...buildMainCorePhases(extractor, ctx),
    ...buildMainSourcePhases(extractor, ctx, opts),
  ];
}
