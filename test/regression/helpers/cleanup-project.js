#!/usr/bin/env node
import { SqcClient } from './sqc-client.js';

const targetKey = process.argv[2];
if (!targetKey) { console.error('Usage: cleanup-project.js <projectKey>'); process.exit(1); }

const client = await SqcClient.fromConfig();
const result = await client.deleteProject(targetKey);
console.log('Cleanup:', result.deleted ? 'deleted' : 'not found (OK for first run)');
