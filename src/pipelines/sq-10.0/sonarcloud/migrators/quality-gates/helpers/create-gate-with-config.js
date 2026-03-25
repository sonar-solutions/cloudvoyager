// -------- Create Gate With Config --------

import { createGateConditions } from './create-gate-conditions.js';
import { setGateDefault } from './set-gate-default.js';
import { setGatePermissions } from './set-gate-permissions.js';

export async function createGateWithConfig(gate, client) {
  const created = await client.createQualityGate(gate.name);
  const scGateId = created.id;

  await createGateConditions(scGateId, gate, client);
  await setGateDefault(scGateId, gate, client);
  await setGatePermissions(gate, client);

  return scGateId;
}
