const { Construct } = require('constructs');
const { Table, AttributeType, BillingMode } = require('aws-cdk-lib/aws-dynamodb');
const { RemovalPolicy } = require('aws-cdk-lib');

/**
 * DynamoDB Table Construct for Recommendations
 * 
 * Creates a DynamoDB table to store user feedback recommendations with:
 * - Partition key: userId
 * - Sort key: timestamp
 * - On-demand billing
 * - Point-in-time recovery enabled
 */
class DynamoDBConstruct extends Construct {
  /**
   * @param {Construct} scope - Parent construct
   * @param {string} id - Construct identifier
   * @param {Object} props - Configuration properties
   * @param {string} [props.tableName] - Custom table name
   * @param {string} [props.environment] - Environment name (dev, staging, prod)
   * @param {RemovalPolicy} [props.removalPolicy] - Table removal policy
   */
  constructor(scope, id, props = {}) {
    super(scope, id);

    const environment = props.environment || 'dev';
    const tableName = props.tableName || `Recommendations-${environment}`;

    // Create DynamoDB table for recommendations
    this.table = new Table(this, 'RecommendationsTable', {
      tableName: tableName,
      partitionKey: {
        name: 'userId',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: AttributeType.NUMBER,
      },
      billingMode: BillingMode.PAY_PER_REQUEST, // On-demand billing
      pointInTimeRecovery: true, // Enable backup
      removalPolicy: props.removalPolicy || RemovalPolicy.RETAIN, // Retain table on stack deletion
    });

    // Add Global Secondary Index for querying by feedback type
    this.table.addGlobalSecondaryIndex({
      indexName: 'FeedbackTypeIndex',
      partitionKey: {
        name: 'feedbackType',
        type: AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: AttributeType.NUMBER,
      },
    });
  }

  /**
   * Get the DynamoDB table
   * @returns {Table} The DynamoDB table instance
   */
  getTable() {
    return this.table;
  }

  /**
   * Get the table name
   * @returns {string} The table name
   */
  getTableName() {
    return this.table.tableName;
  }

  /**
   * Get the table ARN
   * @returns {string} The table ARN
   */
  getTableArn() {
    return this.table.tableArn;
  }

  /**
   * Grant read permissions to a principal
   * @param {IGrantable} grantee - The principal to grant permissions to
   */
  grantRead(grantee) {
    this.table.grantReadData(grantee);
  }

  /**
   * Grant write permissions to a principal
   * @param {IGrantable} grantee - The principal to grant permissions to
   */
  grantWrite(grantee) {
    this.table.grantWriteData(grantee);
  }

  /**
   * Grant read and write permissions to a principal
   * @param {IGrantable} grantee - The principal to grant permissions to
   */
  grantReadWrite(grantee) {
    this.table.grantReadWriteData(grantee);
  }
}

module.exports = { DynamoDBConstruct };
