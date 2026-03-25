import { buildDetailSections } from './detail-sections.js';

/**
 * Build PDF nodes for all per-project check results.
 * @param {object} results - Full verification results
 * @param {function} statusCell - Status cell helper
 * @returns {object[]} Array of pdfmake content nodes
 */
export function buildProjectResults(results, statusCell) {
  if (results.projectResults.length === 0) return [];

  const nodes = [{ text: 'Per-Project Checks', style: 'heading' }];

  for (const project of results.projectResults) {
    const checks = Object.values(project.checks || {});
    const fails = checks.filter(c => c.status === 'fail').length;
    const statusLabel = fails === 0 ? 'PASS' : 'FAIL';

    nodes.push({ text: `${statusLabel}  ${project.sqProjectKey} → ${project.scProjectKey}`, style: 'subheading' });

    const rows = [[
      { text: 'Check', style: 'tableHeader' },
      { text: 'Status', style: 'tableHeader' },
      { text: 'Details', style: 'tableHeader' }
    ]];

    const c = project.checks;
    if (c.existence) rows.push(['Exists', statusCell(c.existence.status), '']);
    if (c.branches) rows.push(['Branches', statusCell(c.branches.status), `SQ: ${c.branches.sqCount}, SC: ${c.branches.scCount}, Missing: ${(c.branches.missing || []).length}`]);
    if (c.issues) rows.push(['Issues', statusCell(c.issues.status), `Matched: ${c.issues.matched}/${c.issues.sqCount}, Status mismatches: ${(c.issues.statusMismatches || []).length}, History mismatches: ${(c.issues.statusHistoryMismatches || []).length}`]);
    if (c.hotspots) rows.push(['Hotspots', statusCell(c.hotspots.status), `Matched: ${c.hotspots.matched}/${c.hotspots.sqCount}, Status mismatches: ${(c.hotspots.statusMismatches || []).length}`]);
    if (c.measures) rows.push(['Measures', statusCell(c.measures.status), `${c.measures.compared || 0} compared, ${(c.measures.mismatches || []).length} mismatches`]);
    if (c.qualityGate) rows.push(['Quality Gate', statusCell(c.qualityGate.status), `SQ: ${c.qualityGate.sqGate || 'none'}, SC: ${c.qualityGate.scGate || 'none'}`]);
    if (c.qualityProfiles) rows.push(['Quality Profiles', statusCell(c.qualityProfiles.status), `${(c.qualityProfiles.mismatches || []).length} mismatches`]);
    if (c.settings) rows.push(['Settings', statusCell(c.settings.status), `${(c.settings.mismatches || []).length} mismatches`]);
    if (c.tags) rows.push(['Tags', statusCell(c.tags.status), `Missing: ${(c.tags.missing || []).length}`]);
    if (c.links) rows.push(['Links', statusCell(c.links.status), `Missing: ${(c.links.missing || []).length}`]);
    if (c.newCodePeriods) rows.push(['New Code Periods', statusCell(c.newCodePeriods.status), '']);
    if (c.devopsBinding) rows.push(['DevOps Binding', statusCell(c.devopsBinding.status), '']);
    if (c.permissions) rows.push(['Permissions', statusCell(c.permissions.status), `${(c.permissions.mismatches || []).length} groups with gaps`]);

    if (rows.length > 1) {
      nodes.push({
        table: { headerRows: 1, widths: ['*', 50, '*'], body: rows },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 5],
      });
    }

    // Unsyncable note
    const unsyncParts = [];
    if (c.issues?.unsyncable?.typeChanges > 0) unsyncParts.push(`${c.issues.unsyncable.typeChanges} type changes`);
    if (c.issues?.unsyncable?.severityChanges > 0) unsyncParts.push(`${c.issues.unsyncable.severityChanges} severity changes`);
    if (c.hotspots?.unsyncable?.assignments > 0) unsyncParts.push(`${c.hotspots.unsyncable.assignments} hotspot assignments`);
    if (unsyncParts.length > 0) {
      nodes.push({ text: `Unsyncable: ${unsyncParts.join(', ')}`, style: 'statusWarn', margin: [0, 0, 0, 5] });
    }

    // Detail sections
    buildDetailSections(c, nodes);

    // Add spacing between projects
    nodes.push({ text: '', margin: [0, 0, 0, 10] });
  }

  return nodes;
}
