const { Router } = require('express')
const { body, validationResult } = require('express-validator')
const { PutCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { v4: uuidv4 } = require('uuid')
const { docClient } = require('../db/dynamodb')

const router = Router()

const VALID_OFFER_STATUSES = ['Pending', 'Accepted', 'Rejected']

function handleValidation(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() })
  }
  return null
}

// POST /api/offers
router.post(
  '/',
  [
    body('listing_id').notEmpty(),
    body('buyer_name').notEmpty(),
    body('buyer_contact').notEmpty(),
    body('offer_amount').isFloat({ gt: 0 }).withMessage('offer_amount must be a positive number'),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return

    const { listing_id, buyer_name, buyer_contact, offer_amount, message } = req.body

    // Verify listing exists
    try {
      const listing = await docClient.send(
        new GetCommand({ TableName: 'Listings', Key: { listing_id } })
      )
      if (!listing.Item) return res.status(404).json({ error: 'Listing not found' })
    } catch (err) {
      console.error('POST /api/offers listing lookup error:', err.message)
      return res.status(500).json({ error: 'Failed to verify listing' })
    }

    const offer = {
      offer_id: uuidv4(),
      listing_id,
      buyer_name,
      buyer_contact,
      offer_amount: Number(offer_amount),
      message: message || '',
      status: 'Pending',
      created_at: new Date().toISOString(),
    }

    try {
      await docClient.send(new PutCommand({ TableName: 'Offers', Item: offer }))
      res.status(201).json(offer)
    } catch (err) {
      console.error('POST /api/offers error:', err.message)
      res.status(500).json({ error: 'Failed to create offer' })
    }
  }
)

// GET /api/offers?listing_id=xxx
router.get('/', async (req, res) => {
  const { listing_id } = req.query
  if (!listing_id) {
    return res.status(400).json({ error: 'listing_id query parameter is required' })
  }

  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: 'Offers',
        IndexName: 'ListingOffersIndex',
        KeyConditionExpression: 'listing_id = :lid',
        ExpressionAttributeValues: { ':lid': listing_id },
        ScanIndexForward: true, // oldest first — seller sees offers in order received
      })
    )
    res.json(result.Items)
  } catch (err) {
    console.error('GET /api/offers error:', err.message)
    res.status(500).json({ error: 'Failed to fetch offers' })
  }
})

// PUT /api/offers/:id
router.put(
  '/:id',
  [
    body('status')
      .isIn(VALID_OFFER_STATUSES)
      .withMessage(`status must be one of: ${VALID_OFFER_STATUSES.join(', ')}`),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return

    const { status } = req.body

    try {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: 'Offers',
          Key: { offer_id: req.params.id },
          UpdateExpression: 'SET #s = :status',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':status': status },
          ReturnValues: 'ALL_NEW',
        })
      )
      res.json(result.Attributes)
    } catch (err) {
      console.error('PUT /api/offers/:id error:', err.message)
      res.status(500).json({ error: 'Failed to update offer' })
    }
  }
)

module.exports = router
