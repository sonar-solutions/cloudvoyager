// -------- Format Portfolios Section --------

/**
 * Format the portfolios section.
 * @param {object} results - Verification results
 * @returns {string}
 */
export function formatPortfolios(results) {
  if (!results.portfolios || results.portfolios.sqCount === 0) return '';

  const lines = ['## Portfolios\n'];
  lines.push(`Status: ${results.portfolios.status} — ${results.portfolios.details}\n`);
  if (results.portfolios.sqPortfolios?.length > 0) {
    lines.push(`SonarQube portfolios (${results.portfolios.sqCount}):`);
    for (const p of results.portfolios.sqPortfolios) {
      lines.push(`- ${p.name} (\`${p.key}\`)`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
