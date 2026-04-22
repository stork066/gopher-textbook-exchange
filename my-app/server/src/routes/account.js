const { Router } = require('express')
const { body, validationResult } = require('express-validator')
const { QueryCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient } = require('../db/dynamodb')
const { requireAuth } = require('../middleware/auth')

const router = Router()

// GET /api/account/listings — seller's own listings
router.get('/listings', requireAuth, async (req, res) => {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: 'Listings',
        IndexName: 'SellerListingsIndex',
        KeyConditionExpression: 'seller_id = :sid',
        ExpressionAttributeValues: { ':sid': req.user.user_id },
        ScanIndexForward: false,
      })
    )
    res.json(result.Items || [])
  } catch (err) {
    console.error('GET /api/account/listings error:', err.message)
    res.status(500).json({ error: 'Failed to fetch listings' })
  }
})

// GET /api/account/purchases — items bought
router.get('/purchases', requireAuth, async (req, res) => {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: 'Transactions',
        IndexName: 'BuyerTransactionsIndex',
        KeyConditionExpression: 'buyer_id = :bid',
        ExpressionAttributeValues: { ':bid': req.user.user_id },
        ScanIndexForward: false,
      })
    )
    res.json(result.Items || [])
  } catch (err) {
    console.error('GET /api/account/purchases error:', err.message)
    res.status(500).json({ error: 'Failed to fetch purchases' })
  }
})

// GET /api/account/sales — items sold
router.get('/sales', requireAuth, async (req, res) => {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: 'Transactions',
        IndexName: 'SellerTransactionsIndex',
        KeyConditionExpression: 'seller_id = :sid',
        ExpressionAttributeValues: { ':sid': req.user.user_id },
        ScanIndexForward: false,
      })
    )
    res.json(result.Items || [])
  } catch (err) {
    console.error('GET /api/account/sales error:', err.message)
    res.status(500).json({ error: 'Failed to fetch sales' })
  }
})

// GET /api/account/stats — dashboard overview
router.get('/stats', requireAuth, async (req, res) => {
  const userId = req.user.user_id

  try {
    const [listings, purchases, sales] = await Promise.all([
      docClient.send(
        new QueryCommand({
          TableName: 'Listings',
          IndexName: 'SellerListingsIndex',
          KeyConditionExpression: 'seller_id = :sid',
          ExpressionAttributeValues: { ':sid': userId },
        })
      ),
      docClient.send(
        new QueryCommand({
          TableName: 'Transactions',
          IndexName: 'BuyerTransactionsIndex',
          KeyConditionExpression: 'buyer_id = :bid',
          ExpressionAttributeValues: { ':bid': userId },
        })
      ),
      docClient.send(
        new QueryCommand({
          TableName: 'Transactions',
          IndexName: 'SellerTransactionsIndex',
          KeyConditionExpression: 'seller_id = :sid',
          ExpressionAttributeValues: { ':sid': userId },
        })
      ),
    ])

    const listingItems = listings.Items || []
    const active = listingItems.filter((l) => l.status === 'Available').length
    const sold = listingItems.filter((l) => l.status === 'Sold').length
    const totalEarned = (sales.Items || []).reduce((sum, t) => sum + (t.amount || 0), 0)
    const totalSpent = (purchases.Items || []).reduce((sum, t) => sum + (t.amount || 0), 0)

    res.json({
      active_listings: active,
      sold_listings: sold,
      total_listings: listingItems.length,
      purchases: (purchases.Items || []).length,
      sales: (sales.Items || []).length,
      total_earned: totalEarned,
      total_spent: totalSpent,
    })
  } catch (err) {
    console.error('GET /api/account/stats error:', err.message)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// PUT /api/account/profile — update display name
router.put(
  '/profile',
  requireAuth,
  [body('display_name').notEmpty().withMessage('Display name is required')],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: 'Users',
          Key: { user_id: req.user.user_id },
          UpdateExpression: 'SET display_name = :dn, updated_at = :now',
          ExpressionAttributeValues: {
            ':dn': req.body.display_name,
            ':now': new Date().toISOString(),
          },
          ReturnValues: 'ALL_NEW',
        })
      )
      const { user_id, email, display_name, created_at } = result.Attributes
      res.json({ user: { user_id, email, display_name, created_at } })
    } catch (err) {
      console.error('PUT /api/account/profile error:', err.message)
      res.status(500).json({ error: 'Failed to update profile' })
    }
  }
)

module.exports = router
