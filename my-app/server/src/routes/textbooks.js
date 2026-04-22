const { Router } = require('express')
const { body, validationResult } = require('express-validator')
const { v4: uuidv4 } = require('uuid')
const { ScanCommand, GetCommand, PutCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient } = require('../db/dynamodb')
const { requireAuth } = require('../middleware/auth')

const router = Router()

// GET /api/textbooks/search?q=calculus
router.get('/search', async (req, res) => {
  const { q } = req.query
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' })
  }

  try {
    const result = await docClient.send(
      new ScanCommand({ TableName: 'Textbooks' })
    )
    const lower = q.toLowerCase()
    const matches = (result.Items || []).filter(
      (t) =>
        t.title.toLowerCase().includes(lower) ||
        t.author.toLowerCase().includes(lower) ||
        t.isbn.includes(q)
    )
    res.json(matches)
  } catch (err) {
    console.error('GET /api/textbooks/search error:', err.message)
    res.status(500).json({ error: 'Search failed' })
  }
})

// GET /api/textbooks — browse all
router.get('/', async (req, res) => {
  try {
    const result = await docClient.send(
      new ScanCommand({ TableName: 'Textbooks' })
    )
    res.json(result.Items || [])
  } catch (err) {
    console.error('GET /api/textbooks error:', err.message)
    res.status(500).json({ error: 'Failed to fetch textbooks' })
  }
})

// GET /api/textbooks/:id — single textbook with its listings
router.get('/:id', async (req, res) => {
  try {
    const tbResult = await docClient.send(
      new GetCommand({ TableName: 'Textbooks', Key: { textbook_id: req.params.id } })
    )
    if (!tbResult.Item) return res.status(404).json({ error: 'Textbook not found' })

    // Fetch available listings for this textbook
    const listingsResult = await docClient.send(
      new QueryCommand({
        TableName: 'Listings',
        IndexName: 'TextbookListingsIndex',
        KeyConditionExpression: 'textbook_id = :tid',
        FilterExpression: '#s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':tid': req.params.id, ':status': 'Available' },
        ScanIndexForward: false,
      })
    )

    res.json({
      ...tbResult.Item,
      listings: listingsResult.Items || [],
    })
  } catch (err) {
    console.error('GET /api/textbooks/:id error:', err.message)
    res.status(500).json({ error: 'Failed to fetch textbook' })
  }
})

// POST /api/textbooks — create a new textbook entry
router.post(
  '/',
  requireAuth,
  [
    body('isbn').notEmpty().withMessage('ISBN is required'),
    body('title').notEmpty().withMessage('Title is required'),
    body('author').notEmpty().withMessage('Author is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { isbn, title, author, edition, canonical_image_url } = req.body

    try {
      // Check if ISBN already exists
      const existing = await docClient.send(
        new QueryCommand({
          TableName: 'Textbooks',
          IndexName: 'IsbnIndex',
          KeyConditionExpression: 'isbn = :isbn',
          ExpressionAttributeValues: { ':isbn': isbn },
          Limit: 1,
        })
      )
      if (existing.Items && existing.Items.length > 0) {
        return res.json(existing.Items[0]) // return existing textbook
      }

      const textbook = {
        textbook_id: uuidv4(),
        isbn,
        title,
        author,
        edition: edition || '',
        canonical_image_url: canonical_image_url || '',
        created_by: req.user.user_id,
        created_at: new Date().toISOString(),
      }

      await docClient.send(new PutCommand({ TableName: 'Textbooks', Item: textbook }))
      res.status(201).json(textbook)
    } catch (err) {
      console.error('POST /api/textbooks error:', err.message)
      res.status(500).json({ error: 'Failed to create textbook' })
    }
  }
)

module.exports = router
