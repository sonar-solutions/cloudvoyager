// -------- Compare Branches --------

/**
 * Compare SQ and SC branch lists, accounting for default branch name differences.
 * @returns {{ missing: string[], extra: string[] }}
 */
export function compareBranches(sqBranches, scBranches) {
  const sqDefault = sqBranches.find(b => b.isMain)?.name || null;
  const scDefault = scBranches.find(b => b.isMain)?.name || null;
  const sqNames = new Set(sqBranches.map(b => b.name));
  const scNames = new Set(scBranches.map(b => b.name));

  const missing = [];
  for (const name of sqNames) {
    if (scNames.has(name)) continue;
    if (name === sqDefault && scDefault && !sqNames.has(scDefault)) continue;
    missing.push(name);
  }

  const extra = [];
  for (const name of scNames) {
    if (sqNames.has(name)) continue;
    if (name === scDefault && sqDefault && !scNames.has(sqDefault)) continue;
    extra.push(name);
  }

  return { missing, extra, sqCount: sqNames.size, scCount: scNames.size };
}
