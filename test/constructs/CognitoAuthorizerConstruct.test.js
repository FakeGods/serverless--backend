const { Stack } = require('aws-cdk-lib');
const { Template } = require('aws-cdk-lib/assertions');
const { RestApi } = require('aws-cdk-lib/aws-apigateway');
const { CognitoAuthorizerConstruct } = require('../../lib/constructs/CognitoAuthorizerConstruct');

describe('CognitoAuthorizerConstruct', () => {
  let stack;
  let restApi;
  let authorizer;

  beforeEach(() => {
    stack = new Stack();
    restApi = new RestApi(stack, 'TestRestApi', {
      restApiName: 'test-api',
    });
    // Add a method so the REST API is valid
    restApi.root.addMethod('GET');
  });

  const testArn = 'arn:aws:cognito-idp:eu-central-1:695438154048:userpool/eu-central-1_ZiNvpvV39';

  describe('initialization', () => {
    it('should create Cognito authorizer', () => {
      authorizer = new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
        restApi,
        userPoolArn: testArn,
      });

      expect(authorizer).toBeDefined();
      expect(authorizer.authorizer).toBeDefined();
    });

    it('should throw error if restApi is missing', () => {
      expect(() => {
        new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
          userPoolArn: testArn,
        });
      }).toThrow('requires restApi property');
    });

    it('should throw error if userPoolArn is missing', () => {
      expect(() => {
        new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
          restApi,
        });
      }).toThrow('requires userPoolArn property');
    });

    it('should throw error if ARN is invalid', () => {
      expect(() => {
        new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
          restApi,
          userPoolArn: 'invalid-arn',
        });
      }).toThrow('Invalid User Pool ARN');
    });
  });

  describe('ARN validation', () => {
    it('should accept valid ARN format', () => {
      expect(() => {
        authorizer = new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
          restApi,
          userPoolArn: testArn,
        });
      }).not.toThrow();
    });

    it('should accept uppercase letters in pool ID', () => {
      const arnWithUppercase = 'arn:aws:cognito-idp:eu-central-1:695438154048:userpool/eu-central-1_ZiNvpvV39';
      expect(() => {
        authorizer = new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
          restApi,
          userPoolArn: arnWithUppercase,
        });
      }).not.toThrow();
    });

    it('should reject ARN with invalid region', () => {
      const invalidArn = 'arn:aws:cognito-idp:INVALID:695438154048:userpool/pool-id';
      expect(() => {
        new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
          restApi,
          userPoolArn: invalidArn,
        });
      }).toThrow();
    });

    it('should reject ARN with invalid account ID', () => {
      const invalidArn = 'arn:aws:cognito-idp:eu-central-1:invalid:userpool/pool-id';
      expect(() => {
        new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
          restApi,
          userPoolArn: invalidArn,
        });
      }).toThrow();
    });
  });

  describe('public methods', () => {
    beforeEach(() => {
      authorizer = new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
        restApi,
        userPoolArn: testArn,
      });
    });

    it('should return authorizer ID', () => {
      const authorizerId = authorizer.getAuthorizerId();
      expect(authorizerId).toBeDefined();
    });

    it('should return User Pool ARN', () => {
      const arn = authorizer.getUserPoolArn();
      expect(arn).toBe(testArn);
    });
  });

  describe('ARN parsing', () => {
    it('should parse region from ARN', () => {
      authorizer = new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
        restApi,
        userPoolArn: testArn,
      });

      expect(authorizer.userPoolArn).toContain('eu-central-1');
    });

    it('should handle different regions', () => {
      const arnUsEast = 'arn:aws:cognito-idp:us-east-1:695438154048:userpool/us-east-1_abcdefg12';
      expect(() => {
        new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
          restApi,
          userPoolArn: arnUsEast,
        });
      }).not.toThrow();
    });

    it('should handle hyphenated pool IDs', () => {
      const arnWithHyphens = 'arn:aws:cognito-idp:eu-central-1:695438154048:userpool/eu-central-1_abc-def-123';
      expect(() => {
        new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
          restApi,
          userPoolArn: arnWithHyphens,
        });
      }).not.toThrow();
    });
  });

  describe('CloudFormation output', () => {
    beforeEach(() => {
      authorizer = new CognitoAuthorizerConstruct(stack, 'TestAuthorizer', {
        restApi,
        userPoolArn: testArn,
      });
    });

    it('should create CfnAuthorizer resource', () => {
      const template = Template.fromStack(stack);
      template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
        Type: 'COGNITO_USER_POOLS',
      });
    });

    it('should attach to REST API', () => {
      expect(authorizer.restApi).toBe(restApi);
    });
  });
});
