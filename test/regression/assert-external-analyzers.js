#!/usr/bin/env node
import { SqcClient } from './helpers/sqc-client.js';
import { pass, fail, exitWithResults, parseArgs } from './helpers/assert-utils.js';

const args = parseArgs();
const client = await SqcClient.fromConfig(args.config);
const targetKey = process.env.SQC_TARGET_KEY;

const projectExists = await client.getProjectExists(targetKey);
if (!projectExists) {
  fail('#56', `Project ${targetKey} does not exist in SonarCloud.`);
  exitWithResults();
}
pass('#56', `Project ${targetKey} exists in SonarCloud.`);

const issueCount = await client.getIssueCount(targetKey);
if (issueCount === 0) {
  fail('#56', `No issues found in ${targetKey}. External analyzer issues may not have migrated.`);
  exitWithResults();
}
pass('#56', `Total issues: ${issueCount}.`);

const rulesFacet = await client.searchIssues(targetKey, { ps: 1, facets: 'rules' });
const ruleFacetValues = rulesFacet?.facets?.find(f => f.property === 'rules')?.values ?? [];
const externalRules = ruleFacetValues.filter(v => v.val.startsWith('external_'));

if (externalRules.length === 0) {
  const allRuleNames = ruleFacetValues.slice(0, 10).map(v => v.val).join(', ');
  fail('#82', `No external analyzer rules (external_*) found in migrated issues. Top rules: ${allRuleNames}. Pylint/Ruff issues did not migrate.`);
} else {
  const ruleList = externalRules.map(r => `${r.val}(${r.count})`).join(', ');
  pass('#82', `External analyzer rules found: ${externalRules.length} rules. ${ruleList}.`);
}

exitWithResults();
