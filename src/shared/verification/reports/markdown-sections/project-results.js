import { formatDetailSections } from './detail-sections.js';

/**
 * Format all per-project check results as markdown.
 * @param {object} results - Full verification results
 * @param {function} statusIcon - Status icon helper
 * @returns {string} Formatted markdown string
 */
export function formatProjectResults(results, statusIcon) {
  if (results.projectResults.length === 0) return '';

  const lines = ['## Per-Project Checks\n'];

  for (const project of results.projectResults) {
    const checks = Object.values(project.checks || {});
    const fails = checks.filter(c => c.status === 'fail').length;
    const icon = fails === 0 ? statusIcon('pass') : statusIcon('fail');

    lines.push(`### ${icon} ${project.sqProjectKey} → ${project.scProjectKey}\n`);

    const c = project.checks;

    // Summary table
    lines.push(`| Check | Status | Details |`);
    lines.push(`|-------|--------|---------|`);

    if (c.existence) {
      lines.push(`| Project exists | ${statusIcon(c.existence.status)} ${c.existence.status} | |`);
    }
    if (c.branches) {
      lines.push(`| Branches | ${statusIcon(c.branches.status)} ${c.branches.status} | SQ: ${c.branches.sqCount}, SC: ${c.branches.scCount}, Missing: ${(c.branches.missing || []).length} |`);
    }
    if (c.issues) {
      const iss = c.issues;
      lines.push(`| Issues | ${statusIcon(iss.status)} ${iss.status} | SQ: ${iss.sqCount}, SC: ${iss.scCount}, Matched: ${iss.matched}, Unmatched: ${iss.unmatched} |`);
    }
    if (c.hotspots) {
      const hs = c.hotspots;
      lines.push(`| Hotspots | ${statusIcon(hs.status)} ${hs.status} | SQ: ${hs.sqCount}, SC: ${hs.scCount}, Matched: ${hs.matched}, Unmatched: ${hs.unmatched} |`);
    }
    if (c.measures) {
      lines.push(`| Measures | ${statusIcon(c.measures.status)} ${c.measures.status} | ${c.measures.compared || 0} compared, ${(c.measures.mismatches || []).length} mismatches |`);
    }
    if (c.qualityGate) {
      lines.push(`| Quality Gate | ${statusIcon(c.qualityGate.status)} ${c.qualityGate.status} | SQ: ${c.qualityGate.sqGate || 'none'}, SC: ${c.qualityGate.scGate || 'none'} |`);
    }
    if (c.qualityProfiles) {
      lines.push(`| Quality Profiles | ${statusIcon(c.qualityProfiles.status)} ${c.qualityProfiles.status} | ${(c.qualityProfiles.mismatches || []).length} mismatches |`);
    }
    if (c.settings) {
      lines.push(`| Settings | ${statusIcon(c.settings.status)} ${c.settings.status} | ${(c.settings.mismatches || []).length} mismatches, ${(c.settings.sqOnly || []).length} SQ-only |`);
    }
    if (c.tags) {
      lines.push(`| Tags | ${statusIcon(c.tags.status)} ${c.tags.status} | Missing: ${(c.tags.missing || []).length}, Extra: ${(c.tags.extra || []).length} |`);
    }
    if (c.links) {
      lines.push(`| Links | ${statusIcon(c.links.status)} ${c.links.status} | SQ: ${c.links.sqCount || 0}, SC: ${c.links.scCount || 0}, Missing: ${(c.links.missing || []).length} |`);
    }
    if (c.newCodePeriods) {
      lines.push(`| New Code Periods | ${statusIcon(c.newCodePeriods.status)} ${c.newCodePeriods.status} | SQ: ${c.newCodePeriods.details?.sqProjectLevel || 'default'}, SC: ${c.newCodePeriods.details?.scProjectLevel || 'default'} |`);
    }
    if (c.devopsBinding) {
      lines.push(`| DevOps Binding | ${statusIcon(c.devopsBinding.status)} ${c.devopsBinding.status} | |`);
    }
    if (c.permissions) {
      lines.push(`| Permissions | ${statusIcon(c.permissions.status)} ${c.permissions.status} | ${(c.permissions.mismatches || []).length} groups with missing permissions |`);
    }

    lines.push('');

    // Detail sections (issues, measures, hotspots, branches, settings, permissions)
    formatDetailSections(c, lines);
  }

  return lines.join('\n');
}
