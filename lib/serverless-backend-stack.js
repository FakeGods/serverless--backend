const { Stack, CfnOutput } = require('aws-cdk-lib');
const { ApiGatewayConstruct } = require('./constructs/ApiGatewayConstruct');
const { CognitoAuthorizerConstruct } = require('./constructs/CognitoAuthorizerConstruct');

/**
 * Serverless Backend Stack
 *
 * Main infrastructure stack that orchestrates the deployment of serverless backend services.
 * Includes API Gateway with CORS configuration and Cognito authorization.
 *
 * Usage:
 * new ServerlessBackendStack(app, 'ServerlessBackendStack', {
 *   env: { account: '123456789012', region: 'eu-central-1' },
 *   cognitoUserPoolArn: 'arn:aws:cognito-idp:...',
 * });
 */
class ServerlessBackendStack extends Stack {
  /**
   * @param {Construct} scope - Parent construct (App)
   * @param {string} id - Stack identifier
   * @param {StackProps} props - Stack configuration
   * @param {string} props.cognitoUserPoolArn - ARN of existing Cognito User Pool
   * @param {string} [props.environment] - Environment name (dev, staging, prod)
   */
  constructor(scope, id, props) {
    super(scope, id, props);
    this._validateProps(props);

    this.cognitoUserPoolArn = props.cognitoUserPoolArn;

    // Create API Gateway with CORS
    this.api = new ApiGatewayConstruct(this, 'Api', {
      environment: props.environment || 'dev',
      description: 'Serverless Backend REST API',
    });

    // Attach Cognito authorizer
    this.cognitoAuthorizer = new CognitoAuthorizerConstruct(
      this,
      'CognitoAuthorizer',
      {
        restApi: this.api.getRestApi(),
        userPoolArn: this.cognitoUserPoolArn,
      }
    );

    // Export outputs
    this._createStackOutputs();
  }

  /**
   * Creates stack outputs for cross-stack references
   * @private
   */
  _createStackOutputs() {
    new CfnOutput(this, 'ApiEndpoint', {
      value: this.api.getApiEndpoint(),
      description: 'API Gateway endpoint URL',
      exportName: `${this.stackName}-ApiEndpoint`,
    });

    new CfnOutput(this, 'ApiId', {
      value: this.api.getApiId(),
      description: 'API Gateway ID',
      exportName: `${this.stackName}-ApiId`,
    });

    new CfnOutput(this, 'CognitoAuthorizerId', {
      value: this.cognitoAuthorizer.getAuthorizerId(),
      description: 'Cognito Authorizer ID',
      exportName: `${this.stackName}-AuthorizerId`,
    });

    new CfnOutput(this, 'UserPoolArn', {
      value: this.cognitoUserPoolArn,
      description: 'Cognito User Pool ARN',
      exportName: `${this.stackName}-UserPoolArn`,
    });
  }

  /**
   * Validates required properties
   * @private
   * @param {Object} props - Properties to validate
   */
  _validateProps(props) {
    if (!props) {
      throw new Error('ServerlessBackendStack requires props parameter');
    }

    if (!props.cognitoUserPoolArn) {
      throw new Error(
        'ServerlessBackendStack requires cognitoUserPoolArn property. ' +
        'Provide the ARN of your existing Cognito User Pool.'
      );
    }
  }
}

module.exports = { ServerlessBackendStack };
