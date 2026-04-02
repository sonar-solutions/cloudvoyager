// -------- Build Rule Diff Sections --------

/** Build a pdfmake table from a list of rules. */
function buildRuleTable(rules, maxRows = 100) {
  const body = [[
    { text: 'Rule ID', style: 'tableHeader' }, { text: 'Name', style: 'tableHeader' },
    { text: 'Language', style: 'tableHeader' }, { text: 'Type', style: 'tableHeader' },
    { text: 'Severity', style: 'tableHeader' },
  ]];
  for (const r of rules.slice(0, maxRows)) {
    body.push([
      { text: r.key, style: 'tableCell' }, { text: r.name, style: 'tableCell' },
      { text: r.lang, style: 'tableCell' }, { text: r.type, style: 'tableCell' },
      { text: r.severity, style: 'tableCell' },
    ]);
  }
  if (rules.length > maxRows) {
    body.push([{ text: `… and ${rules.length - maxRows} more`, colSpan: 5, style: 'small' }, {}, {}, {}, {}]);
  }
  return { table: { headerRows: 1, widths: ['auto', '*', 50, 50, 55], body }, layout: 'lightHorizontalLines' };
}

/** Build PDF sections for rules only in SQ and only in SC. */
export function buildRuleDiffSections(onlyInSQ, onlyInSC) {
  const nodes = [];
  if (onlyInSQ.length > 0) {
    nodes.push({ text: `Rules Only in SonarQube (${onlyInSQ.length})`, style: 'heading' });
    nodes.push(buildRuleTable(onlyInSQ));
  }
  if (onlyInSC.length > 0) {
    nodes.push({ text: `Rules Only in SonarCloud (${onlyInSC.length})`, style: 'heading' });
    nodes.push(buildRuleTable(onlyInSC));
  }
  if (onlyInSQ.length === 0 && onlyInSC.length === 0) {
    nodes.push({ text: 'All rules match perfectly — no differences.', style: 'metadata', color: '#2e7d32' });
  }
  return nodes;
}
