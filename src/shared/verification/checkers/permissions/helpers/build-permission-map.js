// -------- Build Permission Map --------

/** Build a Map of group name → permissions array. */
export function buildPermissionMap(groups) {
  const map = new Map();
  for (const group of groups) {
    map.set(group.name, group.permissions || []);
  }
  return map;
}
