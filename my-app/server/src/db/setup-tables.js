require('dotenv').config()
const { CreateTableCommand, ListTablesCommand, DeleteTableCommand } = require('@aws-sdk/client-dynamodb')
const { client } = require('./dynamodb')

const tables = [
  {
    TableName: 'Listings',
    AttributeDefinitions: [
      { AttributeName: 'listing_id', AttributeType: 'S' },
      { AttributeName: 'course_department', AttributeType: 'S' },
      { AttributeName: 'course_number', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'created_at', AttributeType: 'S' },
      { AttributeName: 'seller_id', AttributeType: 'S' },
      { AttributeName: 'textbook_id', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'listing_id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'DepartmentCourseIndex',
        KeySchema: [
          { AttributeName: 'course_department', KeyType: 'HASH' },
          { AttributeName: 'course_number', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: 'StatusCreatedIndex',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'created_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: 'SellerListingsIndex',
        KeySchema: [
          { AttributeName: 'seller_id', KeyType: 'HASH' },
          { AttributeName: 'created_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: 'TextbookListingsIndex',
        KeySchema: [
          { AttributeName: 'textbook_id', KeyType: 'HASH' },
          { AttributeName: 'created_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: 'Departments',
    AttributeDefinitions: [{ AttributeName: 'department_code', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'department_code', KeyType: 'HASH' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: 'Users',
    AttributeDefinitions: [
      { AttributeName: 'user_id', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'user_id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: 'Offers',
    AttributeDefinitions: [
      { AttributeName: 'offer_id', AttributeType: 'S' },
      { AttributeName: 'listing_id', AttributeType: 'S' },
      { AttributeName: 'created_at', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'offer_id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ListingOffersIndex',
        KeySchema: [
          { AttributeName: 'listing_id', KeyType: 'HASH' },
          { AttributeName: 'created_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: 'Textbooks',
    AttributeDefinitions: [
      { AttributeName: 'textbook_id', AttributeType: 'S' },
      { AttributeName: 'isbn', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'textbook_id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'IsbnIndex',
        KeySchema: [{ AttributeName: 'isbn', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: 'Conversations',
    AttributeDefinitions: [
      { AttributeName: 'conversation_id', AttributeType: 'S' },
      { AttributeName: 'buyer_id', AttributeType: 'S' },
      { AttributeName: 'seller_id', AttributeType: 'S' },
      { AttributeName: 'last_message_at', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'conversation_id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'BuyerConversationsIndex',
        KeySchema: [
          { AttributeName: 'buyer_id', KeyType: 'HASH' },
          { AttributeName: 'last_message_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: 'SellerConversationsIndex',
        KeySchema: [
          { AttributeName: 'seller_id', KeyType: 'HASH' },
          { AttributeName: 'last_message_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: 'Messages',
    AttributeDefinitions: [
      { AttributeName: 'message_id', AttributeType: 'S' },
      { AttributeName: 'conversation_id', AttributeType: 'S' },
      { AttributeName: 'created_at', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'message_id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ConversationMessagesIndex',
        KeySchema: [
          { AttributeName: 'conversation_id', KeyType: 'HASH' },
          { AttributeName: 'created_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: 'Transactions',
    AttributeDefinitions: [
      { AttributeName: 'transaction_id', AttributeType: 'S' },
      { AttributeName: 'buyer_id', AttributeType: 'S' },
      { AttributeName: 'seller_id', AttributeType: 'S' },
      { AttributeName: 'created_at', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'transaction_id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'BuyerTransactionsIndex',
        KeySchema: [
          { AttributeName: 'buyer_id', KeyType: 'HASH' },
          { AttributeName: 'created_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: 'SellerTransactionsIndex',
        KeySchema: [
          { AttributeName: 'seller_id', KeyType: 'HASH' },
          { AttributeName: 'created_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: 'Carts',
    AttributeDefinitions: [{ AttributeName: 'user_id', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'user_id', KeyType: 'HASH' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
]

async function setup() {
  const { TableNames: existing } = await client.send(new ListTablesCommand({}))

  for (const def of tables) {
    if (existing.includes(def.TableName)) {
      console.log(`  [skip] ${def.TableName} already exists`)
    } else {
      await client.send(new CreateTableCommand(def))
      console.log(`  [ok] Created ${def.TableName}`)
    }
  }
}

setup()
  .then(() => {
    console.log('Tables ready.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Setup failed:', err.message)
    process.exit(1)
  })
