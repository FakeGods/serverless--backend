const { Stack, CfnOutput } = require('aws-cdk-lib');
const { ApiGatewayConstruct } = require('./constructs/ApiGatewayConstruct');
const { CognitoAuthorizerConstruct } = require('./constructs/CognitoAuthorizerConstruct');
const { DynamoDBConstruct } = require('./constructs/DynamoDBConstruct');
const { MessagingConstruct } = require('./constructs/MessagingConstruct');
const { LambdaConstruct } = require('./constructs/LambdaConstruct');
const { LambdaIntegration } = require('aws-cdk-lib/aws-apigateway');
const { SqsEventSource } = require('aws-cdk-lib/aws-lambda-event-sources');

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
    const environment = props.environment || 'dev';
    const bedrockModelId = props.bedrockModelId || 'anthropic.claude-3-sonnet-20240229-v1:0';

    // Create DynamoDB table for recommendations
    this.dynamoDB = new DynamoDBConstruct(this, 'DynamoDB', {
      environment,
    });

    // Create SNS topic and SQS queue for async processing
    this.messaging = new MessagingConstruct(this, 'Messaging', {
      environment,
    });

    // Create Lambda functions
    this.lambdas = new LambdaConstruct(this, 'Lambdas', {
      environment,
      tableName: this.dynamoDB.getTableName(),
      topicArn: this.messaging.getTopicArn(),
      bedrockModelId,
    });

    // Configure SQS event source for processFeedback Lambda
    const sqsEventSource = new SqsEventSource(this.messaging.getQueue(), {
      batchSize: 10, // Process up to 10 messages at a time
      maxBatchingWindow: require('aws-cdk-lib').Duration.seconds(5),
    });
    this.lambdas.getProcessFeedbackFunction().addEventSource(sqsEventSource);

    // Grant permissions
    this._grantPermissions();

    // Create API Gateway with CORS
    this.api = new ApiGatewayConstruct(this, 'Api', {
      environment,
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

    // Create API Gateway endpoints
    this._createApiEndpoints();

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

    new CfnOutput(this, 'DynamoDBTableName', {
      value: this.dynamoDB.getTableName(),
      description: 'DynamoDB Recommendations Table Name',
      exportName: `${this.stackName}-TableName`,
    });

    new CfnOutput(this, 'DynamoDBTableArn', {
      value: this.dynamoDB.getTableArn(),
      description: 'DynamoDB Recommendations Table ARN',
      exportName: `${this.stackName}-TableArn`,
    });

    new CfnOutput(this, 'SNSTopicArn', {
      value: this.messaging.getTopicArn(),
      description: 'SNS Topic ARN for feedback processing',
      exportName: `${this.stackName}-TopicArn`,
    });

    new CfnOutput(this, 'SQSQueueUrl', {
      value: this.messaging.getQueueUrl(),
      description: 'SQS Queue URL for feedback processing',
      exportName: `${this.stackName}-QueueUrl`,
    });
  }

  /**
   * Grant IAM permissions to Lambda functions
   * @private
   */
  _grantPermissions() {
    // Grant DynamoDB read permissions to GET Lambda
    this.dynamoDB.grantRead(this.lambdas.getGetRecommendationsFunction());

    // Grant DynamoDB read/write permissions to DELETE Lambda
    this.dynamoDB.grantReadWrite(this.lambdas.getDeleteRecommendationsFunction());

    // Grant SNS publish permissions to POST feedback Lambda
    this.messaging.getTopic().grantPublish(this.lambdas.getPostFeedbackFunction());

    // Grant DynamoDB write and Bedrock invoke permissions to process feedback Lambda
    this.dynamoDB.grantReadWrite(this.lambdas.getProcessFeedbackFunction());
    
    // Grant Bedrock permissions
    this.lambdas.getProcessFeedbackFunction().addToRolePolicy(
      new (require('aws-cdk-lib/aws-iam').PolicyStatement)({
        effect: require('aws-cdk-lib/aws-iam').Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: ['*'], // Can be restricted to specific model ARNs
      })
    );

    // Grant DynamoDB read/write permissions to UPDATE Lambda
    this.dynamoDB.grantReadWrite(this.lambdas.getUpdateRecommendationFunction());

    // Grant DynamoDB read permissions to SEARCH Lambda
    this.dynamoDB.grantRead(this.lambdas.getSearchRecommendationsFunction());

    // SQS permissions are automatically granted by the SqsEventSource
  }

  /**
   * Create API Gateway endpoints
   * @private
   */
  _createApiEndpoints() {
    const restApi = this.api.getRestApi();
    const authorizerId = this.cognitoAuthorizer.getAuthorizerId();

    // Create /recommendations resource with CORS
    const recommendationsResource = restApi.root.addResource('recommendations', {
      defaultCorsPreflightOptions: {
        allowOrigins: require('aws-cdk-lib/aws-apigateway').Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'DELETE', 'PUT', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // GET /recommendations - Retrieve all recommendations for user
    recommendationsResource.addMethod(
      'GET',
      new LambdaIntegration(this.lambdas.getGetRecommendationsFunction()),
      {
        authorizationType: require('aws-cdk-lib/aws-apigateway').AuthorizationType.COGNITO,
        authorizer: { authorizerId },
      }
    );

    // DELETE /recommendations - Delete all recommendations for user
    recommendationsResource.addMethod(
      'DELETE',
      new LambdaIntegration(this.lambdas.getDeleteRecommendationsFunction()),
      {
        authorizationType: require('aws-cdk-lib/aws-apigateway').AuthorizationType.COGNITO,
        authorizer: { authorizerId },
      }
    );

    // GET /recommendations/search - Search and filter recommendations
    const searchResource = recommendationsResource.addResource('search');
    searchResource.addMethod(
      'GET',
      new LambdaIntegration(this.lambdas.getSearchRecommendationsFunction()),
      {
        authorizationType: require('aws-cdk-lib/aws-apigateway').AuthorizationType.COGNITO,
        authorizer: { authorizerId },
      }
    );

    // PUT /recommendations/{timestamp} - Update a recommendation
    const recommendationResource = recommendationsResource.addResource('{timestamp}');
    recommendationResource.addMethod(
      'PUT',
      new LambdaIntegration(this.lambdas.getUpdateRecommendationFunction()),
      {
        authorizationType: require('aws-cdk-lib/aws-apigateway').AuthorizationType.COGNITO,
        authorizer: { authorizerId },
      }
    );

    // Create /feedback resource with CORS
    const feedbackResource = restApi.root.addResource('feedback', {
      defaultCorsPreflightOptions: {
        allowOrigins: require('aws-cdk-lib/aws-apigateway').Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // POST /feedback - Submit feedback for processing
    feedbackResource.addMethod(
      'POST',
      new LambdaIntegration(this.lambdas.getPostFeedbackFunction()),
      {
        authorizationType: require('aws-cdk-lib/aws-apigateway').AuthorizationType.COGNITO,
        authorizer: { authorizerId },
      }
    );
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
