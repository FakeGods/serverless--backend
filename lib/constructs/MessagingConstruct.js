const { Topic } = require('aws-cdk-lib/aws-sns');
const { Queue } = require('aws-cdk-lib/aws-sqs');
const { SqsSubscription } = require('aws-cdk-lib/aws-sns-subscriptions');
const { RemovalPolicy, Duration } = require('aws-cdk-lib');
const { Construct } = require('constructs');

/**
 * Construct for creating SNS topic and SQS queue for feedback processing
 */
class MessagingConstruct extends Construct {
  /**
   * @param {Construct} scope
   * @param {string} id
   * @param {Object} props
   * @param {string} props.environment - Environment name (dev, prod, etc.)
   */
  constructor(scope, id, props) {
    super(scope, id);

    const { environment } = props;

    // Create Dead Letter Queue for failed messages
    this.deadLetterQueue = new Queue(this, 'FeedbackDLQ', {
      queueName: `FeedbackDLQ-${environment}`,
      retentionPeriod: Duration.days(14), // Keep failed messages for 14 days
      removalPolicy: RemovalPolicy.DESTROY, // For dev; use RETAIN for production
    });

    // Create SQS Queue for feedback processing
    this.feedbackQueue = new Queue(this, 'FeedbackQueue', {
      queueName: `FeedbackQueue-${environment}`,
      visibilityTimeout: Duration.minutes(5), // Time for Lambda to process message
      receiveMessageWaitTime: Duration.seconds(20), // Long polling
      retentionPeriod: Duration.days(4), // Keep messages for 4 days
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3, // Retry failed messages 3 times before sending to DLQ
      },
      removalPolicy: RemovalPolicy.DESTROY, // For dev; use RETAIN for production
    });

    // Create SNS Topic for feedback recommendations
    this.feedbackTopic = new Topic(this, 'FeedbackTopic', {
      topicName: `FeedbackRecommendations-${environment}`,
      displayName: 'Feedback Recommendations Topic',
      fifo: false, // Standard topic for higher throughput
    });

    // Subscribe SQS queue to SNS topic
    this.feedbackTopic.addSubscription(
      new SqsSubscription(this.feedbackQueue, {
        rawMessageDelivery: false, // Include SNS metadata
      })
    );
  }

  /**
   * Get the SNS topic
   * @returns {Topic}
   */
  getTopic() {
    return this.feedbackTopic;
  }

  /**
   * Get the topic ARN
   * @returns {string}
   */
  getTopicArn() {
    return this.feedbackTopic.topicArn;
  }

  /**
   * Get the SQS queue
   * @returns {Queue}
   */
  getQueue() {
    return this.feedbackQueue;
  }

  /**
   * Get the queue ARN
   * @returns {string}
   */
  getQueueArn() {
    return this.feedbackQueue.queueArn;
  }

  /**
   * Get the queue URL
   * @returns {string}
   */
  getQueueUrl() {
    return this.feedbackQueue.queueUrl;
  }

  /**
   * Get the dead letter queue
   * @returns {Queue}
   */
  getDeadLetterQueue() {
    return this.deadLetterQueue;
  }
}

module.exports = { MessagingConstruct };
