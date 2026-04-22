import { extractChangesets } from '../../../changesets.js';
import { extractSymbols } from '../../../symbols.js';
import { extractSyntaxHighlighting } from '../../../syntax-highlighting.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Extract SCM and Highlighting --------

/** Steps 8-10: Extract changesets, symbols, and syntax highlighting. */
export async function extractScmAndHighlighting(ext, data) {
  logger.info('Step 8/10: Extracting changesets...');
  data.changesets = await extractChangesets(ext.client, data._sourceFilesList, data.components, data.issues);

  logger.info('Step 9/10: Extracting symbols...');
  data.symbols = await extractSymbols(ext.client, data._sourceFilesList);

  logger.info('Step 10/10: Extracting syntax highlighting...');
  data.syntaxHighlightings = await extractSyntaxHighlighting(ext.client, data._sourceFilesList);
}
