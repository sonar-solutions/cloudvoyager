import test from 'ava';
import logger from '../../src/shared/utils/logger.js';

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
import { enableFileLogging } from '../../src/shared/utils/logger.js';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

test.serial('enableFileLogging creates log directory and adds 3 file transports', t => {
  const logsDir = join(process.cwd(), 'migration-output', 'logs');

  if (existsSync(logsDir)) {
    rmSync(logsDir, { recursive: true });
  }

  const initialTransportCount = logger.transports.length;
  const result = enableFileLogging('test-cmd');

  t.truthy(result);
  t.true(typeof result === 'object');
  t.true(result.rawLogPath.includes('cloudvoyager-test-cmd-'));
  t.true(result.rawLogPath.endsWith('.log'));
  t.true(result.infoLogPath.endsWith('.info.log'));
  t.true(result.warnLogPath.endsWith('.warn.log'));
  t.true(result.errorLogPath.endsWith('.error.log'));
  t.true(existsSync(logsDir));
  t.is(logger.transports.length, initialTransportCount + 4);

  const fileTransports = logger.transports.filter(tr => tr.constructor.name === 'File');
  for (const ft of fileTransports) logger.remove(ft);
});

test.serial('enableFileLogging with custom command name prefix', t => {
  const result = enableFileLogging('migrate');

  t.true(result.rawLogPath.includes('cloudvoyager-migrate-'));
  t.true(result.rawLogPath.endsWith('.log'));
  t.true(result.infoLogPath.includes('cloudvoyager-migrate-'));
  t.true(result.warnLogPath.includes('cloudvoyager-migrate-'));
  t.true(result.errorLogPath.includes('cloudvoyager-migrate-'));

  const fileTransports = logger.transports.filter(tr => tr.constructor.name === 'File');
  for (const ft of fileTransports) logger.remove(ft);
});
