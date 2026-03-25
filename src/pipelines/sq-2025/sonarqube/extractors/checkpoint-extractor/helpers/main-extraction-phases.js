import { buildMainPhasesPart1 } from './main-phases-part1.js';
import { buildMainPhasesPart2 } from './main-phases-part2.js';

// -------- Main Extraction Phases --------

/**
 * Build the ordered list of extraction phases for main branch.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {object} ctx - Accumulated extraction context
 * @param {number} maxFiles - Max source files to extract
 * @param {number} sourceConcurrency - Source extraction concurrency
 * @param {number} dupConcurrency - Duplication extraction concurrency
 * @returns {Array<object>} Phase definitions
 */
export function buildMainExtractionPhases(extractor, ctx, maxFiles, sourceConcurrency, dupConcurrency) {
  return [
    ...buildMainPhasesPart1(extractor, ctx),
    ...buildMainPhasesPart2(extractor, ctx, maxFiles, sourceConcurrency, dupConcurrency),
  ];
}
