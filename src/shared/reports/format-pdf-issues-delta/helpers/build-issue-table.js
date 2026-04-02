// -------- Build Issue Table --------

/** Build a pdfmake table of issues (used for both disappeared and appeared). */
export function buildIssueTable(issues, label, maxRows = 50) {
  if (issues.length === 0) return [];

  const body = [[
    { text: 'Rule', style: 'tableHeader' },
    { text: 'File:Line', style: 'tableHeader' },
    { text: 'Severity', style: 'tableHeader' },
  ]];

  for (const i of issues.slice(0, maxRows)) {
    const file = i.component?.split(':').pop() || '';
    body.push([
      { text: i.rule, style: 'tableCell' },
      { text: `${file}:${i.line ?? '—'}`, style: 'tableCell' },
      { text: i.severity, style: 'tableCell' },
    ]);
  }

  if (issues.length > maxRows) {
    body.push([{ text: `… and ${issues.length - maxRows} more`, colSpan: 3, style: 'small' }, {}, {}]);
  }

  return [
    { text: `${label} (${issues.length})`, style: 'subheading' },
    { table: { headerRows: 1, widths: [120, '*', 55], body }, layout: 'lightHorizontalLines' },
  ];
}
