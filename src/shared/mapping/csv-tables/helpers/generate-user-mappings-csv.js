// -------- Generate User Mappings CSV --------
import { toCsvRow } from './csv-utils.js';

export function generateUserMappingsCsv(data) {
  const { assigneeCounts, assigneeDetails } = data;
  const rows = [toCsvRow(['Include', 'SonarQube Login', 'SonarCloud Login', 'Display Name', 'Email', 'Issue Count'])];
  if (assigneeCounts) {
    const sorted = [...assigneeCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [login, count] of sorted) {
      const details = assigneeDetails?.get(login) || { name: '', email: '' };
      rows.push(toCsvRow(['yes', login, '', details.name, details.email, count]));
    }
  }
  return rows.join('\n') + '\n';
}
