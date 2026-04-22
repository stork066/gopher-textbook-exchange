require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { BatchWriteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb')
const { v4: uuidv4 } = require('uuid')
const { docClient } = require('./dynamodb')

const TABLE = 'Listings'
const IMAGE_BASE = '/images/listings'
const DATA_PATH = path.join(__dirname, '../../data/listings.json')
const CLEAR = process.argv.includes('--clear')

// Random timestamp within the last `maxDaysAgo` days
function randomTimestamp(maxDaysAgo = 30) {
  const now = Date.now()
  const msAgo = Math.random() * maxDaysAgo * 24 * 60 * 60 * 1000
  return new Date(now - msAgo).toISOString()
}

async function clearTable() {
  console.log('Clearing existing Listings...')
  let lastKey
  let deleted = 0
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE,
        ProjectionExpression: 'listing_id',
        ExclusiveStartKey: lastKey,
      })
    )
    const items = result.Items || []
    if (items.length === 0) break

    // BatchWrite deletes in chunks of 25
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25)
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE]: chunk.map((item) => ({
              DeleteRequest: { Key: { listing_id: item.listing_id } },
            })),
          },
        })
      )
      deleted += chunk.length
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  console.log(`  [ok] Deleted ${deleted} existing listings`)
}

async function seed() {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))

  if (CLEAR) {
    await clearTable()
  }

  const items = raw.map((entry) => {
    const ts = randomTimestamp()
    return {
      listing_id: uuidv4(),
      course_department: entry.course_department,
      course_number: entry.course_number,
      textbook_title: entry.textbook_title,
      author: entry.author || '',
      edition: entry.edition || '',
      condition: entry.condition,
      price: Number(entry.price),
      seller_name: entry.seller_name,
      seller_contact: entry.seller_contact,
      description: entry.description || '',
      image_url: `${IMAGE_BASE}/${entry.image_filename}`,
      status: 'Available',
      created_at: ts,
      updated_at: ts,
    }
  })

  let inserted = 0
  let batchNum = 0

  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25)
    batchNum++
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE]: chunk.map((item) => ({ PutRequest: { Item: item } })),
        },
      })
    )
    inserted += chunk.length
    console.log(`  Inserted batch ${batchNum} (${chunk.length} listings)`)
  }

  console.log(`Done. ${inserted} total listings.`)
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
