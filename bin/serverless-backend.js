#!/usr/bin/env node

const cdk = require('aws-cdk-lib');
const { ServerlessBackendStack } = require('../lib/serverless-backend-stack');

const app = new cdk.App();

/**
 * Retrieve Cognito User Pool ARN from context or environment variable
 * Usage: cdk deploy -c cognitoUserPoolArn="arn:aws:cognito-idp:..."
 * Or set environment variable: COGNITO_USER_POOL_ARN
 */
const cognitoUserPoolArn =
  app.node.tryGetContext('cognitoUserPoolArn') ||
  process.env.COGNITO_USER_POOL_ARN;

if (!cognitoUserPoolArn) {
  throw new Error(
    'Cognito User Pool ARN is required. ' +
    'Provide it using: cdk deploy -c cognitoUserPoolArn="arn:..." ' +
    'or set COGNITO_USER_POOL_ARN environment variable'
  );
}

new ServerlessBackendStack(app, 'ServerlessBackendStack', {
  env: { account: '695438154048', region: 'eu-central-1' },
  cognitoUserPoolArn,
});
