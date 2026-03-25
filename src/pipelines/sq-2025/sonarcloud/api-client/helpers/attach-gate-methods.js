import * as qg from '../../api/quality-gates.js';

// -------- Attach Quality Gate Delegation Methods --------

/** Attach quality gate API methods to the client instance. */
export function attachGateMethods(inst, client, org) {
  inst.createQualityGate = (n) => qg.createQualityGate(client, org, n);
  inst.createQualityGateCondition = (g, m, o, e) => qg.createQualityGateCondition(client, org, g, m, o, e);
  inst.setDefaultQualityGate = (id) => qg.setDefaultQualityGate(client, org, id);
  inst.assignQualityGateToProject = (g, pk) => qg.assignQualityGateToProject(client, org, g, pk);
}
