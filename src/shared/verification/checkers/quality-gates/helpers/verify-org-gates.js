// -------- Verify Org Quality Gates --------

import logger from '../../../../utils/logger.js';
import { compareConditions } from './compare-conditions.js';

/** Verify quality gates between SonarQube and SonarCloud at the org level. */
export async function verifyQualityGates(sqClient, scClient) {
  const result = { status: 'pass', sqCount: 0, scCount: 0, missing: [], conditionMismatches: [], details: [] };

  const sqGates = (await sqClient.getQualityGates()).qualitygates || [];
  const scGates = (await scClient.listQualityGates()).qualitygates || [];
  result.sqCount = sqGates.length;
  result.scCount = scGates.length;

  const scGateByName = new Map(scGates.map(g => [g.name, g]));

  for (const sqGate of sqGates) {
    const scGate = scGateByName.get(sqGate.name);
    if (!scGate) { result.missing.push(sqGate.name); continue; }

    const isBuiltIn = sqGate.isBuiltIn || sqGate.name.startsWith('Sonar way');
    if (isBuiltIn) {
      result.details.push({ name: sqGate.name, sqConditionCount: null, scConditionCount: null, conditionMismatchCount: 0, status: 'pass', note: 'built-in gate — condition comparison skipped' });
      continue;
    }

    const [sqConds, scConds] = await Promise.all([
      sqClient.getQualityGateDetails(sqGate.name).then(d => d.conditions || []).catch(e => { logger.debug(`Failed to get SQ gate details for ${sqGate.name}: ${e.message}`); return []; }),
      scClient.getQualityGateDetails(scGate.id).then(d => d.conditions || []).catch(e => { logger.debug(`Failed to get SC gate details for ${scGate.name}: ${e.message}`); return []; }),
    ]);

    const condMismatches = compareConditions(sqConds, scConds);
    if (condMismatches.length > 0) result.conditionMismatches.push({ gateName: sqGate.name, mismatches: condMismatches });
    result.details.push({ name: sqGate.name, sqConditionCount: sqConds.length, scConditionCount: scConds.length, conditionMismatchCount: condMismatches.length, status: condMismatches.length === 0 ? 'pass' : 'fail' });
  }

  if (result.missing.length > 0 || result.conditionMismatches.length > 0) result.status = 'fail';
  logger.info(`Quality gate verification: SQ=${result.sqCount}, SC=${result.scCount}, missing=${result.missing.length}`);
  return result;
}
