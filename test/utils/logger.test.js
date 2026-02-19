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
