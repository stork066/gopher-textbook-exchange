const { Router } = require('express')
const { v4: uuidv4 } = require('uuid')
const {
  GetCommand, PutCommand, UpdateCommand, QueryCommand,
} = require('@aws-sdk/lib-dynamodb')
const { docClient } = require('../db/dynamodb')
const { requireAuth } = require('../middleware/auth')

const router = Router()

async function getCart(userId) {
  const result = await docClient.send(
    new GetCommand({ TableName: 'Carts', Key: { user_id: userId } })
  )
  return result.Item || { user_id: userId, items: [] }
}

// Walk a conversation's messages newest-first; return the type of the latest
// unresolved offer/counter/buy_now, or null if the most recent action was an
// accept/decline (request resolved) or there are no requests at all.
async function getLatestPendingType(conversationId) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: 'Messages',
      IndexName: 'ConversationMessagesIndex',
      KeyConditionExpression: 'conversation_id = :cid',
      ExpressionAttributeValues: { ':cid': conversationId },
      ScanIndexForward: false,
    })
  )
  for (const m of result.Items || []) {
    if (m.type === 'accept' || m.type === 'decline') return null
    if (m.type === 'offer' || m.type === 'counter' || m.type === 'buy_now') return m.type
  }
  return null
}

// GET /api/cart — returns hydrated items with derived status:
//   in_cart      — no Buy Now sent yet, or a previous one was declined
//   pending      — Buy Now sent, awaiting seller response
//   purchased    — seller accepted this buyer's request
//   unavailable  — listing flipped to Pending/Sold for someone else
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.user_id
    const cart = await getCart(userId)
    const cartItems = cart.items || []

    // Fetch all of this buyer's conversations once, then index by listing_id.
    const buyerConvos = await docClient.send(
      new QueryCommand({
        TableName: 'Conversations',
        IndexName: 'BuyerConversationsIndex',
        KeyConditionExpression: 'buyer_id = :bid',
        ExpressionAttributeValues: { ':bid': userId },
      })
    )
    const convoByListing = new Map()
    for (const c of buyerConvos.Items || []) convoByListing.set(c.listing_id, c)

    const hydratedItems = []
    for (const item of cartItems) {
      const listingResult = await docClient.send(
        new GetCommand({ TableName: 'Listings', Key: { listing_id: item.listing_id } })
      )
      const listing = listingResult.Item
      if (!listing) continue

      const convo = convoByListing.get(item.listing_id)
      let status = 'in_cart'
      let conversation_id = null

      if (convo) {
        conversation_id = convo.conversation_id
        if (convo.status === 'accepted' || convo.status === 'completed') {
          status = 'purchased'
        } else if (listing.status !== 'Available') {
          status = 'unavailable'
        } else {
          const pending = await getLatestPendingType(convo.conversation_id)
          if (pending === 'buy_now') status = 'pending'
        }
      } else if (listing.status !== 'Available') {
        status = 'unavailable'
      }

      hydratedItems.push({ ...item, listing, status, conversation_id })
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

// Send a Buy Now request for one listing on behalf of the buyer.
// Mirrors POST /api/conversations with is_buy_now: true. Does not touch the
// listing or create transactions — listing flips to Pending only when the
// seller accepts.
async function sendBuyNowForListing({ buyerId, buyerName, listingId }) {
  const listingResult = await docClient.send(
    new GetCommand({ TableName: 'Listings', Key: { listing_id: listingId } })
  )
  const listing = listingResult.Item
  if (!listing) return { ok: false, listing_id: listingId, reason: 'Listing not found' }
  if (listing.status !== 'Available') {
    return { ok: false, listing_id: listingId, reason: 'No longer available' }
  }
  if (listing.seller_id === buyerId) {
    return { ok: false, listing_id: listingId, reason: 'Cannot buy your own listing' }
  }

  const buyerConvos = await docClient.send(
    new QueryCommand({
      TableName: 'Conversations',
      IndexName: 'BuyerConversationsIndex',
      KeyConditionExpression: 'buyer_id = :bid',
      ExpressionAttributeValues: { ':bid': buyerId },
    })
  )
  const existingConvo = (buyerConvos.Items || []).find((c) => c.listing_id === listingId)

  const now = new Date().toISOString()
  const price = Number(listing.price)
  let conversationId

  if (existingConvo) {
    conversationId = existingConvo.conversation_id
    const pending = await getLatestPendingType(conversationId)
    if (pending === 'buy_now') {
      return {
        ok: false,
        listing_id: listingId,
        reason: 'Already has a pending Buy Now request',
        conversation_id: conversationId,
      }
    }
    await docClient.send(
      new UpdateCommand({
        TableName: 'Conversations',
        Key: { conversation_id: conversationId },
        UpdateExpression: 'SET last_message_at = :now',
        ExpressionAttributeValues: { ':now': now },
      })
    )
  } else {
    conversationId = uuidv4()
    await docClient.send(
      new PutCommand({
        TableName: 'Conversations',
        Item: {
          conversation_id: conversationId,
          listing_id: listingId,
          buyer_id: buyerId,
          seller_id: listing.seller_id,
          listing_title: listing.textbook_title,
          listing_price: listing.price,
          buyer_name: buyerName,
          seller_name: listing.seller_name,
          last_message_at: now,
          created_at: now,
        },
      })
    )
  }

  const msg = {
    message_id: uuidv4(),
    conversation_id: conversationId,
    sender_id: buyerId,
    sender_name: buyerName,
    body: `Buy Now request: I'd like to purchase this textbook at the listed price of $${price.toFixed(2)}.`,
    type: 'buy_now',
    offer_amount: price,
    created_at: now,
  }
  await docClient.send(new PutCommand({ TableName: 'Messages', Item: msg }))

  return { ok: true, listing_id: listingId, conversation_id: conversationId, message_id: msg.message_id }
}

// POST /api/cart/checkout — send a Buy Now request for every cart item.
// Cart contents are NOT cleared — items stay so the buyer can track status.
router.post('/checkout', requireAuth, async (req, res) => {
  const buyerId = req.user.user_id
  const buyerName = req.user.display_name

  try {
    const cart = await getCart(buyerId)
    const items = cart.items || []
    if (items.length === 0) return res.status(400).json({ error: 'Cart is empty' })

    const sent = []
    const skipped = []

    for (const item of items) {
      const result = await sendBuyNowForListing({
        buyerId,
        buyerName,
        listingId: item.listing_id,
      })
      if (result.ok) sent.push(result)
      else skipped.push(result)
    }

    res.json({ sent, skipped })
  } catch (err) {
    console.error('POST /api/cart/checkout error:', err.message)
    res.status(500).json({ error: 'Checkout failed' })
  }
})

module.exports = router
