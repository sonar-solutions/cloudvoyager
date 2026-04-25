#!/usr/bin/env node
import { SqcClient } from './helpers/sqc-client.js';
import { pass, fail, exitWithResults, parseArgs } from './helpers/assert-utils.js';

const args = parseArgs();
const client = await SqcClient.fromConfig(args.config);
const targetKey = process.env.SQC_TARGET_KEY;

const projectExists = await client.getProjectExists(targetKey);
if (!projectExists) {
  fail('#15', `Project ${targetKey} does not exist in SonarCloud after kill-and-resume.`);
  exitWithResults();
}
pass('#15', `Project ${targetKey} exists in SonarCloud after kill-and-resume.`);

const totalIssues = await client.getIssueCount(targetKey);
if (totalIssues === 0) {
  fail('#57', `No issues found in ${targetKey} after kill-and-resume. Resume may not have completed the migration.`);
  exitWithResults();
}
pass('#57', `Issue count after kill-and-resume: ${totalIssues}. Migration completed after resume.`);

let allKeys = [];
let page = 1;
const pageSize = 500;
while (allKeys.length < totalIssues && page <= 100) {
  const batch = await client.searchIssues(targetKey, { ps: pageSize, p: page });
  if (!batch.issues?.length) break;
  allKeys.push(...batch.issues.map(i => i.key));
  page++;
}

const uniqueKeys = new Set(allKeys);
if (allKeys.length !== uniqueKeys.size) {
  const dupeCount = allKeys.length - uniqueKeys.size;
  fail('#15', `Duplicate issues detected: ${allKeys.length} total keys, ${uniqueKeys.size} unique. ${dupeCount} duplicates from kill-resume.`);
} else {
  pass('#15', `No duplicate issues across all ${allKeys.length} fetched keys (of ${totalIssues} total).`);
}

exitWithResults();
