const { Router } = require('express')
const { body, validationResult } = require('express-validator')
const { QueryCommand, GetCommand, PutCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb')
const { v4: uuidv4 } = require('uuid')
const { docClient } = require('../db/dynamodb')
const { requireAuth, optionalAuth } = require('../middleware/auth')

const router = Router()

const VALID_CONDITIONS = ['New', 'Like New', 'Good', 'Acceptable']
const VALID_STATUSES = ['Available', 'Pending', 'Sold']

function handleValidation(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  return null
}

// GET /api/listings
router.get('/', async (req, res) => {
  const { department, course_number, status = 'Available', sort = 'newest', seller_id } = req.query

  try {
    let items

    if (seller_id) {
      const result = await docClient.send(
        new QueryCommand({
          TableName: 'Listings',
          IndexName: 'SellerListingsIndex',
          KeyConditionExpression: 'seller_id = :sid',
          ExpressionAttributeValues: { ':sid': seller_id },
          ScanIndexForward: false,
        })
      )
      items = result.Items
      if (status) {
        items = items.filter((i) => i.status === status)
      }
    } else if (department) {
      const params = {
        TableName: 'Listings',
        IndexName: 'DepartmentCourseIndex',
        KeyConditionExpression: 'course_department = :dept',
        ExpressionAttributeValues: { ':dept': department },
      }

      if (course_number) {
        params.KeyConditionExpression += ' AND course_number = :cn'
        params.ExpressionAttributeValues[':cn'] = course_number
      }

      if (status) {
        params.FilterExpression = '#s = :status'
        params.ExpressionAttributeNames = { '#s': 'status' }
        params.ExpressionAttributeValues[':status'] = status
      }

      const result = await docClient.send(new QueryCommand(params))
      items = result.Items
    } else {
      const result = await docClient.send(
        new QueryCommand({
          TableName: 'Listings',
          IndexName: 'StatusCreatedIndex',
          KeyConditionExpression: '#s = :status',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':status': status },
          ScanIndexForward: false,
        })
      )
      items = result.Items
    }

    if (sort === 'price_asc') {
      items.sort((a, b) => a.price - b.price)
    } else if (sort === 'price_desc') {
      items.sort((a, b) => b.price - a.price)
    }

    res.json(items)
  } catch (err) {
    console.error('GET /api/listings error:', err.message)
    res.status(500).json({ error: 'Failed to fetch listings' })
  }
})

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: 'Listings', Key: { listing_id: req.params.id } })
    )
    if (!result.Item) return res.status(404).json({ error: 'Listing not found' })
    res.json(result.Item)
  } catch (err) {
    console.error('GET /api/listings/:id error:', err.message)
    res.status(500).json({ error: 'Failed to fetch listing' })
  }
})

// POST /api/listings — requires auth
router.post(
  '/',
  requireAuth,
  [
    body('course_department').notEmpty(),
    body('course_number').notEmpty(),
    body('textbook_title').notEmpty(),
    body('price').isFloat({ gt: 0 }).withMessage('price must be a positive number'),
    body('condition').isIn(VALID_CONDITIONS).withMessage(`condition must be one of: ${VALID_CONDITIONS.join(', ')}`),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return

    const {
      course_department, course_number, textbook_title, author, edition,
      condition, price, description, image_url, image_urls, textbook_id,
    } = req.body

    const now = new Date().toISOString()
    const defaultImage = 'https://placehold.co/400x600?text=Textbook'
    const primaryImage = image_url || (image_urls && image_urls[0]) || defaultImage

    const listing = {
      listing_id: uuidv4(),
      course_department,
      course_number,
      textbook_title,
      author: author || '',
      edition: edition || '',
      condition,
      price: Number(price),
      seller_id: req.user.user_id,
      seller_name: req.user.display_name,
      seller_contact: req.user.email,
      description: description || '',
      image_url: primaryImage,
      image_urls: image_urls || [primaryImage],
      status: 'Available',
      created_at: now,
      updated_at: now,
    }

    if (textbook_id) listing.textbook_id = textbook_id

    try {
      await docClient.send(new PutCommand({ TableName: 'Listings', Item: listing }))
      res.status(201).json(listing)
    } catch (err) {
      console.error('POST /api/listings error:', err.message)
      res.status(500).json({ error: 'Failed to create listing' })
    }
  }
)

// PUT /api/listings/:id — requires auth + seller ownership
router.put(
  '/:id',
  requireAuth,
  [
    body('price').optional().isFloat({ gt: 0 }).withMessage('price must be a positive number'),
    body('condition').optional().isIn(VALID_CONDITIONS),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return

    try {
      const existing = await docClient.send(
        new GetCommand({ TableName: 'Listings', Key: { listing_id: req.params.id } })
      )
      if (!existing.Item) return res.status(404).json({ error: 'Listing not found' })
      if (existing.Item.seller_id !== req.user.user_id) {
        return res.status(403).json({ error: 'You can only edit your own listings' })
      }

      const UPDATABLE = [
        'textbook_title', 'author', 'edition', 'condition',
        'price', 'description', 'image_url', 'image_urls',
        'course_department', 'course_number', 'textbook_id',
      ]

      const updates = Object.fromEntries(
        Object.entries(req.body).filter(([k]) => UPDATABLE.includes(k))
      )

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided' })
      }

      updates.updated_at = new Date().toISOString()

      const ExpressionAttributeNames = {}
      const ExpressionAttributeValues = {}
      const setParts = []

      for (const [key, val] of Object.entries(updates)) {
        const nameToken = `#${key}`
        const valToken = `:${key}`
        ExpressionAttributeNames[nameToken] = key
        ExpressionAttributeValues[valToken] = val
        setParts.push(`${nameToken} = ${valToken}`)
      }

      const result = await docClient.send(
        new UpdateCommand({
          TableName: 'Listings',
          Key: { listing_id: req.params.id },
          UpdateExpression: `SET ${setParts.join(', ')}`,
          ExpressionAttributeNames,
          ExpressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        })
      )
      res.json(result.Attributes)
    } catch (err) {
      console.error('PUT /api/listings/:id error:', err.message)
      res.status(500).json({ error: 'Failed to update listing' })
    }
  }
)

// PUT /api/listings/:id/status — change listing status
router.put('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` })
  }

  try {
    const existing = await docClient.send(
      new GetCommand({ TableName: 'Listings', Key: { listing_id: req.params.id } })
    )
    if (!existing.Item) return res.status(404).json({ error: 'Listing not found' })
    if (existing.Item.seller_id !== req.user.user_id) {
      return res.status(403).json({ error: 'You can only update your own listings' })
    }

    const result = await docClient.send(
      new UpdateCommand({
        TableName: 'Listings',
        Key: { listing_id: req.params.id },
        UpdateExpression: 'SET #s = :status, updated_at = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': status, ':now': new Date().toISOString() },
        ReturnValues: 'ALL_NEW',
      })
    )
    res.json(result.Attributes)
  } catch (err) {
    console.error('PUT /api/listings/:id/status error:', err.message)
    res.status(500).json({ error: 'Failed to update status' })
  }
})

// DELETE /api/listings/:id — requires auth + seller ownership
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await docClient.send(
      new GetCommand({ TableName: 'Listings', Key: { listing_id: req.params.id } })
    )
    if (!existing.Item) return res.status(404).json({ error: 'Listing not found' })
    if (existing.Item.seller_id !== req.user.user_id) {
      return res.status(403).json({ error: 'You can only delete your own listings' })
    }

    await docClient.send(
      new DeleteCommand({ TableName: 'Listings', Key: { listing_id: req.params.id } })
    )
    res.json({ message: 'Listing deleted' })
  } catch (err) {
    console.error('DELETE /api/listings/:id error:', err.message)
    res.status(500).json({ error: 'Failed to delete listing' })
  }
})

module.exports = router
