const { Router } = require('express')
const { v4: uuidv4 } = require('uuid')
const { GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient } = require('../db/dynamodb')
const { requireAuth } = require('../middleware/auth')

const router = Router()

// POST /api/listings/:id/buy-now
router.post('/:id/buy-now', requireAuth, async (req, res) => {
  const buyerId = req.user.user_id

  try {
    const listingResult = await docClient.send(
      new GetCommand({ TableName: 'Listings', Key: { listing_id: req.params.id } })
    )
    if (!listingResult.Item) return res.status(404).json({ error: 'Listing not found' })

    const listing = listingResult.Item
    if (listing.status !== 'Available') {
      return res.status(400).json({ error: 'Listing is no longer available' })
    }
    if (listing.seller_id === buyerId) {
      return res.status(400).json({ error: 'You cannot buy your own listing' })
    }

    const now = new Date().toISOString()

    // Mark listing as Sold
    await docClient.send(
      new UpdateCommand({
        TableName: 'Listings',
        Key: { listing_id: req.params.id },
        UpdateExpression: 'SET #s = :status, updated_at = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': 'Sold', ':now': now },
      })
    )

    // Create transaction record
    const transaction = {
      transaction_id: uuidv4(),
      listing_id: req.params.id,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      amount: listing.price,
      listing_title: listing.textbook_title,
      type: 'buy_now',
      created_at: now,
    }
    await docClient.send(new PutCommand({ TableName: 'Transactions', Item: transaction }))

    res.status(201).json({ transaction })
  } catch (err) {
    console.error('POST /api/listings/:id/buy-now error:', err.message)
    res.status(500).json({ error: 'Purchase failed' })
  }
})

module.exports = router
