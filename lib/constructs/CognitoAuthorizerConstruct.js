const { Construct } = require('constructs');
const { UserPool } = require('aws-cdk-lib/aws-cognito');
const { CfnAuthorizer } = require('aws-cdk-lib/aws-apigateway');
const {
  COGNITO_AUTHORIZER_NAME,
  COGNITO_AUTHORIZER_IDENTITY_SOURCE,
  COGNITO_AUTHORIZER_VALIDATION_REGEX,
  COGNITO_AUTHORIZER_CACHE_TTL,
} = require('../constants/apiConstants');

/**
 * Cognito Authorizer Construct
 *
 * Retrieves an existing Cognito User Pool by ARN and attaches it as an authorizer
 * to the provided REST API. Supports JWT token validation via Authorization header.
 *
 * Usage:
 * const cognitoAuth = new CognitoAuthorizerConstruct(stack, 'CognitoAuth', {
 *   restApi: myRestApi,
 *   userPoolArn: 'arn:aws:cognito-idp:region:account:userpool/pool-id',
 * });
 */
class CognitoAuthorizerConstruct extends Construct {
  /**
   * @param {Construct} scope - Parent construct
   * @param {string} id - Logical ID
   * @param {Object} props - Configuration
   * @param {RestApi} props.restApi - The REST API to attach authorizer to
   * @param {string} props.userPoolArn - ARN of existing Cognito User Pool
   */
  constructor(scope, id, props) {
    super(scope, id);
    this._validateProps(props);

    this.restApi = props.restApi;
    this.userPoolArn = props.userPoolArn;

    this.authorizer = this._createAuthorizer();
  }

  /**
   * Creates and attaches Cognito authorizer to REST API
   * @private
   * @returns {CfnAuthorizer} The created authorizer
   */
  _createAuthorizer() {
    const { userPoolId, region } = this._parseArn(this.userPoolArn);

    // Retrieve the User Pool by ARN
    const userPool = UserPool.fromUserPoolArn(
      this,
      'ImportedUserPool',
      this.userPoolArn
    );

    // Create the Cognito authorizer
    return new CfnAuthorizer(this, 'CognitoAuthorizer', {
      restApiId: this.restApi.restApiId,
      name: COGNITO_AUTHORIZER_NAME,
      type: 'COGNITO_USER_POOLS',
      identitySource: COGNITO_AUTHORIZER_IDENTITY_SOURCE,
      providerArns: [this.userPoolArn],
      authorizerCredentials: undefined,
      identityValidationExpression: COGNITO_AUTHORIZER_VALIDATION_REGEX,
      authorizerResultTtlInSeconds: COGNITO_AUTHORIZER_CACHE_TTL,
    });
  }

  /**
   * Parses Cognito User Pool ARN to extract pool ID and region
   * @private
   * @param {string} arn - User Pool ARN
   * @returns {Object} Object with userPoolId and region
   */
  _parseArn(arn) {
    // ARN format: arn:aws:cognito-idp:region:account-id:userpool/pool-id
    const arnPattern = /^arn:aws:cognito-idp:([a-z0-9\-]+):\d{12}:userpool\/(.+)$/;
    const match = arn.match(arnPattern);

    if (!match) {
      throw new Error(
        `Invalid User Pool ARN format: ${arn}. ` +
        'Expected: arn:aws:cognito-idp:region:account-id:userpool/pool-id'
      );
    }

    return {
      region: match[1],
      userPoolId: match[2],
    };
  }

  /**
   * Validates required properties
   * @private
   * @param {Object} props - Properties to validate
   */
  _validateProps(props) {
    if (!props) {
      throw new Error('CognitoAuthorizerConstruct requires props parameter');
    }

    if (!props.restApi) {
      throw new Error('CognitoAuthorizerConstruct requires restApi property');
    }

    if (!props.userPoolArn) {
      throw new Error('CognitoAuthorizerConstruct requires userPoolArn property');
    }

    if (!this._isValidArn(props.userPoolArn)) {
      throw new Error(
        `Invalid User Pool ARN: ${props.userPoolArn}. ` +
        'Expected format: arn:aws:cognito-idp:region:account-id:userpool/poolid'
      );
    }
  }

  /**
   * Validates ARN format
   * @private
   * @param {string} arn - ARN to validate
   * @returns {boolean} True if valid
   */
  _isValidArn(arn) {
    const arnPattern = /^arn:aws:cognito-idp:[a-z0-9\-]+:\d{12}:userpool\/[a-zA-Z0-9\-_]+$/;
    return arnPattern.test(arn);
  }

  /**
   * Get the authorizer ID
   * @returns {string} Authorizer ID
   */
  getAuthorizerId() {
    return this.authorizer.ref;
  }

  /**
   * Get the authorizer object
   * @returns {CfnAuthorizer} Authorizer
   */
  getAuthorizer() {
    return this.authorizer;
  }

  /**
   * Get the User Pool ARN
   * @returns {string} User Pool ARN
   */
  getUserPoolArn() {
    return this.userPoolArn;
  }
}

module.exports = { CognitoAuthorizerConstruct };
