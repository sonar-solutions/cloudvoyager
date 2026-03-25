// -------- Format Org Results --------
import { formatStepLine } from './step-helpers.js';

export function formatOrgResults(lines, results, subsep) {
  for (const org of (results.orgResults || [])) {
    lines.push(`ORGANIZATION: ${org.key} (${org.projectCount} projects)`, subsep);
    for (const step of (org.steps || [])) {
      formatStepLine(lines, step);
    }
    lines.push('');
  }
}
