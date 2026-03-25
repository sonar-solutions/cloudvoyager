// -------- Verification PDF Report --------

import { generatePdfBuffer } from '../../../reports/pdf-helpers.js';
import { buildHeader } from './helpers/build-header.js';
import { buildSummaryTable } from './helpers/build-summary.js';
import { buildOrgResults } from './helpers/build-org-results.js';
import { buildProjectResults } from '../pdf-sections/project-results.js';
import { buildDocDefinition } from './helpers/build-doc-definition.js';

/**
 * Generate a PDF verification report.
 */
export async function generateVerificationPdf(results) {
  const content = [];

  content.push(...buildHeader(results));
  content.push(...buildSummaryTable(results));
  content.push(...buildOrgResults(results));
  content.push(...buildProjectResults(results));

  return generatePdfBuffer(buildDocDefinition(content));
}
