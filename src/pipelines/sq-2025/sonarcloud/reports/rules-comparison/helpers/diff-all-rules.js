// -------- Diff All Rules --------

/** Format a rule for the comparison report. */
function formatRule(rule) {
  return {
    key: rule.key,
    name: rule.name || '',
    type: rule.type || '',
    severity: rule.severity || '',
    lang: rule.lang || rule.langName || '',
  };
}

/** Compare all rules between SQ and SC by rule key (e.g. css:S4655). */
export function diffAllRules(sqRules, scRules) {
  const sqMap = new Map(sqRules.map(r => [r.key, r]));
  const scMap = new Map(scRules.map(r => [r.key, r]));

  const onlyInSQ = [];
  let inBothCount = 0;
  for (const [key, rule] of sqMap) {
    if (scMap.has(key)) inBothCount++;
    else onlyInSQ.push(formatRule(rule));
  }

  const onlyInSC = [];
  for (const [key, rule] of scMap) {
    if (!sqMap.has(key)) onlyInSC.push(formatRule(rule));
  }

  onlyInSQ.sort((a, b) => a.key.localeCompare(b.key));
  onlyInSC.sort((a, b) => a.key.localeCompare(b.key));

  return { onlyInSQ, onlyInSC, inBothCount };
}
