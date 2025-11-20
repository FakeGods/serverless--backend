/**
 * API Gateway Configuration
 * Environment-specific settings for API Gateway and CORS
 */

const apiConfig = {
  dev: {
    stageName: 'api',
    enableCloudWatchLogs: false,
    loggingLevel: 'INFO',
    throttleSettings: {
      rateLimit: 10000,
      burstLimit: 5000,
    },
    cors: {
      allowOrigins: ['http://localhost:3000', 'http://localhost:3001'],
      allowCredentials: true,
    },
  },
  staging: {
    stageName: 'api',
    enableCloudWatchLogs: false,
    loggingLevel: 'INFO',
    throttleSettings: {
      rateLimit: 10000,
      burstLimit: 5000,
    },
    cors: {
      allowOrigins: ['https://staging.example.com'],
      allowCredentials: true,
    },
  },
  prod: {
    stageName: 'api',
    enableCloudWatchLogs: false,
    loggingLevel: 'WARN',
    throttleSettings: {
      rateLimit: 10000,
      burstLimit: 5000,
    },
    cors: {
      allowOrigins: ['https://example.com'],
      allowCredentials: true,
    },
  },
};

/**
 * Get API configuration for the specified environment
 * @param {string} environment - Environment name (dev, staging, prod)
 * @returns {Object} Configuration object
 * @throws {Error} If environment is not recognized
 */
function getApiConfig(environment = 'dev') {
  if (!apiConfig[environment]) {
    throw new Error(
      `Unknown environment: ${environment}. ` +
      `Supported environments: ${Object.keys(apiConfig).join(', ')}`
    );
  }
  return apiConfig[environment];
}

module.exports = { getApiConfig };
