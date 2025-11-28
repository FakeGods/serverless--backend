const { Runtime, Function, Code } = require('aws-cdk-lib/aws-lambda');
const { Duration } = require('aws-cdk-lib');
const { Construct } = require('constructs');
const path = require('path');

/**
 * Construct for creating Lambda functions for the recommendation system
 */
class LambdaConstruct extends Construct {
  /**
   * @param {Construct} scope
   * @param {string} id
   * @param {Object} props
   * @param {string} props.environment - Environment name
   * @param {string} props.tableName - DynamoDB table name
   * @param {string} props.topicArn - SNS topic ARN
   * @param {string} props.bedrockModelId - Bedrock model ID
   */
  constructor(scope, id, props) {
    super(scope, id);

    const { environment, tableName, topicArn, bedrockModelId } = props;

    const lambdaPath = path.join(__dirname, 'lambdas');

    // Common Lambda configuration
    const commonProps = {
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        DYNAMODB_TABLE_NAME: tableName,
        NODE_ENV: environment,
      },
    };

    // Lambda to get recommendations
    this.getRecommendationsFunction = new Function(this, 'GetRecommendations', {
      ...commonProps,
      functionName: `GetRecommendations-${environment}`,
      code: Code.fromAsset(lambdaPath),
      handler: 'getRecommendations.handler',
      description: 'Retrieve all recommendations for authenticated user',
    });

    // Lambda to delete recommendations
    this.deleteRecommendationsFunction = new Function(this, 'DeleteRecommendations', {
      ...commonProps,
      functionName: `DeleteRecommendations-${environment}`,
      code: Code.fromAsset(lambdaPath),
      handler: 'deleteRecommendations.handler',
      description: 'Delete all recommendations for authenticated user',
    });

    // Lambda to post feedback
    this.postFeedbackFunction = new Function(this, 'PostFeedback', {
      ...commonProps,
      functionName: `PostFeedback-${environment}`,
      code: Code.fromAsset(lambdaPath),
      handler: 'postFeedback.handler',
      description: 'Accept feedback and publish to SNS topic',
      environment: {
        ...commonProps.environment,
        SNS_TOPIC_ARN: topicArn,
      },
    });

    // Lambda to process feedback (SQS consumer)
    this.processFeedbackFunction = new Function(this, 'ProcessFeedback', {
      ...commonProps,
      functionName: `ProcessFeedback-${environment}`,
      code: Code.fromAsset(lambdaPath),
      handler: 'processFeedback.handler',
      description: 'Process feedback from SQS and generate recommendations using Bedrock',
      timeout: Duration.minutes(5), // Longer timeout for Bedrock API calls
      memorySize: 512, // More memory for AI processing
      environment: {
        ...commonProps.environment,
        BEDROCK_MODEL_ID: bedrockModelId,
      },
    });

    // Lambda to update recommendation
    this.updateRecommendationFunction = new Function(this, 'UpdateRecommendation', {
      ...commonProps,
      functionName: `UpdateRecommendation-${environment}`,
      code: Code.fromAsset(lambdaPath),
      handler: 'updateRecommendation.handler',
      description: 'Update a recommendation (completion status, tags, etc.)',
    });

    // Lambda to search recommendations
    this.searchRecommendationsFunction = new Function(this, 'SearchRecommendations', {
      ...commonProps,
      functionName: `SearchRecommendations-${environment}`,
      code: Code.fromAsset(lambdaPath),
      handler: 'searchRecommendations.handler',
      description: 'Search and filter recommendations',
    });
  }

  /**
   * Get the GET recommendations Lambda function
   */
  getGetRecommendationsFunction() {
    return this.getRecommendationsFunction;
  }

  /**
   * Get the DELETE recommendations Lambda function
   */
  getDeleteRecommendationsFunction() {
    return this.deleteRecommendationsFunction;
  }

  /**
   * Get the POST feedback Lambda function
   */
  getPostFeedbackFunction() {
    return this.postFeedbackFunction;
  }

  /**
   * Get the process feedback Lambda function
   */
  getProcessFeedbackFunction() {
    return this.processFeedbackFunction;
  }

  /**
   * Get the UPDATE recommendation Lambda function
   */
  getUpdateRecommendationFunction() {
    return this.updateRecommendationFunction;
  }

  /**
   * Get the SEARCH recommendations Lambda function
   */
  getSearchRecommendationsFunction() {
    return this.searchRecommendationsFunction;
  }
}

module.exports = { LambdaConstruct };
