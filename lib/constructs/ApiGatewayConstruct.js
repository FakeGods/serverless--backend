const { Construct } = require('constructs');
const {
  RestApi,
  EndpointType,
  MethodLoggingLevel,
} = require('aws-cdk-lib/aws-apigateway');
const { LogGroup, RetentionDays } = require('aws-cdk-lib/aws-logs');
const {
  CORS_ALLOWED_METHODS,
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
  CORS_MAX_AGE_SECONDS,
  API_STAGE_NAME,
  API_THROTTLE_RATE_LIMIT,
  API_THROTTLE_BURST_LIMIT,
  API_LOG_LEVEL,
  API_LOG_DATA_FULLY,
} = require('../constants/apiConstants');
const { getApiConfig } = require('../config/apiConfig');

/**
 * API Gateway REST API Construct
 *
 * Creates a REST API with standard CORS configuration for CRUD operations
 * and support for authorization headers. Includes CloudWatch logging and
 * throttling settings.
 *
 * Usage:
 * const api = new ApiGatewayConstruct(stack, 'ServerlessApi', {
 *   environment: 'dev',
 *   description: 'Main API for serverless backend',
 * });
 */
class ApiGatewayConstruct extends Construct {
  /**
   * @param {Construct} scope - Parent construct
   * @param {string} id - Logical ID
   * @param {Object} props - Configuration
   * @param {string} props.environment - Environment name (dev, staging, prod)
   * @param {string} props.description - API description
   */
  constructor(scope, id, props = {}) {
    super(scope, id);
    this._validateProps(props);

    this.environment = props.environment || 'dev';
    this.config = getApiConfig(this.environment);

    this.restApi = this._createRestApi(props.description);
    this._configureLogging();
  }

  /**
   * Creates the REST API with CORS configuration
   * @private
   * @param {string} description - API description
   * @returns {RestApi} Configured REST API
   */
  _createRestApi(description) {
    return new RestApi(this, 'RestApi', {
      description: description || `Serverless Backend API (${this.environment})`,
      endpointTypes: [EndpointType.REGIONAL],
      defaultCorsPreflightOptions: {
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: CORS_ALLOWED_HEADERS,
        allowCredentials: this.config.cors.allowCredentials,
        allowOrigins: this.config.cors.allowOrigins,
        exposeHeaders: CORS_EXPOSED_HEADERS,
        maxAge: require('aws-cdk-lib').Duration.seconds(CORS_MAX_AGE_SECONDS),
      },
      deployOptions: {
        stageName: 'api',
        throttleSettings: {
          rateLimit: this.config.throttleSettings.rateLimit,
          burstLimit: this.config.throttleSettings.burstLimit,
        },
        loggingLevel: this.config.enableCloudWatchLogs
          ? MethodLoggingLevel.INFO
          : MethodLoggingLevel.OFF,
        dataTraceEnabled: API_LOG_DATA_FULLY,
        tracingEnabled: false,
      },
    });
  }

  /**
   * Configures CloudWatch logging for the API
   * @private
   */
  _configureLogging() {
    if (!this.config.enableCloudWatchLogs) {
      return;
    }

    new LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/aws/apigateway/${this.restApi.restApiId}`,
      retention: RetentionDays.TWO_WEEKS,
    });
  }

  /**
   * Validates required properties
   * @private
   * @param {Object} props - Properties to validate
   */
  _validateProps(props) {
    if (props.environment && !['dev', 'staging', 'prod'].includes(props.environment)) {
      throw new Error(
        `Invalid environment: ${props.environment}. Must be: dev, staging, or prod`
      );
    }
  }

  /**
   * Get the root resource for adding routes
   * @returns {IResource} Root resource
   */
  getRootResource() {
    return this.restApi.root;
  }

  /**
   * Get the REST API instance
   * @returns {RestApi} REST API
   */
  getRestApi() {
    return this.restApi;
  }

  /**
   * Get the API endpoint URL
   * @returns {string} API endpoint URL
   */
  getApiEndpoint() {
    return this.restApi.url;
  }

  /**
   * Get the API ID
   * @returns {string} API ID
   */
  getApiId() {
    return this.restApi.restApiId;
  }
}

module.exports = { ApiGatewayConstruct };
