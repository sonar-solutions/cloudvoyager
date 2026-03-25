// -------- Build Check Rows --------

/**
 * Build the markdown table rows for a project's checks.
 * @param {object} c - Project checks object
 * @param {function} statusIcon - Status icon helper
 * @returns {string[]} Array of markdown table row strings
 */
export function buildCheckRows(c, statusIcon) {
  const lines = [];
  lines.push(`| Check | Status | Details |`);
  lines.push(`|-------|--------|---------|`);

  if (c.existence) lines.push(`| Project exists | ${statusIcon(c.existence.status)} ${c.existence.status} | |`);
  if (c.branches) lines.push(`| Branches | ${statusIcon(c.branches.status)} ${c.branches.status} | SQ: ${c.branches.sqCount}, SC: ${c.branches.scCount}, Missing: ${(c.branches.missing || []).length} |`);
  if (c.issues) lines.push(`| Issues | ${statusIcon(c.issues.status)} ${c.issues.status} | SQ: ${c.issues.sqCount}, SC: ${c.issues.scCount}, Matched: ${c.issues.matched}, Unmatched: ${c.issues.unmatched} |`);
  if (c.hotspots) lines.push(`| Hotspots | ${statusIcon(c.hotspots.status)} ${c.hotspots.status} | SQ: ${c.hotspots.sqCount}, SC: ${c.hotspots.scCount}, Matched: ${c.hotspots.matched}, Unmatched: ${c.hotspots.unmatched} |`);
  if (c.measures) lines.push(`| Measures | ${statusIcon(c.measures.status)} ${c.measures.status} | ${c.measures.compared || 0} compared, ${(c.measures.mismatches || []).length} mismatches |`);
  if (c.qualityGate) lines.push(`| Quality Gate | ${statusIcon(c.qualityGate.status)} ${c.qualityGate.status} | SQ: ${c.qualityGate.sqGate || 'none'}, SC: ${c.qualityGate.scGate || 'none'} |`);
  if (c.qualityProfiles) lines.push(`| Quality Profiles | ${statusIcon(c.qualityProfiles.status)} ${c.qualityProfiles.status} | ${(c.qualityProfiles.mismatches || []).length} mismatches |`);
  if (c.settings) lines.push(`| Settings | ${statusIcon(c.settings.status)} ${c.settings.status} | ${(c.settings.mismatches || []).length} mismatches, ${(c.settings.sqOnly || []).length} SQ-only |`);
  if (c.tags) lines.push(`| Tags | ${statusIcon(c.tags.status)} ${c.tags.status} | Missing: ${(c.tags.missing || []).length}, Extra: ${(c.tags.extra || []).length} |`);
  if (c.links) lines.push(`| Links | ${statusIcon(c.links.status)} ${c.links.status} | SQ: ${c.links.sqCount || 0}, SC: ${c.links.scCount || 0}, Missing: ${(c.links.missing || []).length} |`);
  if (c.newCodePeriods) lines.push(`| New Code Periods | ${statusIcon(c.newCodePeriods.status)} ${c.newCodePeriods.status} | SQ: ${c.newCodePeriods.details?.sqProjectLevel || 'default'}, SC: ${c.newCodePeriods.details?.scProjectLevel || 'default'} |`);
  if (c.devopsBinding) lines.push(`| DevOps Binding | ${statusIcon(c.devopsBinding.status)} ${c.devopsBinding.status} | |`);
  if (c.permissions) lines.push(`| Permissions | ${statusIcon(c.permissions.status)} ${c.permissions.status} | ${(c.permissions.mismatches || []).length} groups with missing permissions |`);

  return lines;
}
