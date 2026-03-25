// -------- Format Check Rows --------

import { statusIcon } from '../status-icon.js';

/**
 * Build the table rows for org-level checks.
 */
export function formatCheckRows(checks, lines) {
  if (checks.qualityGates) {
    const qg = checks.qualityGates;
    lines.push(`| Quality Gates | ${statusIcon(qg.status)} ${qg.status} | SQ: ${qg.sqCount || 0}, SC: ${qg.scCount || 0}, Missing: ${(qg.missing || []).length}, Condition mismatches: ${(qg.conditionMismatches || []).length} |`);
  }
  if (checks.qualityProfiles) {
    const qp = checks.qualityProfiles;
    lines.push(`| Quality Profiles | ${statusIcon(qp.status)} ${qp.status} | SQ: ${qp.sqCount || 0}, SC: ${qp.scCount || 0}, Missing: ${(qp.missing || []).length}, Rule count mismatches: ${(qp.ruleCountMismatches || []).length} |`);
  }
  if (checks.groups) {
    const g = checks.groups;
    lines.push(`| Groups | ${statusIcon(g.status)} ${g.status} | SQ: ${g.sqCount || 0} custom, SC: ${g.scCount || 0}, Missing: ${(g.missing || []).length} |`);
  }
  if (checks.globalPermissions) {
    const p = checks.globalPermissions;
    lines.push(`| Global Permissions | ${statusIcon(p.status)} ${p.status} | ${(p.mismatches || []).length} groups with missing permissions |`);
  }
  if (checks.permissionTemplates) {
    const t = checks.permissionTemplates;
    lines.push(`| Permission Templates | ${statusIcon(t.status)} ${t.status} | SQ: ${t.sqCount || 0}, SC: ${t.scCount || 0}, Missing: ${(t.missing || []).length} |`);
  }
}
