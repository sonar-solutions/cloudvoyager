// -------- Filter Non-Main Branches --------

/** Filter branches to only non-main, non-excluded, optionally included. */
export function filterNonMainBranches(allBranches, excludeBranches, includeBranches) {
  return allBranches.filter(b => {
    if (b.isMain) return false;
    if (excludeBranches.has(b.name)) return false;
    if (includeBranches && !includeBranches.has(b.name)) return false;
    return true;
  });
}
