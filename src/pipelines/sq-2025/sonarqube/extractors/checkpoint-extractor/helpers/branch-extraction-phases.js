import { buildBranchPhasesPart1 } from './branch-phases-part1.js';
import { buildBranchPhasesPart2 } from './branch-phases-part2.js';

// -------- Branch Extraction Phases --------

/**
 * Build the ordered list of extraction phases for a non-main branch.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {object} ctx - Accumulated extraction context
 * @param {string} branch - Branch name
 * @param {string[]} metricKeys - Metric keys from main branch
 * @param {number} maxFiles - Max source files to extract
 * @param {number} sourceConcurrency - Source extraction concurrency
 * @param {number} dupConcurrency - Duplication extraction concurrency
 * @returns {Array<object>} Phase definitions
 */
export function buildBranchExtractionPhases(extractor, ctx, branch, metricKeys, maxFiles, sourceConcurrency, dupConcurrency) {
  return [
    ...buildBranchPhasesPart1(extractor, ctx, branch, metricKeys),
    ...buildBranchPhasesPart2(extractor, ctx, branch, maxFiles, sourceConcurrency, dupConcurrency),
  ];
}
