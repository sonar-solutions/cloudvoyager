// -------- Generate Gate Mappings CSV --------
import { toCsvRow } from './csv-utils.js';

export function generateGateMappingsCsv(data) {
  const { resourceMappings } = data;
  const rows = [toCsvRow(['Include', 'Gate Name', 'Is Default', 'Is Built-In', 'Conditions Count', 'Target Organization'])];
  if (resourceMappings?.gatesByOrg) {
    for (const [orgKey, gates] of resourceMappings.gatesByOrg) {
      for (const gate of gates) {
        rows.push(toCsvRow(['yes', gate.name, gate.isDefault, gate.isBuiltIn, gate.conditions?.length || 0, orgKey]));
      }
    }
  }
  return rows.join('\n') + '\n';
}
