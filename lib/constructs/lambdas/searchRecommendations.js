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
 * Lambda handler to search and filter recommendations
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

    // Extract query parameters
    const queryParams = event.queryStringParameters || {};
    const {
      search,          // Text search in recommendations/originalFeedback
      tags,            // Comma-separated tags
      completed,       // 'true', 'false', or undefined for all
      feedbackType,    // Filter by feedback type
      priority,        // Filter by priority (if stored)
      fromDate,        // Start date filter (ISO string)
      toDate,          // End date filter (ISO string)
    } = queryParams;

    console.log('Search parameters:', queryParams);

    // Build DynamoDB query - always query by userId
    const queryCommandParams = {
      TableName: process.env.DYNAMODB_TABLE_NAME,
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId,
      },
      ExpressionAttributeNames: {},
      ScanIndexForward: false, // Sort newest first
    };

    // Build filter expressions
    const filterExpressions = [];

    // Date range filter
    if (fromDate) {
      const fromTimestamp = new Date(fromDate).getTime();
      if (!isNaN(fromTimestamp)) {
        filterExpressions.push('#timestamp >= :fromTimestamp');
        queryCommandParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        queryCommandParams.ExpressionAttributeValues[':fromTimestamp'] = fromTimestamp;
      }
    }

    if (toDate) {
      const toTimestamp = new Date(toDate).getTime();
      if (!isNaN(toTimestamp)) {
        filterExpressions.push('#timestamp <= :toTimestamp');
        queryCommandParams.ExpressionAttributeNames['#timestamp'] = 'timestamp';
        queryCommandParams.ExpressionAttributeValues[':toTimestamp'] = toTimestamp;
      }
    }

    // Feedback type filter
    if (feedbackType) {
      filterExpressions.push('#feedbackType = :feedbackType');
      queryCommandParams.ExpressionAttributeNames['#feedbackType'] = 'feedbackType';
      queryCommandParams.ExpressionAttributeValues[':feedbackType'] = feedbackType;
    }

    // Completed status filter
    if (completed !== undefined) {
      filterExpressions.push('#completed = :completed');
      queryCommandParams.ExpressionAttributeNames['#completed'] = 'completed';
      queryCommandParams.ExpressionAttributeValues[':completed'] = completed === 'true';
    }

    // Tags filter - check if ANY of the provided tags exist
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      if (tagArray.length > 0) {
        const tagConditions = tagArray.map((tag, index) => {
          const attrName = `:tag${index}`;
          queryCommandParams.ExpressionAttributeValues[attrName] = tag;
          return `contains(#tags, ${attrName})`;
        });
        filterExpressions.push(`(${tagConditions.join(' OR ')})`);
        queryCommandParams.ExpressionAttributeNames['#tags'] = 'tags';
      }
    }

    // Apply filter expression if any filters exist
    if (filterExpressions.length > 0) {
      queryCommandParams.FilterExpression = filterExpressions.join(' AND ');
    }

    console.log('DynamoDB Query params:', JSON.stringify(queryCommandParams, null, 2));

    // Execute query
    const result = await docClient.send(new QueryCommand(queryCommandParams));
    let recommendations = result.Items || [];

    console.log(`Found ${recommendations.length} items before text search`);

    // Apply text search filter (client-side since DynamoDB doesn't support text search)
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      recommendations = recommendations.filter(item => {
        const recommendationsText = JSON.stringify(item.recommendations || []).toLowerCase();
        const feedbackText = (item.originalFeedback || '').toLowerCase();
        return recommendationsText.includes(searchLower) || feedbackText.includes(searchLower);
      });
      console.log(`Filtered to ${recommendations.length} items after text search`);
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        recommendations,
        count: recommendations.length,
        filters: {
          search,
          tags,
          completed,
          feedbackType,
          fromDate,
          toDate,
        },
      }),
    };

  } catch (error) {
    console.error('Error searching recommendations:', error);
    
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to search recommendations',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      }),
    };
  }
};
