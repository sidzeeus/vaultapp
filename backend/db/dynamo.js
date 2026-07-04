// ─────────────────────────────────────────────
//  db/dynamo.js
//  All database operations in one place.
//  Each function does exactly one thing and
//  has a clear name — easy to read and debug.
// ─────────────────────────────────────────────

const { DynamoDBClient }           = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient,
        PutCommand, GetCommand,
        QueryCommand, DeleteCommand,
        UpdateCommand }            = require('@aws-sdk/lib-dynamodb');
const config                       = require('../config');

// Create one shared DynamoDB connection
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: config.awsRegion })
);

// ── Users ─────────────────────────────────────

/** Save a new user to the users table */
async function createUser(user) {
  await client.send(new PutCommand({
    TableName: config.usersTable,
    Item: user,
  }));
}

/** Find a user by their email address (uses the email-index GSI) */
async function getUserByEmail(email) {
  const result = await client.send(new QueryCommand({
    TableName:                 config.usersTable,
    IndexName:                 'email-index',
    KeyConditionExpression:    'email = :email',
    ExpressionAttributeValues: { ':email': email },
  }));
  return result.Items?.[0] || null;
}

/** Find a user by their unique ID */
async function getUserById(userId) {
  const result = await client.send(new GetCommand({
    TableName: config.usersTable,
    Key:       { userId },
  }));
  return result.Item || null;
}

// ── Files ─────────────────────────────────────

/** Save file metadata after a successful S3 upload */
async function createFile(file) {
  await client.send(new PutCommand({
    TableName: config.filesTable,
    Item: file,
  }));
}

/** Get all files belonging to a specific user */
async function getFilesByUser(userId) {
  const result = await client.send(new QueryCommand({
    TableName:                 config.filesTable,
    KeyConditionExpression:    'userId = :uid',
    ExpressionAttributeValues: { ':uid': userId },
  }));
  // Return newest files first
  return (result.Items || []).sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );
}

/** Get a single file record (also confirms it belongs to this user) */
async function getFile(userId, fileId) {
  const result = await client.send(new GetCommand({
    TableName: config.filesTable,
    Key:       { userId, fileId },
  }));
  return result.Item || null;
}

/** Delete a file record from the database */
async function deleteFile(userId, fileId) {
  await client.send(new DeleteCommand({
    TableName: config.filesTable,
    Key:       { userId, fileId },
  }));
}

module.exports = {
  createUser, getUserByEmail, getUserById,
  createFile, getFilesByUser, getFile, deleteFile,
};
