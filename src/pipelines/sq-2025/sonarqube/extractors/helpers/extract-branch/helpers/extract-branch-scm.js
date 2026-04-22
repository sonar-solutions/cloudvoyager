import { extractChangesets } from '../../../changesets.js';
import { extractSymbols } from '../../../symbols.js';
import { extractSyntaxHighlighting } from '../../../syntax-highlighting.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Extract Branch SCM --------

/** Extract changesets, symbols, and syntax highlighting for a branch. */
export async function extractBranchScm(ext, branch, sourceFilesList, components, issues = []) {
  logger.info(`  [${branch}] Extracting changesets...`);
  const changesets = await extractChangesets(ext.client, sourceFilesList, components, issues);

  logger.info(`  [${branch}] Extracting symbols...`);
  const symbols = await extractSymbols(ext.client, sourceFilesList);

  logger.info(`  [${branch}] Extracting syntax highlighting...`);
  const syntaxHighlightings = await extractSyntaxHighlighting(ext.client, sourceFilesList);

  return { changesets, symbols, syntaxHighlightings };
}
