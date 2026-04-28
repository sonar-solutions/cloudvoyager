import { Worker } from 'node:worker_threads';
import logger from '../../logger.js';
import { createProgressLogger } from './create-progress-logger.js';

// -------- Parallel Issue Sync --------

const WORKER_CODE = `
'use strict';
const { parentPort, workerData } = require('worker_threads');
const https = require('https');
const http = require('http');

const { chunk, scConfig, sqConfig, userMappings, changelogEntries, concurrencyPerWorker } = workerData;

function makePost(baseURL, token, path, params) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseURL);
    for (const [k, v] of Object.entries(params)) {
      if (v != null) url.searchParams.set(k, v);
    }
    const mod = url.protocol === 'https:' ? https : http;
    const auth = Buffer.from(token + ':').toString('base64');
    const req = mod.request(url, {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' },
      timeout: 60000,
    }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else reject(new Error('HTTP ' + res.statusCode + ': ' + body.slice(0, 200)));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

async function makePostWithRetry(baseURL, token, path, params, maxRetries) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await makePost(baseURL, token, path, params);
    } catch (err) {
      const msg = err.message || '';
      const is429 = msg.startsWith('HTTP 429');
      const is5xx = /^HTTP 5\\d\\d/.test(msg);
      const isTransient = msg.includes('ECONNRESET') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('timeout') || msg.includes('socket hang up');
      const isRetryable = is429 || is5xx || isTransient;
      if (!isRetryable || attempt === maxRetries) throw err;
      const baseDelay = Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * baseDelay * 0.5;
      await new Promise(r => setTimeout(r, baseDelay + jitter));
    }
  }
}

function scPost(path, params) {
  return makePostWithRetry(scConfig.baseURL, scConfig.token, path, params, 6);
}

function mapChangelogDiffToTransition(diffs) {
  const statusDiff = diffs.find(d => d.key === 'status');
  const resolutionDiff = diffs.find(d => d.key === 'resolution');
  const newStatus = statusDiff && statusDiff.newValue;
  const newResolution = resolutionDiff && resolutionDiff.newValue;
  if (!newStatus) return null;
  if (newResolution === 'FALSE-POSITIVE' || newStatus === 'FALSE-POSITIVE') return 'falsepositive';
  if (newResolution === 'WONTFIX' || newStatus === 'WONTFIX') return 'wontfix';
  switch (newStatus) {
    case 'CONFIRMED': return 'confirm';
    case 'REOPENED': return 'reopen';
    case 'OPEN': return 'unconfirm';
    case 'RESOLVED': return 'resolve';
    case 'CLOSED': return 'resolve';
    case 'ACCEPTED': return 'wontfix';
    default: return null;
  }
}

function extractTransitionsFromChangelog(changelog) {
  const transitions = [];
  for (const entry of changelog) {
    const diffs = entry.diffs || [];
    if (!diffs.some(d => d.key === 'status')) continue;
    const t = mapChangelogDiffToTransition(diffs);
    if (t) transitions.push(t);
  }
  return transitions;
}

function getFallbackTransition(sqIssue) {
  if (sqIssue.resolution === 'FALSE-POSITIVE' || sqIssue.status === 'FALSE-POSITIVE') return 'falsepositive';
  if (sqIssue.resolution === 'WONTFIX' || sqIssue.status === 'WONTFIX') return 'wontfix';
  switch (sqIssue.status) {
    case 'CONFIRMED': return 'confirm';
    case 'RESOLVED':
    case 'CLOSED': return 'resolve';
    case 'ACCEPTED': return 'wontfix';
    case 'REOPENED': return 'reopen';
    default: return null;
  }
}

async function syncIssueStatus(scIssue, sqIssue, changelog) {
  if (scIssue.status === sqIssue.status) return false;

  if (changelog) {
    const transitions = extractTransitionsFromChangelog(changelog);
    if (transitions.length === 0) {
      const t = getFallbackTransition(sqIssue);
      if (!t) return false;
      try { await scPost('/api/issues/do_transition', { issue: scIssue.key, transition: t }); return true; }
      catch { return false; }
    }
    let applied = false;
    for (const transition of transitions) {
      try { await scPost('/api/issues/do_transition', { issue: scIssue.key, transition }); applied = true; }
      catch { /* expected: some transitions are invalid for current state */ }
    }
    return applied;
  }

  const t = getFallbackTransition(sqIssue);
  if (!t) return false;
  try { await scPost('/api/issues/do_transition', { issue: scIssue.key, transition: t }); return true; }
  catch { return false; }
}

async function syncIssueAssignment(sqIssue, scIssue, userMappingsMap, stats) {
  if (!sqIssue.assignee || sqIssue.assignee === scIssue.assignee) return;
  const mapping = userMappingsMap.get(sqIssue.assignee);
  if (mapping && !mapping.include) { stats.assignmentSkipped++; return; }
  const targetAssignee = (mapping && mapping.scLogin) || sqIssue.assignee;
  if (mapping && mapping.scLogin) stats.assignmentMapped++;
  try {
    await scPost('/api/issues/assign', { issue: scIssue.key, assignee: targetAssignee });
    stats.assigned++;
  } catch (err) {
    stats.assignmentFailed++;
    stats.failedAssignments.push({ issueKey: scIssue.key, assignee: targetAssignee, sqAssignee: sqIssue.assignee, error: err.message });
  }
}

async function syncIssueComments(sqIssue, scIssue, stats) {
  const comments = sqIssue.comments || [];
  for (const comment of comments) {
    try {
      const text = '[Migrated from SonarQube] ' + (comment.login || 'unknown') + ' (' + (comment.createdAt || '') + '): ' + (comment.markdown || comment.htmlText || '');
      await scPost('/api/issues/add_comment', { issue: scIssue.key, text });
      stats.commented++;
    } catch { stats.apiErrors++; }
  }
}

async function syncIssueTags(sqIssue, scIssue, stats) {
  try {
    const sqTags = sqIssue.tags || [];
    const baseTags = sqTags.length > 0 ? sqTags : (scIssue.tags || []);
    if (!baseTags.includes('metadata-synchronized')) {
      const updatedTags = [...new Set([...baseTags, 'metadata-synchronized'])];
      await scPost('/api/issues/set_tags', { issue: scIssue.key, tags: updatedTags.join(',') });
      if (sqTags.length > 0) stats.tagged++;
      stats.metadataSyncTagged++;
    } else if (sqTags.length > 0) {
      await scPost('/api/issues/set_tags', { issue: scIssue.key, tags: sqTags.join(',') });
      stats.tagged++;
    }
  } catch { stats.apiErrors++; }
}

async function addSourceLink(sqIssue, scIssue, stats) {
  if (!sqConfig || !sqConfig.baseURL || !sqConfig.projectKey) return;
  try {
    const sqUrl = sqConfig.baseURL + '/project/issues?id=' + encodeURIComponent(sqConfig.projectKey) + '&issues=' + encodeURIComponent(sqIssue.key) + '&open=' + encodeURIComponent(sqIssue.key);
    await scPost('/api/issues/add_comment', { issue: scIssue.key, text: '[SonarQube Source] Original issue: ' + sqUrl });
    stats.sourceLinked++;
  } catch { stats.apiErrors++; }
}

async function syncOneIssue(pair, userMappingsMap, stats, changelogMap) {
  try {
    const { sqIssue, scIssue } = pair;
    const changelog = changelogMap.get(sqIssue.key) || null;
    const transitioned = await syncIssueStatus(scIssue, sqIssue, changelog);
    if (transitioned) stats.transitioned++;
    await syncIssueAssignment(sqIssue, scIssue, userMappingsMap, stats);
    await syncIssueComments(sqIssue, scIssue, stats);
    await syncIssueTags(sqIssue, scIssue, stats);
    await addSourceLink(sqIssue, scIssue, stats);
  } catch {
    stats.failed++;
  }
}

async function mapConcurrentWorker(items, fn, concurrency) {
  let idx = 0;
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push((async () => {
      while (idx < items.length) {
        const current = idx++;
        if (current < items.length) await fn(items[current]);
      }
    })());
  }
  await Promise.all(workers);
}

async function run() {
  const stats = {
    matched: chunk.length, transitioned: 0, assigned: 0, assignmentMapped: 0,
    assignmentFailed: 0, assignmentSkipped: 0, commented: 0, tagged: 0,
    metadataSyncTagged: 0, sourceLinked: 0, failed: 0, apiErrors: 0, failedAssignments: [],
  };

  const userMappingsMap = new Map(userMappings || []);
  const changelogMap = new Map(changelogEntries || []);
  let completed = 0;

  await mapConcurrentWorker(chunk, async (pair) => {
    await syncOneIssue(pair, userMappingsMap, stats, changelogMap);
    completed++;
    if (completed % 50 === 0) parentPort.postMessage({ type: 'progress', completed });
  }, concurrencyPerWorker);

  parentPort.postMessage({ type: 'done', stats });
}

run().catch((err) => {
  parentPort.postMessage({ type: 'error', message: err.message });
});
`;

export async function parallelSyncIssues(matchedPairs, changelogMap, scConfig, sqConfig, userMappings, options = {}) {
  const workerCount = options.workerCount || 20;
  const concurrencyPerWorker = options.concurrencyPerWorker || 5;
  const totalPairs = matchedPairs.length;

  logger.info(`Parallel issue sync: ${totalPairs} pairs across ${workerCount} workers (${concurrencyPerWorker} concurrency each, ${workerCount * concurrencyPerWorker} total concurrent requests)`);

  const chunks = partitionRoundRobin(matchedPairs, workerCount);
  const serializedUserMappings = userMappings ? [...userMappings.entries()] : [];
  const onProgress = createProgressLogger('Issue sync', totalPairs);

  let totalCompleted = 0;
  const workerPromises = chunks.map((chunk, i) => {
    const changelogEntries = [];
    for (const pair of chunk) {
      const entry = changelogMap.get(pair.sqIssue.key);
      if (entry) changelogEntries.push([pair.sqIssue.key, entry]);
    }

    return new Promise((resolve, reject) => {
      const worker = new Worker(WORKER_CODE, {
        eval: true,
        workerData: {
          chunk,
          scConfig,
          sqConfig,
          userMappings: serializedUserMappings,
          changelogEntries,
          concurrencyPerWorker,
        },
      });

      worker.on('message', (msg) => {
        if (msg.type === 'progress') {
          totalCompleted += msg.completed - (worker._lastReported || 0);
          worker._lastReported = msg.completed;
          onProgress(totalCompleted);
        } else if (msg.type === 'done') {
          resolve(msg.stats);
        } else if (msg.type === 'error') {
          reject(new Error(`Worker ${i} failed: ${msg.message}`));
        }
      });

      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker ${i} exited with code ${code}`));
      });
    });
  });

  const allStats = await Promise.all(workerPromises);
  const merged = mergeStats(allStats);
  if (merged.apiErrors > 0) {
    logger.warn(`Parallel issue sync: ${merged.apiErrors} API calls failed after retries (tags/comments/source-links may be incomplete)`);
  }
  return merged;
}

function partitionRoundRobin(items, n) {
  const chunks = Array.from({ length: n }, () => []);
  for (let i = 0; i < items.length; i++) {
    chunks[i % n].push(items[i]);
  }
  return chunks.filter(c => c.length > 0);
}

function mergeStats(statsArray) {
  const merged = {
    matched: 0, transitioned: 0, assigned: 0, assignmentMapped: 0,
    assignmentFailed: 0, assignmentSkipped: 0, commented: 0, tagged: 0,
    metadataSyncTagged: 0, sourceLinked: 0, failed: 0, apiErrors: 0, failedAssignments: [],
  };
  for (const s of statsArray) {
    merged.matched += s.matched || 0;
    merged.transitioned += s.transitioned || 0;
    merged.assigned += s.assigned || 0;
    merged.assignmentMapped += s.assignmentMapped || 0;
    merged.assignmentFailed += s.assignmentFailed || 0;
    merged.assignmentSkipped += s.assignmentSkipped || 0;
    merged.commented += s.commented || 0;
    merged.tagged += s.tagged || 0;
    merged.metadataSyncTagged += s.metadataSyncTagged || 0;
    merged.sourceLinked += s.sourceLinked || 0;
    merged.failed += s.failed || 0;
    merged.apiErrors += s.apiErrors || 0;
    merged.failedAssignments.push(...(s.failedAssignments || []));
  }
  return merged;
}
