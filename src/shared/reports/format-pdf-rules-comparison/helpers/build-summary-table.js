// -------- Build Summary Table --------

/** Build the summary metrics table for the rules comparison PDF. */
export function buildSummaryTable(summary) {
  const body = [
    [{ text: 'Metric', style: 'tableHeader' }, { text: 'Count', style: 'tableHeader' }],
    [{ text: 'SonarQube Total Rules', style: 'tableCell' }, { text: String(summary.sqTotalRules), style: 'tableCell' }],
    [{ text: 'SonarCloud Total Rules', style: 'tableCell' }, { text: String(summary.scTotalRules), style: 'tableCell' }],
    [{ text: 'Rules in Both', style: 'tableCell' }, { text: String(summary.inBothCount), style: 'tableCell' }],
    [{ text: 'Only in SonarQube', style: 'tableCell' }, { text: String(summary.onlyInSQCount), style: 'statusFail' }],
    [{ text: 'Only in SonarCloud', style: 'tableCell' }, { text: String(summary.onlyInSCCount), style: 'statusPartial' }],
  ];

  return [
    { text: 'Summary', style: 'heading' },
    { table: { headerRows: 1, widths: ['*', 80], body }, layout: 'lightHorizontalLines' },
  ];
}
