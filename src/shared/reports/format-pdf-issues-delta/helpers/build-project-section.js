import { buildIssueTable } from './build-issue-table.js';
import { buildRuleTable } from './build-rule-table.js';

// -------- Build Project Section --------

/** Build a PDF section for a single project's issues delta. */
export function buildProjectSection(project) {
  const nodes = [
    { text: `${project.sqProjectKey} → ${project.scProjectKey}`, style: 'heading' },
    { text: `SonarQube: ${project.sqIssueCount} issues | SonarCloud: ${project.scIssueCount} issues`, style: 'metadata' },
    ...buildIssueTable(project.onlyInSQ, 'Disappeared — in SonarQube, not in SonarCloud'),
    ...buildIssueTable(project.onlyInSC, 'Appeared — in SonarCloud, not in SonarQube'),
    ...buildRuleTable(project.byRule),
  ];

  if (project.onlyInSQ.length === 0 && project.onlyInSC.length === 0) {
    nodes.push({ text: 'Issues match perfectly — no differences.', style: 'metadata', color: '#2e7d32' });
  }

  return nodes;
}
