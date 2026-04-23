require('dotenv').config()
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb')
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb')

const config = { region: process.env.AWS_REGION || 'us-east-1' }

if (process.env.DYNAMODB_ENDPOINT) {
  config.endpoint = process.env.DYNAMODB_ENDPOINT
  config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'fakeMyKeyId',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'fakeSecretAccessKey',
  }
} else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
}

const client = new DynamoDBClient(config)
const docClient = DynamoDBDocumentClient.from(client)

module.exports = { client, docClient }
