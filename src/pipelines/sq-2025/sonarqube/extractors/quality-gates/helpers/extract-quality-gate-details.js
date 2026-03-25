// -------- Extract Quality Gate Details --------

/** Extract full details (conditions + permissions) for a single quality gate. */
export async function extractQualityGateDetails(client, gate) {
  const details = await client.getQualityGateDetails(gate.name);
  const permissions = await client.getQualityGatePermissions(gate.name);

  return {
    name: gate.name,
    isDefault: gate.isDefault || false,
    isBuiltIn: gate.isBuiltIn || false,
    conditions: (details.conditions || []).map(c => ({
      id: c.id,
      metric: c.metric,
      op: c.op,
      error: c.error
    })),
    permissions
  };
}
