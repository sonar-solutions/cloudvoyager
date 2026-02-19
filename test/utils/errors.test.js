import test from 'ava';
import {
  CloudVoyagerError,
  ConfigurationError,
  SonarQubeAPIError,
  SonarCloudAPIError,
  AuthenticationError,
  ProtobufEncodingError,
  StateError,
  ValidationError
} from '../../src/utils/errors.js';

// CloudVoyagerError
test('CloudVoyagerError sets message and default statusCode', t => {
  const err = new CloudVoyagerError('test error');
  t.is(err.message, 'test error');
  t.is(err.statusCode, 500);
  t.is(err.name, 'CloudVoyagerError');
  t.true(err instanceof Error);
  t.truthy(err.stack);
});

test('CloudVoyagerError accepts custom statusCode', t => {
  const err = new CloudVoyagerError('test', 404);
  t.is(err.statusCode, 404);
});

// ConfigurationError
test('ConfigurationError has statusCode 400', t => {
  const err = new ConfigurationError('bad config');
  t.is(err.message, 'bad config');
  t.is(err.statusCode, 400);
  t.is(err.name, 'ConfigurationError');
  t.true(err instanceof CloudVoyagerError);
  t.true(err instanceof Error);
});

// SonarQubeAPIError
test('SonarQubeAPIError has default statusCode and null endpoint', t => {
  const err = new SonarQubeAPIError('sq error');
  t.is(err.message, 'sq error');
  t.is(err.statusCode, 500);
  t.is(err.endpoint, null);
  t.is(err.name, 'SonarQubeAPIError');
  t.true(err instanceof CloudVoyagerError);
});

test('SonarQubeAPIError accepts custom statusCode and endpoint', t => {
  const err = new SonarQubeAPIError('sq error', 404, '/api/test');
  t.is(err.statusCode, 404);
  t.is(err.endpoint, '/api/test');
});

// SonarCloudAPIError
test('SonarCloudAPIError has default statusCode and null endpoint', t => {
  const err = new SonarCloudAPIError('sc error');
  t.is(err.message, 'sc error');
  t.is(err.statusCode, 500);
  t.is(err.endpoint, null);
  t.is(err.name, 'SonarCloudAPIError');
  t.true(err instanceof CloudVoyagerError);
});

test('SonarCloudAPIError accepts custom statusCode and endpoint', t => {
  const err = new SonarCloudAPIError('sc error', 403, '/api/sc');
  t.is(err.statusCode, 403);
  t.is(err.endpoint, '/api/sc');
});

// AuthenticationError
test('AuthenticationError has statusCode 401 and default service', t => {
  const err = new AuthenticationError('auth failed');
  t.is(err.message, 'auth failed');
  t.is(err.statusCode, 401);
  t.is(err.service, 'Unknown');
  t.is(err.name, 'AuthenticationError');
  t.true(err instanceof CloudVoyagerError);
});

test('AuthenticationError accepts custom service', t => {
  const err = new AuthenticationError('auth failed', 'SonarQube');
  t.is(err.service, 'SonarQube');
});

// ProtobufEncodingError
test('ProtobufEncodingError has statusCode 500 and null data by default', t => {
  const err = new ProtobufEncodingError('encode failed');
  t.is(err.message, 'encode failed');
  t.is(err.statusCode, 500);
  t.is(err.data, null);
  t.is(err.name, 'ProtobufEncodingError');
  t.true(err instanceof CloudVoyagerError);
});

test('ProtobufEncodingError accepts custom data', t => {
  const data = { field: 'value' };
  const err = new ProtobufEncodingError('encode failed', data);
  t.deepEqual(err.data, data);
});

// StateError
test('StateError has statusCode 500', t => {
  const err = new StateError('state error');
  t.is(err.message, 'state error');
  t.is(err.statusCode, 500);
  t.is(err.name, 'StateError');
  t.true(err instanceof CloudVoyagerError);
});

// ValidationError
test('ValidationError has statusCode 400 and empty errors by default', t => {
  const err = new ValidationError('validation failed');
  t.is(err.message, 'validation failed');
  t.is(err.statusCode, 400);
  t.deepEqual(err.errors, []);
  t.is(err.name, 'ValidationError');
  t.true(err instanceof CloudVoyagerError);
});

test('ValidationError accepts custom errors array', t => {
  const errors = ['field1 is required', 'field2 must be string'];
  const err = new ValidationError('validation failed', errors);
  t.deepEqual(err.errors, errors);
});
