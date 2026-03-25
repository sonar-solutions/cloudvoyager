// -------- Main Logic --------

/**
 * Filter branches to only include non-main branches that are not excluded.
 *
 * @param {Array} allBranches - All branches from SonarQube
 * @param {Set<string>} excludeBranches - Branch names to exclude
 * @param {Set<string>|null} includeBranches - If set, only include these branches
 * @returns {Array} Filtered non-main branches
 */
export function filterNonMainBranches(allBranches, excludeBranches, includeBranches) {
  return allBranches.filter(b => {
    if (b.isMain) return false;
    if (excludeBranches.has(b.name)) return false;
    if (includeBranches && !includeBranches.has(b.name)) return false;
    return true;
  });
}
