const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Lambda handler to process feedback from SQS and generate recommendations using Bedrock
 * @param {Object} event - SQS event
 * @returns {Object} Processing results
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const results = {
    successful: [],
    failed: [],
  };

  // Process each SQS message
  for (const record of event.Records) {
    try {
      console.log('Processing SQS message:', record.messageId);

      // Parse SNS message from SQS
      const snsMessage = JSON.parse(record.body);
      const message = JSON.parse(snsMessage.Message);

      const { userId, feedback, timestamp } = message;

      if (!userId || !feedback) {
        console.error('Invalid message format - missing userId or feedback');
        results.failed.push({
          messageId: record.messageId,
          error: 'Invalid message format',
        });
        continue;
      }

      console.log('Generating recommendations for userId:', userId);

      // Call Amazon Bedrock to generate recommendations
      const recommendations = await generateRecommendations(feedback);

      console.log('Generated recommendations:', recommendations);

      // Save recommendations to DynamoDB
      const putParams = {
        TableName: process.env.DYNAMODB_TABLE_NAME,
        Item: {
          userId,
          timestamp: timestamp || Date.now(),
          feedbackType: message.feedbackType || 'general',
          originalFeedback: feedback,
          recommendations,
          generatedAt: new Date().toISOString(),
          modelId: process.env.BEDROCK_MODEL_ID,
          tags: message.tags || [],
          completed: false,
          updatedAt: new Date().toISOString(),
        },
      };

      await docClient.send(new PutCommand(putParams));

      console.log('Successfully saved recommendations to DynamoDB');

      results.successful.push({
        messageId: record.messageId,
        userId,
      });

    } catch (error) {
      console.error('Error processing message:', record.messageId, error);
      
      results.failed.push({
        messageId: record.messageId,
        error: error.message,
      });

      // Re-throw error to keep message in queue for retry
      // SQS will handle retries based on queue configuration
      throw error;
    }
  }

  console.log('Processing complete:', results);

  return {
    statusCode: 200,
    body: JSON.stringify(results),
  };
};

/**
 * Generate recommendations using Amazon Bedrock
 * @param {string} feedback - The feedback text
 * @returns {Promise<Array>} Array of recommendation objects
 */
async function generateRecommendations(feedback) {
  const modelId = process.env.BEDROCK_MODEL_ID;

  console.log('Calling Bedrock model:', modelId);

  // Prepare prompt for the model
  const prompt = `You are a helpful assistant that analyzes feedback and provides actionable recommendations for improvement.

Analyze the following feedback and provide 3-5 specific, actionable recommendations:

Feedback: "${feedback}"

Provide your response as a JSON array of recommendation objects. Each recommendation should have:
- title: A brief title (max 100 characters)
- description: Detailed explanation (max 500 characters)
- priority: One of "high", "medium", "low"
- category: The category this recommendation falls into

Example format:
[
  {
    "title": "Improve response time",
    "description": "Consider implementing caching to reduce API response times by 50%",
    "priority": "high",
    "category": "performance"
  }
]

Respond ONLY with the JSON array, no additional text.`;

  // Prepare request based on model (using Claude 3 format)
  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 2000,
    temperature: 0.7,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  const invokeParams = {
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  };

  try {
    const response = await bedrockClient.send(new InvokeModelCommand(invokeParams));
    
    // Parse response
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    console.log('Bedrock response:', JSON.stringify(responseBody, null, 2));

    // Extract recommendations from Claude response
    let recommendationsText = responseBody.content?.[0]?.text || '';
    
    // Try to parse as JSON
    // Remove any markdown code blocks if present
    recommendationsText = recommendationsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const recommendations = JSON.parse(recommendationsText);

    // Validate and sanitize recommendations
    if (!Array.isArray(recommendations)) {
      throw new Error('Bedrock did not return an array of recommendations');
    }

    return recommendations.map((rec, index) => ({
      id: `rec-${Date.now()}-${index}`,
      title: String(rec.title || 'Recommendation').substring(0, 100),
      description: String(rec.description || '').substring(0, 500),
      priority: ['high', 'medium', 'low'].includes(rec.priority) ? rec.priority : 'medium',
      category: String(rec.category || 'general'),
    }));

  } catch (error) {
    console.error('Error calling Bedrock:', error);
    
    // Return fallback recommendations on error
    return [
      {
        id: `rec-fallback-${Date.now()}`,
        title: 'Review and analyze feedback',
        description: 'A detailed analysis of this feedback is recommended to identify specific areas for improvement.',
        priority: 'medium',
        category: 'general',
      },
    ];
  }
}
