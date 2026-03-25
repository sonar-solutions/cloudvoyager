// -------- Format Missing Items --------

/**
 * Append missing quality gates and profiles info.
 */
export function formatMissingItems(checks, lines) {
  if (checks.qualityGates?.missing?.length > 0) {
    lines.push(`**Missing quality gates:** ${checks.qualityGates.missing.join(', ')}\n`);
  }
  if (checks.qualityProfiles?.missing?.length > 0) {
    lines.push(`**Missing quality profiles:**`);
    for (const m of checks.qualityProfiles.missing) {
      lines.push(`- ${m.name} (${m.language})`);
    }
    lines.push('');
  }
}
