#!/usr/bin/env node
import { SqcClient } from './helpers/sqc-client.js';
import { pass, fail, exitWithResults, parseArgs } from './helpers/assert-utils.js';

const args = parseArgs();
const client = await SqcClient.fromConfig(args.config);
const targetKey = process.env.SQC_TARGET_KEY;

const projectExists = await client.getProjectExists(targetKey);
if (!projectExists) {
  fail('#91', `Project ${targetKey} does not exist in SonarCloud. First migration did not create it.`);
  exitWithResults();
}
pass('#91', `Project ${targetKey} exists in SonarCloud after first migration.`);

const issueCount = await client.getIssueCount(targetKey);
if (issueCount === 0) {
  fail('#91', `No issues found in ${targetKey} after first migration. Issue sync did not trigger on first run.`);
} else {
  pass('#91', `Issue count after first migration: ${issueCount}. Issue sync triggered correctly.`);
}

const hotspotCount = await client.getHotspotCount(targetKey);
pass('#91', `Hotspot count after first migration: ${hotspotCount}.`);

const profiles = await client.getQualityProfiles(targetKey);
if (profiles.length === 0) {
  fail('#91', `No quality profiles associated with ${targetKey}. Profile migration may have failed.`);
} else {
  pass('#91', `Quality profiles: ${profiles.length} associated.`);
}

exitWithResults();
