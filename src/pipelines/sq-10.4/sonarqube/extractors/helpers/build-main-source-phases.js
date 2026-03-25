import { extractMeasures } from '../measures.js';
import { extractSources } from '../sources.js';
import { extractChangesets } from '../changesets.js';
import { extractSymbols } from '../symbols.js';
import { extractSyntaxHighlighting } from '../syntax-highlighting.js';
import { extractDuplications } from '../duplications.js';

// -------- Main Logic --------

/**
 * Build source-related extraction phases (measures, sources, duplications, etc).
 *
 * @param {object} extractor - DataExtractor instance
 * @param {object} ctx - Mutable context accumulator
 * @param {object} opts - { maxFiles, sourceConcurrency, dupConcurrency }
 * @returns {Array<object>} Phase definitions
 */
export function buildMainSourcePhases(extractor, ctx, opts) {
  const { maxFiles, sourceConcurrency, dupConcurrency } = opts;
  return [
    { name: 'extract:measures', label: 'Step 6: Extracting project measures',
      fn: async () => { ctx.measures = await extractMeasures(extractor.client, ctx.metricKeys); return ctx.measures; },
      restore: (d) => { ctx.measures = d; } },
    { name: 'extract:sources', label: 'Step 7: Extracting source code',
      fn: async () => { ctx.sources = await extractSources(extractor.client, null, maxFiles, { concurrency: sourceConcurrency }); return ctx.sources; },
      restore: (d) => { ctx.sources = d; } },
    { name: 'extract:duplications', label: 'Step 7b: Extracting duplications',
      fn: async () => { ctx.duplications = await extractDuplications(extractor.client, ctx.components, null, { concurrency: dupConcurrency }); return ctx.duplications; },
      restore: (d) => { ctx.duplications = d; } },
    { name: 'extract:changesets', label: 'Step 8: Extracting changesets',
      fn: async () => { ctx.changesets = await extractChangesets(extractor.client, ctx.sourceFilesList, ctx.components); return ctx.changesets; },
      restore: (d) => { ctx.changesets = d; } },
    { name: 'extract:symbols', label: 'Step 9: Extracting symbols',
      fn: async () => { ctx.symbols = await extractSymbols(extractor.client, ctx.sourceFilesList); return ctx.symbols; },
      restore: (d) => { ctx.symbols = d; } },
    { name: 'extract:syntax_highlighting', label: 'Step 10: Extracting syntax highlighting',
      fn: async () => { ctx.syntaxHighlightings = await extractSyntaxHighlighting(extractor.client, ctx.sourceFilesList); return ctx.syntaxHighlightings; },
      restore: (d) => { ctx.syntaxHighlightings = d; } },
  ];
}
