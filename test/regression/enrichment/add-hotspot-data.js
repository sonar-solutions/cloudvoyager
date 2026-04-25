#!/usr/bin/env node
import { readConfig, getSqUrl, getSqToken } from '../helpers/config-reader.js';

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

  console.log(`Adding hotspot data to project ${projectKey} on ${baseUrl}`);

  const hotspots = await sqGet(baseUrl, token, '/api/hotspots/search', {
    projectKey,
    ps: '10'
  });

  const requireHotspots = process.env.REQUIRE_HOTSPOTS === 'true';
  if (!hotspots.hotspots?.length) {
    if (requireHotspots) {
      throw new Error(`No hotspots found in project ${projectKey} but REQUIRE_HOTSPOTS=true. Enrichment cannot proceed.`);
    }
    console.log('No hotspots found. Skipping hotspot enrichment (set REQUIRE_HOTSPOTS=true to fail on this).');
    return;
  }

  let enriched = 0;
  for (const hotspot of hotspots.hotspots.slice(0, 3)) {
    await sqApi(baseUrl, token, '/api/hotspots/add_comment', {
      hotspot: hotspot.key,
      comment: 'Migration test: reviewed by security team, safe to use.'
    });

    await sqApi(baseUrl, token, '/api/hotspots/change_status', {
      hotspot: hotspot.key,
      status: 'REVIEWED',
      resolution: 'SAFE'
    });
    enriched++;

    const verify = await sqGet(baseUrl, token, '/api/hotspots/show', { hotspot: hotspot.key });
    if (verify.status !== 'REVIEWED') {
      throw new Error(`Verification failed: hotspot ${hotspot.key} expected status REVIEWED, got ${verify.status}`);
    }
    const hasComment = verify.comment?.some?.(c => c.markdown?.includes('Migration test')) ||
                       verify.comments?.some?.(c => c.htmlText?.includes('Migration test')) ||
                       verify.comment?.length > 0;
    if (!hasComment) {
      console.warn(`  WARNING: Could not verify comment on hotspot ${hotspot.key} (comment field format may vary by SQ version)`);
    }
    console.log(`  Enriched hotspot ${hotspot.key}: status REVIEWED (verified), comment added`);
  }

  console.log(`Done: ${enriched} hotspots enriched and verified.`);
}

main().catch(err => {
  console.error(`ENRICHMENT FAILED: ${err.message}`);
  process.exit(1);
});
