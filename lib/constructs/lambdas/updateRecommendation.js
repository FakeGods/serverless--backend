const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'PUT,OPTIONS',
};

/**
 * Lambda handler to update a recommendation
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

    // Get timestamp from path parameters
    const timestamp = parseInt(event.pathParameters?.timestamp);
    
    if (!timestamp || isNaN(timestamp)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Invalid or missing timestamp in path',
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

    // First, verify the item exists and belongs to this user
    const getParams = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: {
        userId,
        timestamp,
      },
    };

    const existingItem = await docClient.send(new GetCommand(getParams));
    
    if (!existingItem.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Not Found',
          message: 'Recommendation not found',
        }),
      };
    }

    // Build update expression dynamically based on provided fields
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (requestBody.completed !== undefined) {
      updateExpressions.push('#completed = :completed');
      expressionAttributeNames['#completed'] = 'completed';
      expressionAttributeValues[':completed'] = requestBody.completed;
    }

    if (requestBody.tags !== undefined && Array.isArray(requestBody.tags)) {
      updateExpressions.push('#tags = :tags');
      expressionAttributeNames['#tags'] = 'tags';
      expressionAttributeValues[':tags'] = requestBody.tags;
    }

    if (requestBody.recommendations !== undefined) {
      updateExpressions.push('#recommendations = :recommendations');
      expressionAttributeNames['#recommendations'] = 'recommendations';
      expressionAttributeValues[':recommendations'] = requestBody.recommendations;
    }

    if (requestBody.feedbackType !== undefined) {
      updateExpressions.push('#feedbackType = :feedbackType');
      expressionAttributeNames['#feedbackType'] = 'feedbackType';
      expressionAttributeValues[':feedbackType'] = requestBody.feedbackType;
    }

    // Always update the updatedAt timestamp
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    if (updateExpressions.length === 1) { // Only updatedAt
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'No valid fields to update',
        }),
      };
    }

    // Update the item
    const updateParams = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      Key: {
        userId,
        timestamp,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    };

    const result = await docClient.send(new UpdateCommand(updateParams));
    
    console.log('Updated recommendation:', result.Attributes);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: 'Recommendation updated successfully',
        recommendation: result.Attributes,
      }),
    };

  } catch (error) {
    console.error('Error updating recommendation:', error);
    
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to update recommendation',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
