#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const [targetKey, sqUrl, sqToken] = process.argv.slice(2);
if (!targetKey) { console.error('Usage: patch-config.js <targetKey> [sqUrl] [sqToken]'); process.exit(1); }

const config = JSON.parse(await readFile('migrate-config.json', 'utf-8'));
config.transfer = config.transfer || {};
config.transfer.targetProjectKey = targetKey;
if (sqUrl) config.sonarqube.url = sqUrl;
if (sqToken) config.sonarqube.token = sqToken;
await writeFile('migrate-config.json', JSON.stringify(config, null, 2));
console.log(`Config patched: target=${targetKey} sq=${config.sonarqube.url}`);
