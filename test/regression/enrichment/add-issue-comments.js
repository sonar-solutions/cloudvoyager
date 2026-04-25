#!/usr/bin/env node
import { readConfig, getSqUrl, getSqToken } from '../helpers/config-reader.js';

const SQ_COMMENTS = [
  'Migration test: this issue was reviewed by the security team.',
  'Migration test: false positive confirmed, marking as won\'t fix.',
  'Migration test: assigned to platform-team for Q2 sprint.'
];

async function sqApi(baseUrl, token, path, params) {
  const url = new URL(`${baseUrl}${path}`);
  const body = new URLSearchParams(params);
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`SQ API ${response.status} on ${path}: ${text}`);
  }
  return response.json().catch(() => ({}));
}

async function sqGet(baseUrl, token, path, params = {}) {
  const url = new URL(`${baseUrl}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url.toString(), {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`SQ API GET ${response.status} on ${path}: ${text}`);
  }
  return response.json();
}

async function main() {
  const configPath = process.argv[2] || undefined;
  const config = await readConfig(configPath);
  const baseUrl = getSqUrl(config).replace(/\/$/, '');
  const token = getSqToken(config);

  const projectKey = process.env.SQ_PROJECT_KEY || 'angular';

  console.log(`Adding issue comments to project ${projectKey} on ${baseUrl}`);

  const issues = await sqGet(baseUrl, token, '/api/issues/search', {
    componentKeys: projectKey,
    ps: '10',
    statuses: 'OPEN,CONFIRMED'
  });

  if (!issues.issues?.length) {
    throw new Error(`No issues found in project ${projectKey}. Enrichment cannot proceed.`);
  }

  let added = 0;
  for (const issue of issues.issues.slice(0, 5)) {
    const comment = SQ_COMMENTS[added % SQ_COMMENTS.length];
    await sqApi(baseUrl, token, '/api/issues/add_comment', {
      issue: issue.key,
      text: comment
    });
    added++;

    const verify = await sqGet(baseUrl, token, '/api/issues/search', {
      issues: issue.key,
      additionalFields: 'comments'
    });
    const hasComment = verify.issues?.[0]?.comments?.some(c => c.markdown === comment);
    if (!hasComment) {
      throw new Error(`Verification failed: comment not found on issue ${issue.key}`);
    }
    console.log(`  Added comment to issue ${issue.key} (verified)`);
  }

  console.log(`Done: ${added} comments added and verified.`);
}

main().catch(err => {
  console.error(`ENRICHMENT FAILED: ${err.message}`);
  process.exit(1);
});
