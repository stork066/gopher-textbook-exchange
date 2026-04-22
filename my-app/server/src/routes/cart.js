const { Router } = require('express')
const { v4: uuidv4 } = require('uuid')
const { GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient } = require('../db/dynamodb')
const { requireAuth } = require('../middleware/auth')

const router = Router()

async function getCart(userId) {
  const result = await docClient.send(
    new GetCommand({ TableName: 'Carts', Key: { user_id: userId } })
  )
  return result.Item || { user_id: userId, items: [] }
}

// GET /api/cart
router.get('/', requireAuth, async (req, res) => {
  try {
    const cart = await getCart(req.user.user_id)

    // Hydrate listing details
    const hydratedItems = []
    for (const item of cart.items || []) {
      const listingResult = await docClient.send(
        new GetCommand({ TableName: 'Listings', Key: { listing_id: item.listing_id } })
      )
      if (listingResult.Item) {
        hydratedItems.push({
          ...item,
          listing: listingResult.Item,
        })
      }
    }

    res.json({ items: hydratedItems })
  } catch (err) {
    console.error('GET /api/cart error:', err.message)
    res.status(500).json({ error: 'Failed to fetch cart' })
  }
})

// POST /api/cart/items — add listing to cart
router.post('/items', requireAuth, async (req, res) => {
  const { listing_id } = req.body
  if (!listing_id) return res.status(400).json({ error: 'listing_id required' })

  try {
    // Verify listing exists and is available
    const listingResult = await docClient.send(
      new GetCommand({ TableName: 'Listings', Key: { listing_id } })
    )
    if (!listingResult.Item) return res.status(404).json({ error: 'Listing not found' })
    if (listingResult.Item.status !== 'Available') {
      return res.status(400).json({ error: 'Listing is not available' })
    }
    if (listingResult.Item.seller_id === req.user.user_id) {
      return res.status(400).json({ error: 'You cannot add your own listing to cart' })
    }

    const cart = await getCart(req.user.user_id)
    const items = cart.items || []

    // Check if already in cart
    if (items.some((i) => i.listing_id === listing_id)) {
      return res.status(400).json({ error: 'Already in cart' })
    }

    items.push({ listing_id, added_at: new Date().toISOString() })

    await docClient.send(
      new PutCommand({
        TableName: 'Carts',
        Item: { user_id: req.user.user_id, items },
      })
    )

    res.status(201).json({ message: 'Added to cart', item_count: items.length })
  } catch (err) {
    console.error('POST /api/cart/items error:', err.message)
    res.status(500).json({ error: 'Failed to add to cart' })
  }
})

// DELETE /api/cart/items/:listing_id
router.delete('/items/:listing_id', requireAuth, async (req, res) => {
  try {
    const cart = await getCart(req.user.user_id)
    const items = (cart.items || []).filter((i) => i.listing_id !== req.params.listing_id)

    await docClient.send(
      new PutCommand({
        TableName: 'Carts',
        Item: { user_id: req.user.user_id, items },
      })
    )

    res.json({ message: 'Removed from cart', item_count: items.length })
  } catch (err) {
    console.error('DELETE /api/cart/items error:', err.message)
    res.status(500).json({ error: 'Failed to remove from cart' })
  }
})

// POST /api/cart/checkout — buy all items in cart
router.post('/checkout', requireAuth, async (req, res) => {
  const buyerId = req.user.user_id

  try {
    const cart = await getCart(buyerId)
    const items = cart.items || []
    if (items.length === 0) return res.status(400).json({ error: 'Cart is empty' })

    const now = new Date().toISOString()
    const transactions = []
    const errors = []

    for (const item of items) {
      const listingResult = await docClient.send(
        new GetCommand({ TableName: 'Listings', Key: { listing_id: item.listing_id } })
      )
      const listing = listingResult.Item
      if (!listing || listing.status !== 'Available') {
        errors.push({ listing_id: item.listing_id, reason: 'No longer available' })
        continue
      }

      // Mark as Sold
      await docClient.send(
        new UpdateCommand({
          TableName: 'Listings',
          Key: { listing_id: item.listing_id },
          UpdateExpression: 'SET #s = :status, updated_at = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':status': 'Sold', ':now': now },
        })
      )

      const txn = {
        transaction_id: uuidv4(),
        listing_id: item.listing_id,
        buyer_id: buyerId,
        seller_id: listing.seller_id,
        amount: listing.price,
        listing_title: listing.textbook_title,
        type: 'cart_checkout',
        created_at: now,
      }
      await docClient.send(new PutCommand({ TableName: 'Transactions', Item: txn }))
      transactions.push(txn)
    }

    // Clear cart
    await docClient.send(
      new PutCommand({ TableName: 'Carts', Item: { user_id: buyerId, items: [] } })
    )

    res.json({ transactions, errors })
  } catch (err) {
    console.error('POST /api/cart/checkout error:', err.message)
    res.status(500).json({ error: 'Checkout failed' })
  }
})

module.exports = router
