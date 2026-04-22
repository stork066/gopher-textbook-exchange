require('dotenv').config()
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')
const { BatchWriteCommand, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient } = require('./dynamodb')

const SALT_ROUNDS = 10
const IMAGE_BASE = '/images/listings'

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomTimestamp(maxDaysAgo = 30) {
  const now = Date.now()
  const msAgo = Math.random() * maxDaysAgo * 24 * 60 * 60 * 1000
  return new Date(now - msAgo).toISOString()
}

async function clearTable(tableName) {
  let lastKey
  let deleted = 0
  do {
    const result = await docClient.send(
      new ScanCommand({ TableName: tableName, ProjectionExpression: getPk(tableName), ExclusiveStartKey: lastKey })
    )
    const items = result.Items || []
    for (let i = 0; i < items.length; i += 25) {
      const chunk = items.slice(i, i + 25)
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: chunk.map((item) => ({
              DeleteRequest: { Key: item },
            })),
          },
        })
      )
      deleted += chunk.length
    }
    lastKey = result.LastEvaluatedKey
  } while (lastKey)
  return deleted
}

function getPk(tableName) {
  const pks = { Listings: 'listing_id', Users: 'user_id', Textbooks: 'textbook_id' }
  return pks[tableName] || 'id'
}

async function batchWrite(tableName, items) {
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25)
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((item) => ({ PutRequest: { Item: item } })),
        },
      })
    )
    console.log(`  Inserted batch ${Math.floor(i / 25) + 1} (${chunk.length} items) into ${tableName}`)
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────

const TEST_USERS = [
  { email: 'alice@umn.edu',  password: 'password123', display_name: 'Alice Johnson' },
  { email: 'bob@umn.edu',    password: 'password123', display_name: 'Bob Smith' },
  { email: 'caden@umn.edu',  password: 'password123', display_name: 'Caden Storkamp' },
]

async function seedUsers() {
  console.log('\nSeeding Users...')
  const users = await Promise.all(
    TEST_USERS.map(async (u) => ({
      user_id: uuidv4(),
      email: u.email,
      password_hash: await bcrypt.hash(u.password, SALT_ROUNDS),
      display_name: u.display_name,
      created_at: new Date().toISOString(),
    }))
  )
  await batchWrite('Users', users)
  users.forEach((u) => console.log(`  user_id for ${u.email}: ${u.user_id}`))
  return users
}

// ── Textbooks ─────────────────────────────────────────────────────────────────

function makeTextbooks(createdBy) {
  return [
    {
      textbook_id: uuidv4(),
      isbn: '9780072467659',
      title: 'Introduction to Computing Using Python',
      author: 'Ljubomir Perkovic',
      edition: '2nd',
      canonical_image_url: 'https://placehold.co/400x600?text=Computing+Python',
      created_by: createdBy,
      created_at: new Date().toISOString(),
    },
    {
      textbook_id: uuidv4(),
      isbn: '9781285741550',
      title: 'Calculus: Early Transcendentals',
      author: 'James Stewart',
      edition: '8th',
      canonical_image_url: 'https://placehold.co/400x600?text=Calculus',
      created_by: createdBy,
      created_at: new Date().toISOString(),
    },
    {
      textbook_id: uuidv4(),
      isbn: '9781259726705',
      title: 'Financial and Managerial Accounting',
      author: 'Jan Williams, Sue Haka, Mark Bettner',
      edition: '18th',
      canonical_image_url: 'https://placehold.co/400x600?text=Accounting',
      created_by: createdBy,
      created_at: new Date().toISOString(),
    },
    {
      textbook_id: uuidv4(),
      isbn: '9781305585126',
      title: 'Principles of Economics',
      author: 'N. Gregory Mankiw',
      edition: '8th',
      canonical_image_url: 'https://placehold.co/400x600?text=Economics',
      created_by: createdBy,
      created_at: new Date().toISOString(),
    },
    {
      textbook_id: uuidv4(),
      isbn: '9780321971371',
      title: 'Organic Chemistry',
      author: 'Paula Bruice',
      edition: '8th',
      canonical_image_url: 'https://placehold.co/400x600?text=Organic+Chemistry',
      created_by: createdBy,
      created_at: new Date().toISOString(),
    },
  ]
}

// Fuzzy match listing title against textbook catalog
function matchTextbook(listingTitle, textbooks) {
  const lower = listingTitle.toLowerCase()
  for (const tb of textbooks) {
    const tbLower = tb.title.toLowerCase()
    // Check if meaningful words overlap
    const tbWords = tbLower.split(/\s+/).filter((w) => w.length > 4)
    const matches = tbWords.filter((w) => lower.includes(w))
    if (matches.length >= 2) return tb.textbook_id
  }
  return null
}

// ── Listings ──────────────────────────────────────────────────────────────────

async function seedListings(users, textbooks) {
  console.log('\nClearing Listings table...')
  const deleted = await clearTable('Listings')
  console.log(`  Deleted ${deleted} existing listings`)

  const dataPath = path.join(__dirname, '../../data/listings.json')
  const raw = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
  console.log(`\nSeeding ${raw.length} Listings...`)

  const sellerIds = users.map((u) => u.user_id)

  const items = raw.map((entry) => {
    const ts = randomTimestamp(30)
    const imageUrl = `${IMAGE_BASE}/${entry.image_filename}`
    const sellerId = sellerIds[Math.floor(Math.random() * sellerIds.length)]
    const textbookId = matchTextbook(entry.textbook_title, textbooks)

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
      image_url: imageUrl,
      image_urls: [imageUrl],
      seller_id: sellerId,
      ...(textbookId ? { textbook_id: textbookId } : {}),
      status: 'Available',
      created_at: ts,
      updated_at: ts,
    }
  })

  await batchWrite('Listings', items)
  return items
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log('=== seedV2: Seeding test data ===')

  const users = await seedUsers()

  console.log('\nSeeding Textbooks...')
  const textbooks = makeTextbooks(users[0].user_id)
  await batchWrite('Textbooks', textbooks)
  textbooks.forEach((t) => console.log(`  textbook_id for "${t.title}": ${t.textbook_id}`))

  const listings = await seedListings(users, textbooks)

  console.log(`\n=== Done ===`)
  console.log(`  Users:     ${users.length}`)
  console.log(`  Textbooks: ${textbooks.length}`)
  console.log(`  Listings:  ${listings.length}`)
}

run().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
