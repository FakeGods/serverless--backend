/**
 * API Gateway Constants
 * Shared constants for CORS, authorizer, and logging configuration
 */

// CORS Configuration
const CORS_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'];
const CORS_EXPOSED_HEADERS = ['x-amzn-RequestId'];
const CORS_MAX_AGE_SECONDS = 600;

// API Gateway Configuration
const API_STAGE_NAME = 'api';
const API_THROTTLE_RATE_LIMIT = 10000;
const API_THROTTLE_BURST_LIMIT = 5000;
const API_LOG_LEVEL = 'INFO';
const API_LOG_DATA_FULLY = false;

// Cognito Authorizer Configuration
const COGNITO_AUTHORIZER_NAME = 'CognitoAuthorizer';
const COGNITO_AUTHORIZER_IDENTITY_SOURCE = 'method.request.header.Authorization';
const COGNITO_AUTHORIZER_VALIDATION_REGEX = '^[a-zA-Z0-9\-._~+/]+=*$';
const COGNITO_AUTHORIZER_CACHE_TTL = 300; // 5 minutes

module.exports = {
  CORS_ALLOWED_METHODS,
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
  CORS_MAX_AGE_SECONDS,
  API_STAGE_NAME,
  API_THROTTLE_RATE_LIMIT,
  API_THROTTLE_BURST_LIMIT,
  API_LOG_LEVEL,
  API_LOG_DATA_FULLY,
  COGNITO_AUTHORIZER_NAME,
  COGNITO_AUTHORIZER_IDENTITY_SOURCE,
  COGNITO_AUTHORIZER_VALIDATION_REGEX,
  COGNITO_AUTHORIZER_CACHE_TTL,
};
