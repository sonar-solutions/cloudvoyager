// -------- Generate PDF Buffer --------
import { createPrinter } from './create-printer.js';

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
