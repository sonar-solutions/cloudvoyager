// -------- Build PDF Org Results --------

/**
 * Build the org-level checks PDF section.
 * @param {object} results - Verification results
 * @returns {object[]} PDF content nodes
 */
export function buildOrgResults(results) {
  if (results.orgResults.length === 0) return [];

  const nodes = [{ text: 'Organization-Level Checks', style: 'heading' }];

  for (const org of results.orgResults) {
    nodes.push({ text: `Organization: ${org.orgKey}`, style: 'subheading' });

    if (org.error) {
      nodes.push({ text: `Error: ${org.error}`, style: 'statusFail' });
      continue;
    }

    const rows = [[
      { text: 'Check', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Details', style: 'tableHeader' },
    ]];

    const checks = org.checks || {};
    if (checks.qualityGates) rows.push(['Quality Gates', statusCell(checks.qualityGates.status), `Missing: ${(checks.qualityGates.missing || []).length}`]);
    if (checks.qualityProfiles) rows.push(['Quality Profiles', statusCell(checks.qualityProfiles.status), `Missing: ${(checks.qualityProfiles.missing || []).length}`]);
    if (checks.groups) rows.push(['Groups', statusCell(checks.groups.status), `Missing: ${(checks.groups.missing || []).length}`]);
    if (checks.globalPermissions) rows.push(['Global Permissions', statusCell(checks.globalPermissions.status), `${(checks.globalPermissions.mismatches || []).length} groups with gaps`]);
    if (checks.permissionTemplates) rows.push(['Permission Templates', statusCell(checks.permissionTemplates.status), `Missing: ${(checks.permissionTemplates.missing || []).length}`]);

    if (rows.length > 1) {
      nodes.push({
        table: { headerRows: 1, widths: ['*', 60, '*'], body: rows },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 10],
      });
    }
  }

  return nodes;
}

function statusCell(status) {
  const styleMap = { pass: 'statusPass', fail: 'statusFail', skipped: 'statusSkip', error: 'statusWarn' };
  return { text: (status || '').toUpperCase(), style: styleMap[status] || 'tableCell' };
}
