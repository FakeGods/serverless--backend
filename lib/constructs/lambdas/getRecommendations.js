const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

/**
 * Lambda handler to retrieve all recommendations for the authenticated user
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

    console.log('Querying recommendations for userId:', userId);

    // Query DynamoDB for all recommendations for this user
    const params = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ScanIndexForward: false, // Sort by timestamp descending (newest first)
    };

    const result = await docClient.send(new QueryCommand(params));
    
    console.log(`Found ${result.Items?.length || 0} recommendations`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        recommendations: result.Items || [],
        count: result.Items?.length || 0,
      }),
    };

  } catch (error) {
    console.error('Error retrieving recommendations:', error);
    
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to retrieve recommendations',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
