const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'DELETE,OPTIONS',
};

/**
 * Lambda handler to delete all recommendations for the authenticated user
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

    console.log('Deleting recommendations for userId:', userId);

    // First, query to get all items to delete
    const queryParams = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ProjectionExpression: 'userId, #ts',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
    };

    const queryResult = await docClient.send(new QueryCommand(queryParams));
    
    if (!queryResult.Items || queryResult.Items.length === 0) {
      console.log('No recommendations found to delete');
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          message: 'No recommendations to delete',
          deletedCount: 0,
        }),
      };
    }

    console.log(`Found ${queryResult.Items.length} recommendations to delete`);

    // BatchWrite can handle max 25 items at a time
    const batchSize = 25;
    let deletedCount = 0;

    for (let i = 0; i < queryResult.Items.length; i += batchSize) {
      const batch = queryResult.Items.slice(i, i + batchSize);
      
      const deleteRequests = batch.map(item => ({
        DeleteRequest: {
          Key: {
            userId: item.userId,
            timestamp: item.timestamp,
          },
        },
      }));

      const batchParams = {
        RequestItems: {
          [process.env.DYNAMODB_TABLE_NAME]: deleteRequests,
        },
      };

      await docClient.send(new BatchWriteCommand(batchParams));
      deletedCount += batch.length;
      
      console.log(`Deleted batch of ${batch.length} items (total: ${deletedCount})`);
    }

    console.log(`Successfully deleted ${deletedCount} recommendations`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Recommendations deleted successfully',
        deletedCount,
      }),
    };

  } catch (error) {
    console.error('Error deleting recommendations:', error);
    
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to delete recommendations',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
