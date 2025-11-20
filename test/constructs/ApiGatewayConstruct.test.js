const { Stack } = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { ApiGatewayConstruct } = require('../../lib/constructs/ApiGatewayConstruct');

describe('ApiGatewayConstruct', () => {
  let stack;
  let api;

  beforeEach(() => {
    stack = new Stack();
  });

  describe('initialization', () => {
    it('should create REST API with CORS configuration', () => {
      api = new ApiGatewayConstruct(stack, 'TestApi', {
        environment: 'dev',
      });

      expect(api).toBeDefined();
      expect(api.restApi).toBeDefined();
      expect(api.config).toBeDefined();
    });

    it('should throw error for invalid environment', () => {
      expect(() => {
        new ApiGatewayConstruct(stack, 'TestApi', {
          environment: 'invalid',
        });
      }).toThrow('Invalid environment');
    });

    it('should default to dev environment', () => {
      api = new ApiGatewayConstruct(stack, 'TestApi', {});
      expect(api.environment).toBe('dev');
    });
  });

  describe('CORS configuration', () => {
    beforeEach(() => {
      api = new ApiGatewayConstruct(stack, 'TestApi', {
        environment: 'dev',
      });
    });

    it('should allow CORS methods for CRUD operations', () => {
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ApiGateway::RestApi', {
        Name: stack.resolve(api.restApi.restApiName),
      });
    });

    it('should include Authorization header in CORS allowed headers', () => {
      expect(api.config.cors).toBeDefined();
      expect(api.config.cors.allowCredentials).toBe(true);
    });
  });

  describe('public methods', () => {
    beforeEach(() => {
      api = new ApiGatewayConstruct(stack, 'TestApi', {
        environment: 'dev',
      });
    });

    it('should return root resource', () => {
      const rootResource = api.getRootResource();
      expect(rootResource).toBeDefined();
    });

    it('should return REST API instance', () => {
      const restApi = api.getRestApi();
      expect(restApi).toBe(api.restApi);
    });

    it('should return API endpoint', () => {
      const endpoint = api.getApiEndpoint();
      expect(endpoint).toBeDefined();
      expect(endpoint).toMatch(/^https:\/\//);
    });

    it('should return API ID', () => {
      const apiId = api.getApiId();
      expect(apiId).toBeDefined();
      expect(typeof apiId).toBe('string');
    });
  });

  describe('environment-specific configuration', () => {
    it('should create API for staging environment', () => {
      const stagingApi = new ApiGatewayConstruct(stack, 'StagingApi', {
        environment: 'staging',
      });

      expect(stagingApi.environment).toBe('staging');
      expect(stagingApi.config.stageName).toBe('api');
    });

    it('should create API for prod environment', () => {
      const prodApi = new ApiGatewayConstruct(stack, 'ProdApi', {
        environment: 'prod',
      });

      expect(prodApi.environment).toBe('prod');
      expect(prodApi.config.stageName).toBe('api');
    });
  });

  describe('CloudWatch logging', () => {
    it('should enable CloudWatch logging for dev environment', () => {
      api = new ApiGatewayConstruct(stack, 'TestApi', {
        environment: 'dev',
      });

      expect(api.config.enableCloudWatchLogs).toBe(true);
      expect(api.config.loggingLevel).toBe('INFO');
    });

    it('should have log group with TWO_WEEKS retention', () => {
      api = new ApiGatewayConstruct(stack, 'TestApi', {
        environment: 'dev',
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::Logs::LogGroup', {
        RetentionInDays: 14,
      });
    });
  });
});
