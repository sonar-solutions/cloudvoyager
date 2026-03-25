// -------- Build PDF Doc Definition --------

import { pdfStyles } from '../../../../reports/pdf-helpers.js';

/**
 * Build the pdfmake document definition for verification reports.
 */
export function buildDocDefinition(content) {
  return {
    info: {
      title: 'CloudVoyager Verification Report',
      author: 'CloudVoyager',
      subject: 'SonarQube to SonarCloud Migration Verification',
    },
    pageSize: 'A4',
    pageMargins: [40, 60, 40, 50],
    header: {
      text: 'CloudVoyager Verification Report',
      alignment: 'right',
      margin: [0, 20, 40, 0],
      fontSize: 8,
      color: '#999999',
    },
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      margin: [0, 10, 0, 0],
      fontSize: 8,
      color: '#999999',
    }),
    content,
    styles: {
      ...pdfStyles,
      statusPass: { color: '#2e7d32', fontSize: 9 },
      statusFail: { color: '#c62828', fontSize: 9 },
      statusWarn: { color: '#e65100', fontSize: 9 },
      statusSkip: { color: '#757575', fontSize: 9 },
    },
    defaultStyle: { fontSize: 10 },
  };
}
