require('dotenv').config()
const {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  ResourceInUseException,
} = require('@aws-sdk/client-dynamodb')
const { client } = require('./dynamodb')

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForActive(tableName, maxSeconds = 30) {
  for (let i = 0; i < maxSeconds; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const res = await client.send(new DescribeTableCommand({ TableName: tableName }))
      if (res.Table.TableStatus === 'ACTIVE') return
    } catch {
      // Table may not exist yet on first poll after create — keep waiting
    }
  }
  throw new Error(`Table ${tableName} did not become ACTIVE within ${maxSeconds}s`)
}

async function waitForDeleted(tableName, maxSeconds = 30) {
  for (let i = 0; i < maxSeconds; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }))
      // Still exists, keep waiting
    } catch (err) {
      if (err.name === 'ResourceNotFoundException') return
      throw err
    }
  }
  throw new Error(`Table ${tableName} did not finish deleting within ${maxSeconds}s`)
}

async function dropTable(tableName) {
  try {
    await client.send(new DeleteTableCommand({ TableName: tableName }))
    console.log(`  Dropping ${tableName}...`)
    await waitForDeleted(tableName)
    console.log(`  [ok] ${tableName} deleted`)
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`  ${tableName} does not exist, skipping delete`)
    } else {
      throw err
    }
  }
}

async function createTable(def) {
  const name = def.TableName
  try {
    await client.send(new CreateTableCommand(def))
    console.log(`  Creating ${name}...`)
    await waitForActive(name)
    console.log(`  [ok] ${name} active`)
  } catch (err) {
    if (err.name === 'ResourceInUseException') {
      console.log(`  ${name} already exists, skipping`)
    } else {
      throw err
    }
  }
}

// ── Table definitions ─────────────────────────────────────────────────────────

const LISTINGS = {
  TableName: 'Listings',
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'listing_id',       AttributeType: 'S' },
    { AttributeName: 'course_department', AttributeType: 'S' },
    { AttributeName: 'course_number',    AttributeType: 'S' },
    { AttributeName: 'status',           AttributeType: 'S' },
    { AttributeName: 'created_at',       AttributeType: 'S' },
    { AttributeName: 'textbook_id',      AttributeType: 'S' },
    { AttributeName: 'seller_id',        AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'listing_id', KeyType: 'HASH' }],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'DepartmentCourseIndex',
      KeySchema: [
        { AttributeName: 'course_department', KeyType: 'HASH' },
        { AttributeName: 'course_number',     KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'StatusCreatedIndex',
      KeySchema: [
        { AttributeName: 'status',     KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'TextbookListingsIndex',
      KeySchema: [
        { AttributeName: 'textbook_id', KeyType: 'HASH' },
        { AttributeName: 'created_at',  KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'SellerListingsIndex',
      KeySchema: [
        { AttributeName: 'seller_id',  KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
}

const USERS = {
  TableName: 'Users',
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'user_id', AttributeType: 'S' },
    { AttributeName: 'email',   AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'user_id', KeyType: 'HASH' }],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'EmailIndex',
      KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
}

const TEXTBOOKS = {
  TableName: 'Textbooks',
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'textbook_id', AttributeType: 'S' },
    { AttributeName: 'isbn',        AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'textbook_id', KeyType: 'HASH' }],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'IsbnIndex',
      KeySchema: [{ AttributeName: 'isbn', KeyType: 'HASH' }],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
}

const CONVERSATIONS = {
  TableName: 'Conversations',
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'conversation_id', AttributeType: 'S' },
    { AttributeName: 'buyer_id',        AttributeType: 'S' },
    { AttributeName: 'seller_id',       AttributeType: 'S' },
    { AttributeName: 'last_message_at', AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'conversation_id', KeyType: 'HASH' }],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'BuyerConversationsIndex',
      KeySchema: [
        { AttributeName: 'buyer_id',        KeyType: 'HASH' },
        { AttributeName: 'last_message_at', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'SellerConversationsIndex',
      KeySchema: [
        { AttributeName: 'seller_id',       KeyType: 'HASH' },
        { AttributeName: 'last_message_at', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
}

const MESSAGES = {
  TableName: 'Messages',
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'message_id',      AttributeType: 'S' },
    { AttributeName: 'conversation_id', AttributeType: 'S' },
    { AttributeName: 'created_at',      AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'message_id', KeyType: 'HASH' }],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'ConversationMessagesIndex',
      KeySchema: [
        { AttributeName: 'conversation_id', KeyType: 'HASH' },
        { AttributeName: 'created_at',      KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
}

const TRANSACTIONS = {
  TableName: 'Transactions',
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'transaction_id', AttributeType: 'S' },
    { AttributeName: 'buyer_id',       AttributeType: 'S' },
    { AttributeName: 'seller_id',      AttributeType: 'S' },
    { AttributeName: 'created_at',     AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'transaction_id', KeyType: 'HASH' }],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'BuyerTransactionsIndex',
      KeySchema: [
        { AttributeName: 'buyer_id',   KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'SellerTransactionsIndex',
      KeySchema: [
        { AttributeName: 'seller_id',  KeyType: 'HASH' },
        { AttributeName: 'created_at', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
}

const CARTS = {
  TableName: 'Carts',
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'user_id', AttributeType: 'S' },
  ],
  KeySchema: [{ AttributeName: 'user_id', KeyType: 'HASH' }],
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== Phase 6.5 Schema Migration ===\n')

  console.log('--- Dropping deprecated tables ---')
  await dropTable('Listings')
  await dropTable('Offers')

  console.log('\n--- Creating tables ---')
  await createTable(LISTINGS)
  await createTable(USERS)
  await createTable(TEXTBOOKS)
  await createTable(CONVERSATIONS)
  await createTable(MESSAGES)
  await createTable(TRANSACTIONS)
  await createTable(CARTS)

  console.log('\nAll tables created successfully.')
}

run().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
