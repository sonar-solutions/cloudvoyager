// -------- Build Rule Breakdown Table --------

/** Build a pdfmake table showing per-rule disappeared/appeared counts. */
export function buildRuleTable(byRule) {
  const entries = Object.entries(byRule);
  if (entries.length === 0) return [];

  const body = [[
    { text: 'Rule', style: 'tableHeader' },
    { text: 'Disappeared', style: 'tableHeader' },
    { text: 'Appeared', style: 'tableHeader' },
  ]];

  for (const [rule, counts] of entries) {
    body.push([
      { text: rule, style: 'tableCell' },
      { text: String(counts.disappeared), style: 'tableCell' },
      { text: String(counts.appeared), style: 'tableCell' },
    ]);
  }

  return [
    { text: 'Per-Rule Breakdown', style: 'subheading' },
    { table: { headerRows: 1, widths: ['*', 70, 70], body }, layout: 'lightHorizontalLines' },
  ];
}
