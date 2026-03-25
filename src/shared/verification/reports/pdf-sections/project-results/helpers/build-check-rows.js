// -------- Build PDF Check Rows --------

/**
 * Build PDF table rows for a project's checks.
 * @param {object} c - Project checks object
 * @param {function} statusCell - Status cell helper
 * @returns {Array[]} Array of row arrays for pdfmake
 */
export function buildPdfCheckRows(c, statusCell) {
  const rows = [];
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
  return rows;
}
