const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({ region: process.env.AWS_REGION });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

/**
 * Lambda handler to accept feedback and publish to SNS topic
 * @param {Object} event - API Gateway event
 * @returns {Object} API Gateway response
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Extract userId from Cognito authorizer context
    const userId = event.requestContext?.authorizer?.claims?.sub;
    
    if (!userId) {
      console.error('No userId found in authorizer context');
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ 
          error: 'Unauthorized',
          message: 'User ID not found in authentication context'
        }),
      };
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid JSON in request body',
        }),
      };
    }

    const { feedback, tags, feedbackType } = requestBody;

    // Validate feedback
    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
      console.error('Invalid feedback provided');
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Feedback text is required and must be a non-empty string',
        }),
      };
    }

    if (feedback.length > 10000) {
      console.error('Feedback too long:', feedback.length);
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Feedback text must not exceed 10,000 characters',
        }),
      };
    }

    // Validate tags if provided
    if (tags !== undefined && !Array.isArray(tags)) {
      console.error('Invalid tags format:', tags);
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Tags must be an array of strings',
        }),
      };
    }

    console.log('Publishing feedback to SNS for userId:', userId);

    // Prepare SNS message
    const message = {
      userId,
      feedback: feedback.trim(),
      timestamp: Date.now(),
      tags: tags || [],
      feedbackType: feedbackType || 'general',
    };

    // Publish to SNS topic
    const publishParams = {
      TopicArn: process.env.SNS_TOPIC_ARN,
      Message: JSON.stringify(message),
      Subject: 'Feedback Recommendation Request',
      MessageAttributes: {
        userId: {
          DataType: 'String',
          StringValue: userId,
        },
        timestamp: {
          DataType: 'Number',
          StringValue: String(message.timestamp),
        },
      },
    };

    const result = await snsClient.send(new PublishCommand(publishParams));
    
    console.log('Successfully published to SNS, MessageId:', result.MessageId);

    return {
      statusCode: 202,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Feedback submitted successfully for processing',
        messageId: result.MessageId,
        status: 'processing',
      }),
    };

  } catch (error) {
    console.error('Error publishing feedback to SNS:', error);
    
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to submit feedback for processing',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
