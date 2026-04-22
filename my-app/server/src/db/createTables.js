require('dotenv').config()
const { CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb')
const { client } = require('./dynamodb')

const tableDefinitions = [
  {
    TableName: 'Listings',
    KeySchema: [{ AttributeName: 'listing_id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'listing_id', AttributeType: 'S' },
      { AttributeName: 'course_department', AttributeType: 'S' },
      { AttributeName: 'course_number', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'created_at', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'DepartmentCourseIndex',
        KeySchema: [
          { AttributeName: 'course_department', KeyType: 'HASH' },
          { AttributeName: 'course_number', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
      {
        IndexName: 'StatusCreatedIndex',
        KeySchema: [
          { AttributeName: 'status', KeyType: 'HASH' },
          { AttributeName: 'created_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'Offers',
    KeySchema: [{ AttributeName: 'offer_id', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'offer_id', AttributeType: 'S' },
      { AttributeName: 'listing_id', AttributeType: 'S' },
      { AttributeName: 'created_at', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'ListingOffersIndex',
        KeySchema: [
          { AttributeName: 'listing_id', KeyType: 'HASH' },
          { AttributeName: 'created_at', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'Departments',
    KeySchema: [{ AttributeName: 'department_code', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'department_code', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
]

async function createTables() {
  const { TableNames: existing } = await client.send(new ListTablesCommand({}))

  for (const def of tableDefinitions) {
    if (existing.includes(def.TableName)) {
      console.log(`  [skip] ${def.TableName} already exists`)
      continue
    }
    await client.send(new CreateTableCommand(def))
    console.log(`  [ok]   ${def.TableName} created`)
  }
}

createTables()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Failed:', err.message)
    process.exit(1)
  })
