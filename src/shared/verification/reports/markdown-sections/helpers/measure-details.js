// -------- Measure Detail Sections --------

/**
 * Format measure-related detail sections.
 * @param {object} c - Project checks object
 * @param {string[]} lines - Array to push lines into
 */
export function formatMeasureDetails(c, lines) {
  if (c.measures?.mismatches?.length > 0) {
    lines.push(`<details><summary>Measure Mismatches (${c.measures.mismatches.length})</summary>\n`);
    lines.push(`| Metric | SQ Value | SC Value | Delta |`);
    lines.push(`|--------|----------|----------|-------|`);
    for (const m of c.measures.mismatches) {
      const sqNum = parseFloat(m.sqValue);
      const scNum = parseFloat(m.scValue);
      let deltaStr = 'N/A';
      if (!isNaN(sqNum) && !isNaN(scNum)) {
        const delta = scNum - sqNum;
        deltaStr = delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`);
      }
      lines.push(`| ${m.metric} | ${m.sqValue} | ${m.scValue} | ${deltaStr} |`);
    }
    lines.push('\n</details>\n');
  }

  if (c.measures?.sqOnly?.length > 0) {
    lines.push(`<details><summary>Measures Only in SonarQube (${c.measures.sqOnly.length})</summary>\n`);
    lines.push(`| Metric | SQ Value |`);
    lines.push(`|--------|----------|`);
    for (const m of c.measures.sqOnly) lines.push(`| ${m.metric} | ${m.sqValue} |`);
    lines.push('\n</details>\n');
  }

  if (c.measures?.scOnly?.length > 0) {
    lines.push(`<details><summary>Measures Only in SonarCloud (${c.measures.scOnly.length})</summary>\n`);
    lines.push(`| Metric | SC Value |`);
    lines.push(`|--------|----------|`);
    for (const m of c.measures.scOnly) lines.push(`| ${m.metric} | ${m.scValue} |`);
    lines.push('\n</details>\n');
  }
}
