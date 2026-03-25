// -------- Classify Unmatched Hotspots --------

const MAX_UNMATCHED = 200;

/** Classify unmatched SQ hotspots: genuine mismatches vs rules not in SC. */
export function classifyUnmatchedSq(sqHotspots, matchedSqKeys, matchedRules, scRules, result) {
  let genuineUnmatched = 0;
  let ruleNotInSc = 0;
  for (const h of sqHotspots) {
    if (matchedSqKeys.has(h.key)) continue;
    const rule = h.ruleKey || h.securityCategory || '';
    if (!matchedRules.has(rule) && !scRules.has(rule)) { ruleNotInSc++; continue; }
    genuineUnmatched++;
    if (result.unmatchedSqHotspots.length >= MAX_UNMATCHED) continue;
    result.unmatchedSqHotspots.push({
      sqKey: h.key, rule, file: (h.component || '').split(':').pop(),
      line: h.line || 0, status: h.status || 'TO_REVIEW', message: (h.message || '').slice(0, 120),
    });
  }
  result.unmatched = genuineUnmatched;
  result.ruleNotInSc = ruleNotInSc;
}

/** Classify SC-only hotspots (unmatched SC with rules shared by both sides). */
export function classifyScOnly(scHotspotMap, matchedRules, sqRules, result) {
  const remaining = [];
  scHotspotMap.forEach(c => { for (const h of c) remaining.push(h); });
  for (const h of remaining) {
    const rule = h.ruleKey || h.rule?.key || h.securityCategory || '';
    if (!matchedRules.has(rule) && !sqRules.has(rule)) continue;
    if (result.scOnlyHotspots.length >= MAX_UNMATCHED) continue;
    result.scOnlyHotspots.push({
      scKey: h.key, rule, file: (h.component || '').split(':').pop(),
      line: h.line || 0, status: h.status || 'TO_REVIEW', message: (h.message || '').slice(0, 120),
    });
  }
}
