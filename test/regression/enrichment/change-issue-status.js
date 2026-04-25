#!/usr/bin/env node
import { readConfig, getSqUrl, getSqToken } from '../helpers/config-reader.js';

const TRANSITIONS = [
  { transition: 'confirm', expectedStatus: 'CONFIRMED', expectedResolution: null },
  { transition: 'resolve', expectedStatus: 'RESOLVED', expectedResolution: 'FIXED' },
  { transition: 'falsepositive', expectedStatus: 'RESOLVED', expectedResolution: 'FALSE-POSITIVE' }
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

  console.log(`Changing issue statuses in project ${projectKey} on ${baseUrl}`);

  const issues = await sqGet(baseUrl, token, '/api/issues/search', {
    componentKeys: projectKey,
    ps: '10',
    statuses: 'OPEN'
  });

  if (!issues.issues?.length) {
    throw new Error(`No OPEN issues found in project ${projectKey}. Enrichment cannot proceed.`);
  }

  let changed = 0;
  for (let i = 0; i < Math.min(issues.issues.length, TRANSITIONS.length); i++) {
    const issue = issues.issues[i];
    const { transition, expectedStatus, expectedResolution } = TRANSITIONS[i];

    await sqApi(baseUrl, token, '/api/issues/do_transition', {
      issue: issue.key,
      transition
    });
    changed++;

    const verify = await sqGet(baseUrl, token, '/api/issues/search', { issues: issue.key });
    const actual = verify.issues?.[0];
    if (actual?.status !== expectedStatus) {
      throw new Error(`Verification failed: issue ${issue.key} expected status ${expectedStatus}, got ${actual?.status}`);
    }
    if (expectedResolution && actual?.resolution !== expectedResolution) {
      throw new Error(`Verification failed: issue ${issue.key} expected resolution ${expectedResolution}, got ${actual?.resolution}`);
    }
    console.log(`  Transitioned issue ${issue.key}: ${transition} → ${actual.status}/${actual.resolution || 'none'} (verified)`);
  }

  console.log(`Done: ${changed} issue status changes applied and verified.`);
}

main().catch(err => {
  console.error(`ENRICHMENT FAILED: ${err.message}`);
  process.exit(1);
});
