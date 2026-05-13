'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE || 'ammazone-payments';

async function recordTransaction(userId, transactionId, amount, orderId, status) {
  const params = {
    TableName: TABLE_NAME,
    Item: {
      userId,
      transactionId,
      amount,
      orderId,
      status,
      createdAt: new Date().toISOString(),
    },
  };
  await docClient.send(new PutCommand(params));
  return params.Item;
}

async function getUserTransactions(userId) {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
    ScanIndexForward: false,
  };
  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

module.exports = { recordTransaction, getUserTransactions, TABLE_NAME };
