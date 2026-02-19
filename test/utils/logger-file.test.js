/**
 * Test logger with LOG_FILE env var set.
 * This must be in a separate file so the module-level LOG_FILE check executes.
 */
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';

// Set LOG_FILE BEFORE importing logger
const logFile = join(tmpdir(), `cv-log-${randomUUID()}.log`);
process.env.LOG_FILE = logFile;

// Dynamic import so LOG_FILE is set when module loads
const { default: logger } = await import('../../src/utils/logger.js');

// Now import ava
const { default: test } = await import('ava');

test('logger has file transport when LOG_FILE is set', t => {
  const hasFileTransport = logger.transports.some(
    tr => tr.constructor.name === 'File'
  );
  t.true(hasFileTransport);
});

test('logger writes to file', async t => {
  logger.info('file transport test message');
  // Give winston time to flush
  await new Promise(resolve => setTimeout(resolve, 200));
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(logFile, 'utf-8');
  t.true(content.includes('file transport test message'));
});

test.after.always(async () => {
  delete process.env.LOG_FILE;
  await unlink(logFile).catch(() => {});
});
