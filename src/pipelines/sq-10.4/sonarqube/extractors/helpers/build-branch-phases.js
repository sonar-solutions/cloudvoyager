import { buildBranchCorePhases } from './build-branch-core-phases.js';
import { buildBranchSourcePhases } from './build-branch-source-phases.js';

// -------- Main Logic --------

/**
 * Build the ordered list of extraction phases for a branch.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {string} branch - Branch name
 * @param {object} ctx - Mutable context accumulator
 * @param {object} opts - { metricKeys, maxFiles, sourceConcurrency, dupConcurrency }
 * @returns {Array<object>} Phase definitions
 */
export function buildBranchPhases(extractor, branch, ctx, opts) {
  return [
    ...buildBranchCorePhases(extractor, branch, ctx, opts),
    ...buildBranchSourcePhases(extractor, branch, ctx, opts),
  ];
}
