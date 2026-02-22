import test from 'ava';
import logger from '../../src/utils/logger.js';

test('logger is a winston logger instance', t => {
  t.truthy(logger);
  t.is(typeof logger.info, 'function');
  t.is(typeof logger.error, 'function');
  t.is(typeof logger.warn, 'function');
  t.is(typeof logger.debug, 'function');
});

test('logger has console transport', t => {
  const consoleTransport = logger.transports.find(
    tr => tr.constructor.name === 'Console'
  );
  t.truthy(consoleTransport);
});

test('logger can log messages without throwing', t => {
  t.notThrows(() => logger.info('test info message'));
  t.notThrows(() => logger.debug('test debug message'));
  t.notThrows(() => logger.warn('test warn message'));
  t.notThrows(() => logger.error('test error message'));
});

test('logger formats error with stack trace', t => {
  const err = new Error('test stack error');
  t.notThrows(() => logger.error(err.message, { stack: err.stack }));
});

// --- enableFileLogging tests ---
import { enableFileLogging } from '../../src/utils/logger.js';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

test.serial('enableFileLogging creates log directory and adds file transport', t => {
  const logsDir = join(process.cwd(), 'migration-output', 'logs');

  // Remove logs dir if it exists so we exercise the mkdir path (lines 56-57)
  if (existsSync(logsDir)) {
    rmSync(logsDir, { recursive: true });
  }

  const initialTransportCount = logger.transports.length;
  const logFilePath = enableFileLogging('test-cmd');

  t.truthy(logFilePath);
  t.true(typeof logFilePath === 'string');
  t.true(logFilePath.includes('cloudvoyager-test-cmd-'));
  t.true(logFilePath.endsWith('.log'));
  t.true(existsSync(logsDir));
  t.true(logger.transports.length > initialTransportCount);

  // Clean up: remove the transport we just added
  const addedTransport = logger.transports.find(
    tr => tr.constructor.name === 'File' && tr.filename === logFilePath
  );
  if (addedTransport) logger.remove(addedTransport);
});

test.serial('enableFileLogging with custom command name prefix', t => {
  const logFilePath = enableFileLogging('migrate');

  t.true(logFilePath.includes('cloudvoyager-migrate-'));
  t.true(logFilePath.endsWith('.log'));

  // Clean up: remove the transport we just added
  const addedTransport = logger.transports.find(
    tr => tr.constructor.name === 'File' && tr.filename === logFilePath
  );
  if (addedTransport) logger.remove(addedTransport);
});
