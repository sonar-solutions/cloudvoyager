import { extractMeasures } from '../measures.js';
import { extractSources } from '../sources.js';
import { extractChangesets } from '../changesets.js';
import { extractSymbols } from '../symbols.js';
import { extractSyntaxHighlighting } from '../syntax-highlighting.js';
import { extractDuplications } from '../duplications.js';

// -------- Branch Phases Part 2: Measures through Syntax Highlighting --------

export function buildBranchPhasesPart2(extractor, branch, metricKeys, ctx, opts) {
  return [
    { name: 'extract:measures', label: `[${branch}] Extracting project measures`,
      fn: async () => { ctx.measures = await extractMeasures(extractor.client, metricKeys, branch); return ctx.measures; },
      restore: (d) => { ctx.measures = d; } },
    { name: 'extract:sources', label: `[${branch}] Extracting source code`,
      fn: async () => { ctx.sources = await extractSources(extractor.client, branch, opts.maxFiles, { concurrency: opts.sourceConcurrency }); return ctx.sources; },
      restore: (d) => { ctx.sources = d; } },
    { name: 'extract:duplications', label: `[${branch}] Extracting duplications`,
      fn: async () => { ctx.duplications = await extractDuplications(extractor.client, ctx.components, branch, { concurrency: opts.dupConcurrency }); return ctx.duplications; },
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
