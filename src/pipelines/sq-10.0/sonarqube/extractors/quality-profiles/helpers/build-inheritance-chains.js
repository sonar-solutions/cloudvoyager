// -------- Build Inheritance Chains --------

export function buildInheritanceChains(profiles) {
  const byKey = new Map(profiles.map(p => [p.key, p]));
  const chains = [];
  const visited = new Set();

  for (const profile of profiles) {
    if (visited.has(profile.key)) continue;

    // Walk up to find the root
    const chain = [];
    let current = profile;
    while (current) {
      chain.unshift(current);
      visited.add(current.key);
      current = current.parentKey ? byKey.get(current.parentKey) : null;
    }

    if (chain.length > 1) {
      chains.push(chain);
    }
  }

  return chains;
}
