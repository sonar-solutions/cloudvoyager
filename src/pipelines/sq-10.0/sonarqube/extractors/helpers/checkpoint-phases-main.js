import { buildPhasesPart1 } from './checkpoint-phases-main-part1.js';
import { buildPhasesPart2 } from './checkpoint-phases-main-part2.js';

// -------- Build Main Branch Checkpoint Phases --------

/**
 * Build all phase definitions for main branch checkpoint extraction.
 * @param {object} extractor - DataExtractor instance
 * @param {object} ctx - Mutable context accumulator
 * @param {object} opts - { maxFiles, sourceConcurrency, dupConcurrency }
 * @returns {Array} Phase definitions
 */
export function buildMainPhases(extractor, ctx, opts) {
  return [
    ...buildPhasesPart1(extractor, ctx),
    ...buildPhasesPart2(extractor, ctx, opts),
  ];
}
