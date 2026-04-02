// -------- Build Summary Table --------

/** Build the summary metrics table for the issues delta PDF. */
export function buildSummaryTable(summary) {
  const body = [
    [{ text: 'Metric', style: 'tableHeader' }, { text: 'Count', style: 'tableHeader' }],
    [{ text: 'Projects Compared', style: 'tableCell' }, { text: String(summary.projectsCompared), style: 'tableCell' }],
    [{ text: 'Issues disappeared (in SQ, not SC)', style: 'tableCell' }, { text: String(summary.totalDisappeared), style: 'statusFail' }],
    [{ text: 'Issues appeared (in SC, not SQ)', style: 'tableCell' }, { text: String(summary.totalAppeared), style: 'statusPartial' }],
  ];

  return [
    { text: 'Summary', style: 'heading' },
    { table: { headerRows: 1, widths: ['*', 80], body }, layout: 'lightHorizontalLines' },
  ];
}
