import { extractMeasures } from '../measures.js';
import { extractSources } from '../sources.js';
import { extractChangesets } from '../changesets.js';
import { extractSymbols } from '../symbols.js';
import { extractSyntaxHighlighting } from '../syntax-highlighting.js';
import { extractDuplications } from '../duplications.js';

// -------- Main Logic --------

/**
 * Build source-related extraction phases for a branch.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {string} branch - Branch name
 * @param {object} ctx - Mutable context accumulator
 * @param {object} opts - { metricKeys, maxFiles, sourceConcurrency, dupConcurrency }
 * @returns {Array<object>} Phase definitions
 */
export function buildBranchSourcePhases(extractor, branch, ctx, opts) {
  const { metricKeys, maxFiles, sourceConcurrency, dupConcurrency } = opts;
  return [
    { name: 'extract:measures', label: `[${branch}] Extracting project measures`,
      fn: async () => { ctx.measures = await extractMeasures(extractor.client, metricKeys, branch); return ctx.measures; },
      restore: (d) => { ctx.measures = d; } },
    { name: 'extract:sources', label: `[${branch}] Extracting source code`,
      fn: async () => { ctx.sources = await extractSources(extractor.client, branch, maxFiles, { concurrency: sourceConcurrency }); return ctx.sources; },
      restore: (d) => { ctx.sources = d; } },
    { name: 'extract:duplications', label: `[${branch}] Extracting duplications`,
      fn: async () => { ctx.duplications = await extractDuplications(extractor.client, ctx.components, branch, { concurrency: dupConcurrency }); return ctx.duplications; },
      restore: (d) => { ctx.duplications = d; } },
    { name: 'extract:changesets', label: `[${branch}] Extracting changesets`,
      fn: async () => { ctx.changesets = await extractChangesets(extractor.client, ctx.sourceFilesList, ctx.components); return ctx.changesets; },
      restore: (d) => { ctx.changesets = d; } },
    { name: 'extract:symbols', label: `[${branch}] Extracting symbols`,
      fn: async () => { ctx.symbols = await extractSymbols(extractor.client, ctx.sourceFilesList); return ctx.symbols; },
      restore: (d) => { ctx.symbols = d; } },
    { name: 'extract:syntax_highlighting', label: `[${branch}] Extracting syntax highlighting`,
      fn: async () => { ctx.syntaxHighlightings = await extractSyntaxHighlighting(extractor.client, ctx.sourceFilesList); return ctx.syntaxHighlightings; },
      restore: (d) => { ctx.syntaxHighlightings = d; } },
  ];
}
