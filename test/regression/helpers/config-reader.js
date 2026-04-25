import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function readConfig(configPath) {
  const fullPath = configPath || resolve(process.cwd(), 'migrate-config.json');
  const raw = await readFile(fullPath, 'utf-8');
  return JSON.parse(raw);
}

export function getSqcUrl(config) {
  return config.sonarcloud?.organizations?.[0]?.url || 'https://sonarcloud.io';
}

export function getSqcToken(config) {
  return config.sonarcloud?.organizations?.[0]?.token;
}

export function getSqcOrgKey(config) {
  return config.sonarcloud?.organizations?.[0]?.key;
}

export function getSqUrl(config) {
  return config.sonarqube?.url;
}

export function getSqToken(config) {
  return config.sonarqube?.token;
}
