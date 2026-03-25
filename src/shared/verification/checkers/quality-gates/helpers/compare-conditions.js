// -------- Compare Gate Conditions --------

/** Compare quality gate conditions between SQ and SC. */
export function compareConditions(sqConditions, scConditions) {
  const mismatches = [];
  const scCondMap = new Map(scConditions.map(c => [c.metric, c]));
  const sqCondMap = new Map(sqConditions.map(c => [c.metric, c]));

  for (const sqCond of sqConditions) {
    const scCond = scCondMap.get(sqCond.metric);
    if (!scCond) { mismatches.push({ metric: sqCond.metric, type: 'missing', sqValue: sqCond.error }); continue; }
    if (sqCond.op !== scCond.op || sqCond.error !== scCond.error) {
      mismatches.push({
        metric: sqCond.metric, type: 'value_mismatch',
        sqOp: sqCond.op, sqValue: sqCond.error, scOp: scCond.op, scValue: scCond.error,
      });
    }
  }

  for (const scCond of scConditions) {
    if (!sqCondMap.has(scCond.metric)) {
      mismatches.push({ metric: scCond.metric, type: 'extra', scValue: scCond.error });
    }
  }

  return mismatches;
}
