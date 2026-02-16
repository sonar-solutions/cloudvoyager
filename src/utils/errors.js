/**
 * Base error class for all application errors
 */
export class CloudVoyagerError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration validation error
 */
export class ConfigurationError extends CloudVoyagerError {
  constructor(message) {
    super(message, 400);
  }
}

/**
 * SonarQube API error
 */
export class SonarQubeAPIError extends CloudVoyagerError {
  constructor(message, statusCode = 500, endpoint = null) {
    super(message, statusCode);
    this.endpoint = endpoint;
  }
}

/**
 * SonarCloud API error
 */
export class SonarCloudAPIError extends CloudVoyagerError {
  constructor(message, statusCode = 500, endpoint = null) {
    super(message, statusCode);
    this.endpoint = endpoint;
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends CloudVoyagerError {
  constructor(message, service = 'Unknown') {
    super(message, 401);
    this.service = service;
  }
}

/**
 * Protobuf encoding error
 */
export class ProtobufEncodingError extends CloudVoyagerError {
  constructor(message, data = null) {
    super(message, 500);
    this.data = data;
  }
}

/**
 * State management error
 */
export class StateError extends CloudVoyagerError {
  constructor(message) {
    super(message, 500);
  }
}

/**
 * Validation error
 */
export class ValidationError extends CloudVoyagerError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}
