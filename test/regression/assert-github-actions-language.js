#!/usr/bin/env node
import { SqcClient } from './helpers/sqc-client.js';
import { pass, fail, exitWithResults, parseArgs } from './helpers/assert-utils.js';

const args = parseArgs();
const client = await SqcClient.fromConfig(args.config);
const targetKey = process.env.SQC_TARGET_KEY;

const projectExists = await client.getProjectExists(targetKey);
if (!projectExists) {
  fail('#88', `Project ${targetKey} does not exist in SonarCloud.`);
  exitWithResults();
}
pass('#88', `Project ${targetKey} exists in SonarCloud.`);

const issueCount = await client.getIssueCount(targetKey);
if (issueCount === 0) {
  fail('#88', `No issues found in ${targetKey}. GitHub Actions language issues may not have migrated.`);
  exitWithResults();
}
pass('#88', `Total issues: ${issueCount}.`);

const ghActionsIssues = await client.searchIssues(targetKey, {
  languages: 'github-actions',
  ps: 1
});
if (ghActionsIssues.total === 0) {
  const allLanguages = await client.searchIssues(targetKey, { ps: 1, facets: 'languages' });
  const langFacet = allLanguages.facets?.find(f => f.property === 'languages');
  const languages = langFacet?.values?.map(v => `${v.val}(${v.count})`).join(', ') || 'unknown';
  fail('#88', `No GitHub Actions language issues found. Available languages: ${languages}. The language filter may be broken or the source project has no GHA issues.`);
} else {
  pass('#88', `GitHub Actions language issues found: ${ghActionsIssues.total}.`);
}

exitWithResults();
