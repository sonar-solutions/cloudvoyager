import { buildBranchPhasesPart1 } from './checkpoint-phases-branch-part1.js';
import { buildBranchPhasesPart2 } from './checkpoint-phases-branch-part2.js';

// -------- Build Branch Checkpoint Phases --------

/**
 * Build all phase definitions for branch checkpoint extraction.
 * @param {object} extractor - DataExtractor instance
 * @param {string} branch - Branch name
 * @param {Array} metricKeys - Metric keys from main data
 * @param {object} ctx - Mutable context accumulator
 * @param {object} opts - { maxFiles, sourceConcurrency, dupConcurrency }
 * @returns {Array} Phase definitions
 */
export function buildBranchPhases(extractor, branch, metricKeys, ctx, opts) {
  return [
    ...buildBranchPhasesPart1(extractor, branch, metricKeys, ctx),
    ...buildBranchPhasesPart2(extractor, branch, metricKeys, ctx, opts),
  ];
}
