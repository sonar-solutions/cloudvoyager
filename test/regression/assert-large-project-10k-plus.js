#!/usr/bin/env node
import { SqcClient } from './helpers/sqc-client.js';
import { pass, fail, exitWithResults, parseArgs } from './helpers/assert-utils.js';

const MIN_EXPECTED_BUCKETS = 3;

const args = parseArgs();
const client = await SqcClient.fromConfig(args.config);
const targetKey = process.env.SQC_TARGET_KEY;

const projectExists = await client.getProjectExists(targetKey);
if (!projectExists) {
  fail('#53', `Project ${targetKey} does not exist in SonarCloud. Migration did not create it.`);
  exitWithResults();
}
pass('#53', `Project ${targetKey} exists in SonarCloud.`);

const issueCount = await client.getIssueCount(targetKey);
if (issueCount === undefined || issueCount === null) {
  fail('#94', `Issue count returned undefined/null. API response may be malformed.`);
  exitWithResults();
}
if (issueCount < 10000) {
  fail('#94', `Expected >10,000 issues, found ${issueCount}. The 10K issue limit may have regressed.`);
} else {
  pass('#94', `Issue count: ${issueCount} (>10,000 threshold met).`);
}

const { total, dateBuckets } = await client.getIssuesByCreationDate(targetKey);
if (!dateBuckets || dateBuckets.length === 0) {
  fail('#98', `No date bucket data returned from SQC API. The createdAt facet may not be available.`);
  exitWithResults();
}

const nonEmptyBuckets = dateBuckets.filter(b => b.count > 0);
if (nonEmptyBuckets.length < MIN_EXPECTED_BUCKETS) {
  fail('#98', `Issues distributed across only ${nonEmptyBuckets.length} date bucket(s). Expected at least ${MIN_EXPECTED_BUCKETS} (SCM date-bucket distribution). Total: ${total}.`);
} else {
  const maxBucket = Math.max(...nonEmptyBuckets.map(b => b.count));
  if (maxBucket > 10000) {
    fail('#98', `Largest date bucket has ${maxBucket} issues (>10K). SonarCloud UI will cap display. Buckets: ${nonEmptyBuckets.length}.`);
  } else {
    const bucketSummary = nonEmptyBuckets.map(b => `${b.val}:${b.count}`).join(', ');
    pass('#98', `Issues spread across ${nonEmptyBuckets.length} date buckets. Largest: ${maxBucket}. All within 10K cap. [${bucketSummary}]`);
  }
}

const hotspotCount = await client.getHotspotCount(targetKey);
if (hotspotCount === 0) {
  fail('#53-hotspots', `No hotspots found in ${targetKey}. Expected hotspot migration.`);
} else {
  pass('#53-hotspots', `Hotspot count: ${hotspotCount}.`);
}

exitWithResults();
