/**
 * Shared PDF generation helpers for pdfmake.
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Create a pdfmake PdfPrinter instance with bundled Roboto fonts.
 */
export function createPrinter() {
  const PdfPrinter = require('pdfmake/js/printer').default;
  const pdfmakePath = require.resolve('pdfmake/package.json').replace('/package.json', '');
  const fonts = {
    Roboto: {
      normal: join(pdfmakePath, 'build/fonts/Roboto/Roboto-Regular.ttf'),
      bold: join(pdfmakePath, 'build/fonts/Roboto/Roboto-Medium.ttf'),
      italics: join(pdfmakePath, 'build/fonts/Roboto/Roboto-Italic.ttf'),
      bolditalics: join(pdfmakePath, 'build/fonts/Roboto/Roboto-MediumItalic.ttf'),
    }
  };
  return new PdfPrinter(fonts);
}

/**
 * Convert a pdfmake document definition into a PDF Buffer.
 */
export async function generatePdfBuffer(docDefinition) {
  const printer = createPrinter();
  const doc = await printer.createPdfKitDocument(docDefinition);

  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Common PDF styles used across report types.
 */
export const pdfStyles = {
  title: { fontSize: 20, bold: true, margin: [0, 0, 0, 10] },
  heading: { fontSize: 14, bold: true, margin: [0, 15, 0, 5] },
  subheading: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] },
  small: { fontSize: 8, color: '#666666' },
  tableHeader: { bold: true, fontSize: 9, fillColor: '#e8e8e8' },
  tableCell: { fontSize: 9 },
  statusOk: { color: '#2e7d32', fontSize: 9 },
  statusFail: { color: '#c62828', fontSize: 9 },
  statusPartial: { color: '#e65100', fontSize: 9 },
  statusSkip: { color: '#757575', fontSize: 9 },
  metadata: { fontSize: 10, margin: [0, 0, 0, 2] },
};

/**
 * Get the style name for a given status.
 */
export function statusStyle(status) {
  if (status === 'success') return 'statusOk';
  if (status === 'failed') return 'statusFail';
  if (status === 'partial') return 'statusPartial';
  if (status === 'skipped') return 'statusSkip';
  return 'tableCell';
}

/**
 * Get status display text.
 */
export function statusText(status) {
  if (status === 'success') return 'OK';
  if (status === 'failed') return 'FAIL';
  if (status === 'skipped') return 'SKIP';
  if (status === 'partial') return 'PARTIAL';
  return status || '';
}
