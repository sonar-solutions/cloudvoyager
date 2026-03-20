import logger from '../../utils/logger.js';

/**
 * Verify quality gates between SonarQube and SonarCloud at the org level.
 *
 * @param {object} sqClient - SonarQube client
 * @param {object} scClient - SonarCloud client
 * @returns {Promise<object>} Check result
 */
export async function verifyQualityGates(sqClient, scClient) {
  const result = {
    status: 'pass',
    sqCount: 0,
    scCount: 0,
    missing: [],
    conditionMismatches: [],
    details: []
  };

  // Fetch SQ gates
  const sqGatesData = await sqClient.getQualityGates();
  const sqGates = sqGatesData.qualitygates || [];
  result.sqCount = sqGates.length;

  // Fetch SC gates
  const scGatesData = await scClient.listQualityGates();
  const scGates = scGatesData.qualitygates || [];
  result.scCount = scGates.length;

  const scGateByName = new Map(scGates.map(g => [g.name, g]));

  for (const sqGate of sqGates) {
    const scGate = scGateByName.get(sqGate.name);
    if (!scGate) {
      result.missing.push(sqGate.name);
      continue;
    }

    // Built-in quality gates ("Sonar way", "Sonar way for AI Code", etc.)
    // may have different conditions between SQ and SC platform versions.
    // Skip detailed condition comparison for built-in gates.
    const isBuiltIn = sqGate.isBuiltIn || sqGate.name.startsWith('Sonar way');
    if (isBuiltIn) {
      result.details.push({
        name: sqGate.name,
        sqConditionCount: null,
        scConditionCount: null,
        conditionMismatchCount: 0,
        status: 'pass',
        note: 'built-in gate — condition comparison skipped'
      });
      continue;
    }

    // Compare conditions for custom gates (fetch SQ and SC details in parallel)
    const [sqConditions, scConditions] = await Promise.all([
      sqClient.getQualityGateDetails(sqGate.name)
        .then(d => d.conditions || [])
        .catch(error => { logger.debug(`Failed to get SQ gate details for ${sqGate.name}: ${error.message}`); return []; }),
      scClient.getQualityGateDetails(scGate.id)
        .then(d => d.conditions || [])
        .catch(error => { logger.debug(`Failed to get SC gate details for ${scGate.name}: ${error.message}`); return []; })
    ]);

    const conditionMismatches = compareConditions(sqConditions, scConditions);
    if (conditionMismatches.length > 0) {
      result.conditionMismatches.push({
        gateName: sqGate.name,
        mismatches: conditionMismatches
      });
    }

    result.details.push({
      name: sqGate.name,
      sqConditionCount: sqConditions.length,
      scConditionCount: scConditions.length,
      conditionMismatchCount: conditionMismatches.length,
      status: conditionMismatches.length === 0 ? 'pass' : 'fail'
    });
  }

  if (result.missing.length > 0 || result.conditionMismatches.length > 0) {
    result.status = 'fail';
  }

  logger.info(`Quality gate verification: SQ=${result.sqCount}, SC=${result.scCount}, missing=${result.missing.length}, condition mismatches=${result.conditionMismatches.length}`);
  return result;
}

/**
 * Verify quality gate assignment for a project.
 */
export async function verifyProjectQualityGate(sqClient, scClient, scProjectKey) {
  const result = { status: 'pass', sqGate: null, scGate: null };

  try {
    const sqGate = await sqClient.getQualityGate();
    result.sqGate = sqGate?.name || null;
  } catch (error) {
    logger.debug(`Failed to get SQ quality gate: ${error.message}`);
  }

  try {
    const scGate = await scClient.getQualityGateForProject(scProjectKey);
    result.scGate = scGate?.name || null;
  } catch (error) {
    logger.debug(`Failed to get SC quality gate: ${error.message}`);
  }

  if (result.sqGate && result.scGate && result.sqGate !== result.scGate) {
    result.status = 'fail';
  } else if (result.sqGate && !result.scGate) {
    result.status = 'fail';
  }

  return result;
}

function compareConditions(sqConditions, scConditions) {
  const mismatches = [];
  const scCondMap = new Map();
  for (const c of scConditions) {
    scCondMap.set(c.metric, c);
  }

  const sqCondMap = new Map();
  for (const c of sqConditions) {
    sqCondMap.set(c.metric, c);
  }

  for (const sqCond of sqConditions) {
    const scCond = scCondMap.get(sqCond.metric);
    if (!scCond) {
      mismatches.push({ metric: sqCond.metric, type: 'missing', sqValue: sqCond.error });
      continue;
    }
    if (sqCond.op !== scCond.op || sqCond.error !== scCond.error) {
      mismatches.push({
        metric: sqCond.metric,
        type: 'value_mismatch',
        sqOp: sqCond.op,
        sqValue: sqCond.error,
        scOp: scCond.op,
        scValue: scCond.error
      });
    }
  }

  // Check for extra conditions in SC that don't exist in SQ
  for (const scCond of scConditions) {
    if (!sqCondMap.has(scCond.metric)) {
      mismatches.push({ metric: scCond.metric, type: 'extra', scValue: scCond.error });
    }
  }

  return mismatches;
}
