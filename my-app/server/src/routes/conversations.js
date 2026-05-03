const { Router } = require('express')
const { body, validationResult } = require('express-validator')
const { v4: uuidv4 } = require('uuid')
const {
  QueryCommand, GetCommand, PutCommand, UpdateCommand,
} = require('@aws-sdk/lib-dynamodb')
const { docClient } = require('../db/dynamodb')
const { requireAuth } = require('../middleware/auth')

const router = Router()

// POST /api/conversations — start or resume a conversation about a listing
router.post(
  '/',
  requireAuth,
  [body('listing_id').notEmpty(), body('message').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { listing_id, message, offer_amount, is_buy_now } = req.body
    const buyerId = req.user.user_id

    try {
      // Get the listing to find the seller
      const listingResult = await docClient.send(
        new GetCommand({ TableName: 'Listings', Key: { listing_id } })
      )
      if (!listingResult.Item) return res.status(404).json({ error: 'Listing not found' })

      const listing = listingResult.Item
      if (listing.seller_id === buyerId) {
        return res.status(400).json({ error: 'You cannot message yourself' })
      }

      // Check if conversation already exists between buyer and seller for this listing
      const buyerConvos = await docClient.send(
        new QueryCommand({
          TableName: 'Conversations',
          IndexName: 'BuyerConversationsIndex',
          KeyConditionExpression: 'buyer_id = :bid',
          ExpressionAttributeValues: { ':bid': buyerId },
        })
      )
      const existingConvo = (buyerConvos.Items || []).find(
        (c) => c.listing_id === listing_id
      )

      let conversationId
      const now = new Date().toISOString()

      const newType = is_buy_now ? 'buy_now' : (offer_amount ? 'offer' : 'text')

      if (existingConvo) {
        conversationId = existingConvo.conversation_id

        // Throttle: at most one pending offer/counter/buy_now per listing.
        // Buy Now may override a pending offer/counter, but not another buy_now.
        if (newType === 'offer' || newType === 'buy_now') {
          const pending = await getLatestPendingType(conversationId)
          if (newType === 'offer' && pending) {
            return res.status(409).json({
              error: pending === 'buy_now'
                ? 'You already have a pending Buy Now request on this listing.'
                : 'You already have a pending offer on this listing.',
            })
          }
          if (newType === 'buy_now' && pending === 'buy_now') {
            return res.status(409).json({
              error: 'You already have a pending Buy Now request on this listing.',
            })
          }
        }

        // Update last_message_at
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
        const conversation = {
          conversation_id: conversationId,
          listing_id,
          buyer_id: buyerId,
          seller_id: listing.seller_id,
          listing_title: listing.textbook_title,
          listing_price: listing.price,
          buyer_name: req.user.display_name,
          seller_name: listing.seller_name,
          last_message_at: now,
          created_at: now,
        }
        await docClient.send(new PutCommand({ TableName: 'Conversations', Item: conversation }))
      }

      // Create the message
      const msg = {
        message_id: uuidv4(),
        conversation_id: conversationId,
        sender_id: buyerId,
        sender_name: req.user.display_name,
        body: message,
        type: newType,
        created_at: now,
      }
      if (offer_amount) msg.offer_amount = Number(offer_amount)

      await docClient.send(new PutCommand({ TableName: 'Messages', Item: msg }))

      res.status(201).json({ conversation_id: conversationId, message: msg })
    } catch (err) {
      console.error('POST /api/conversations error:', err.message)
      res.status(500).json({ error: 'Failed to create conversation' })
    }
  }
)

// GET /api/conversations — list user's conversations
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.user_id

  try {
    // Get conversations where user is buyer
    const buyerResult = await docClient.send(
      new QueryCommand({
        TableName: 'Conversations',
        IndexName: 'BuyerConversationsIndex',
        KeyConditionExpression: 'buyer_id = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
      })
    )

    // Get conversations where user is seller
    const sellerResult = await docClient.send(
      new QueryCommand({
        TableName: 'Conversations',
        IndexName: 'SellerConversationsIndex',
        KeyConditionExpression: 'seller_id = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
      })
    )

    const all = [...(buyerResult.Items || []), ...(sellerResult.Items || [])]
    all.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))

    // Add unread flag based on last_read_at
    const conversations = all.map((c) => {
      const lastReadKey = c.buyer_id === userId ? 'buyer_last_read_at' : 'seller_last_read_at'
      const lastRead = c[lastReadKey] || c.created_at
      return {
        ...c,
        has_unread: c.last_message_at > lastRead,
        role: c.buyer_id === userId ? 'buyer' : 'seller',
      }
    })

    res.json(conversations)
  } catch (err) {
    console.error('GET /api/conversations error:', err.message)
    res.status(500).json({ error: 'Failed to fetch conversations' })
  }
})

// GET /api/conversations/unread-count
router.get('/unread-count', requireAuth, async (req, res) => {
  const userId = req.user.user_id

  try {
    const buyerResult = await docClient.send(
      new QueryCommand({
        TableName: 'Conversations',
        IndexName: 'BuyerConversationsIndex',
        KeyConditionExpression: 'buyer_id = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      })
    )
    const sellerResult = await docClient.send(
      new QueryCommand({
        TableName: 'Conversations',
        IndexName: 'SellerConversationsIndex',
        KeyConditionExpression: 'seller_id = :uid',
        ExpressionAttributeValues: { ':uid': userId },
      })
    )

    const all = [...(buyerResult.Items || []), ...(sellerResult.Items || [])]
    let count = 0
    for (const c of all) {
      const lastReadKey = c.buyer_id === userId ? 'buyer_last_read_at' : 'seller_last_read_at'
      const lastRead = c[lastReadKey] || c.created_at
      if (c.last_message_at > lastRead) count++
    }

    res.json({ count })
  } catch (err) {
    console.error('GET /api/conversations/unread-count error:', err.message)
    res.status(500).json({ error: 'Failed to fetch unread count' })
  }
})

// GET /api/conversations/:id — single conversation with messages
router.get('/:id', requireAuth, async (req, res) => {
  const userId = req.user.user_id

  try {
    const convoResult = await docClient.send(
      new GetCommand({ TableName: 'Conversations', Key: { conversation_id: req.params.id } })
    )
    if (!convoResult.Item) return res.status(404).json({ error: 'Conversation not found' })

    const convo = convoResult.Item
    if (convo.buyer_id !== userId && convo.seller_id !== userId) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get messages
    const messagesResult = await docClient.send(
      new QueryCommand({
        TableName: 'Messages',
        IndexName: 'ConversationMessagesIndex',
        KeyConditionExpression: 'conversation_id = :cid',
        ExpressionAttributeValues: { ':cid': req.params.id },
        ScanIndexForward: true,
      })
    )

    // Mark as read
    const lastReadKey = convo.buyer_id === userId ? 'buyer_last_read_at' : 'seller_last_read_at'
    await docClient.send(
      new UpdateCommand({
        TableName: 'Conversations',
        Key: { conversation_id: req.params.id },
        UpdateExpression: `SET ${lastReadKey} = :now`,
        ExpressionAttributeValues: { ':now': new Date().toISOString() },
      })
    )

    res.json({
      ...convo,
      messages: messagesResult.Items || [],
      role: convo.buyer_id === userId ? 'buyer' : 'seller',
    })
  } catch (err) {
    console.error('GET /api/conversations/:id error:', err.message)
    res.status(500).json({ error: 'Failed to fetch conversation' })
  }
})

// POST /api/conversations/:id/messages — send a message
router.post(
  '/:id/messages',
  requireAuth,
  [body('body').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const userId = req.user.user_id

    try {
      const convoResult = await docClient.send(
        new GetCommand({ TableName: 'Conversations', Key: { conversation_id: req.params.id } })
      )
      if (!convoResult.Item) return res.status(404).json({ error: 'Conversation not found' })

      const convo = convoResult.Item
      if (convo.buyer_id !== userId && convo.seller_id !== userId) {
        return res.status(403).json({ error: 'Access denied' })
      }

      const now = new Date().toISOString()
      const msg = {
        message_id: uuidv4(),
        conversation_id: req.params.id,
        sender_id: userId,
        sender_name: req.user.display_name,
        body: req.body.body,
        type: req.body.offer_amount ? 'offer' : 'text',
        created_at: now,
      }
      if (req.body.offer_amount) msg.offer_amount = Number(req.body.offer_amount)

      await docClient.send(new PutCommand({ TableName: 'Messages', Item: msg }))

      // Update conversation timestamp
      await docClient.send(
        new UpdateCommand({
          TableName: 'Conversations',
          Key: { conversation_id: req.params.id },
          UpdateExpression: 'SET last_message_at = :now',
          ExpressionAttributeValues: { ':now': now },
        })
      )

      res.status(201).json(msg)
    } catch (err) {
      console.error('POST /api/conversations/:id/messages error:', err.message)
      res.status(500).json({ error: 'Failed to send message' })
    }
  }
)

// POST /api/conversations/:id/accept — accept an offer
router.post('/:id/accept', requireAuth, async (req, res) => {
  try {
    const convo = await getConvoIfParticipant(req.params.id, req.user.user_id)
    if (!convo) return res.status(404).json({ error: 'Conversation not found' })
    if (convo.seller_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the seller can accept offers' })
    }

    const now = new Date().toISOString()

    // Create system message
    const msg = {
      message_id: uuidv4(),
      conversation_id: req.params.id,
      sender_id: req.user.user_id,
      sender_name: req.user.display_name,
      body: 'Offer accepted!',
      type: 'accept',
      created_at: now,
    }
    await docClient.send(new PutCommand({ TableName: 'Messages', Item: msg }))

    // Update listing to Pending
    if (convo.listing_id) {
      await docClient.send(
        new UpdateCommand({
          TableName: 'Listings',
          Key: { listing_id: convo.listing_id },
          UpdateExpression: 'SET #s = :status, updated_at = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':status': 'Pending', ':now': now },
        })
      )
    }

    await docClient.send(
      new UpdateCommand({
        TableName: 'Conversations',
        Key: { conversation_id: req.params.id },
        UpdateExpression: 'SET last_message_at = :now, #st = :status',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':now': now, ':status': 'accepted' },
      })
    )

    res.json({ message: 'Offer accepted', msg })
  } catch (err) {
    console.error('POST /api/conversations/:id/accept error:', err.message)
    res.status(500).json({ error: 'Failed to accept offer' })
  }
})

// POST /api/conversations/:id/decline — decline an offer
router.post('/:id/decline', requireAuth, async (req, res) => {
  try {
    const convo = await getConvoIfParticipant(req.params.id, req.user.user_id)
    if (!convo) return res.status(404).json({ error: 'Conversation not found' })
    if (convo.seller_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the seller can decline offers' })
    }

    const now = new Date().toISOString()
    const msg = {
      message_id: uuidv4(),
      conversation_id: req.params.id,
      sender_id: req.user.user_id,
      sender_name: req.user.display_name,
      body: 'Offer declined.',
      type: 'decline',
      created_at: now,
    }
    await docClient.send(new PutCommand({ TableName: 'Messages', Item: msg }))

    await docClient.send(
      new UpdateCommand({
        TableName: 'Conversations',
        Key: { conversation_id: req.params.id },
        UpdateExpression: 'SET last_message_at = :now, #st = :status',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':now': now, ':status': 'declined' },
      })
    )

    res.json({ message: 'Offer declined', msg })
  } catch (err) {
    console.error('POST /api/conversations/:id/decline error:', err.message)
    res.status(500).json({ error: 'Failed to decline offer' })
  }
})

// POST /api/conversations/:id/sold — seller marks an accepted listing as sold.
// Flips the listing to Sold, writes a Transaction, and posts a 'sold' message.
router.post('/:id/sold', requireAuth, async (req, res) => {
  try {
    const convo = await getConvoIfParticipant(req.params.id, req.user.user_id)
    if (!convo) return res.status(404).json({ error: 'Conversation not found' })
    if (convo.seller_id !== req.user.user_id) {
      return res.status(403).json({ error: 'Only the seller can mark as sold' })
    }
    if (convo.status !== 'accepted') {
      return res.status(400).json({ error: 'Accept the offer before marking as sold' })
    }
    if (!convo.listing_id) {
      return res.status(400).json({ error: 'Conversation has no associated listing' })
    }

    const listingResult = await docClient.send(
      new GetCommand({ TableName: 'Listings', Key: { listing_id: convo.listing_id } })
    )
    const listing = listingResult.Item
    if (!listing) return res.status(404).json({ error: 'Listing not found' })
    if (listing.status === 'Sold') {
      return res.status(400).json({ error: 'Listing is already sold' })
    }

    // Find the agreed price by walking back from the most recent accept to the
    // request that triggered it. Falls back to listing price.
    const msgsResult = await docClient.send(
      new QueryCommand({
        TableName: 'Messages',
        IndexName: 'ConversationMessagesIndex',
        KeyConditionExpression: 'conversation_id = :cid',
        ExpressionAttributeValues: { ':cid': req.params.id },
        ScanIndexForward: false,
      })
    )
    const msgs = msgsResult.Items || []
    let amount = null
    let foundAccept = false
    for (const m of msgs) {
      if (!foundAccept) {
        if (m.type === 'accept') foundAccept = true
        continue
      }
      if (m.type === 'offer' || m.type === 'counter' || m.type === 'buy_now') {
        if (m.offer_amount != null) amount = Number(m.offer_amount)
        break
      }
    }
    if (amount == null) amount = Number(listing.price)

    const now = new Date().toISOString()

    await docClient.send(
      new UpdateCommand({
        TableName: 'Listings',
        Key: { listing_id: convo.listing_id },
        UpdateExpression: 'SET #s = :status, updated_at = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': 'Sold', ':now': now },
      })
    )

    const txn = {
      transaction_id: uuidv4(),
      listing_id: convo.listing_id,
      buyer_id: convo.buyer_id,
      seller_id: convo.seller_id,
      amount,
      listing_title: listing.textbook_title,
      type: 'sale',
      created_at: now,
    }
    await docClient.send(new PutCommand({ TableName: 'Transactions', Item: txn }))

    const msg = {
      message_id: uuidv4(),
      conversation_id: req.params.id,
      sender_id: req.user.user_id,
      sender_name: req.user.display_name,
      body: `Marked as sold for $${amount.toFixed(2)}.`,
      type: 'sold',
      offer_amount: amount,
      created_at: now,
    }
    await docClient.send(new PutCommand({ TableName: 'Messages', Item: msg }))

    await docClient.send(
      new UpdateCommand({
        TableName: 'Conversations',
        Key: { conversation_id: req.params.id },
        UpdateExpression: 'SET last_message_at = :now, #st = :status',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: { ':now': now, ':status': 'completed' },
      })
    )

    res.json({ message: 'Marked as sold', transaction: txn, msg })
  } catch (err) {
    console.error('POST /api/conversations/:id/sold error:', err.message)
    res.status(500).json({ error: 'Failed to mark as sold' })
  }
})

// POST /api/conversations/:id/counter — counter-offer
router.post(
  '/:id/counter',
  requireAuth,
  [body('amount').isFloat({ gt: 0 })],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    try {
      const convo = await getConvoIfParticipant(req.params.id, req.user.user_id)
      if (!convo) return res.status(404).json({ error: 'Conversation not found' })

      const now = new Date().toISOString()
      const msg = {
        message_id: uuidv4(),
        conversation_id: req.params.id,
        sender_id: req.user.user_id,
        sender_name: req.user.display_name,
        body: `Counter-offer: $${Number(req.body.amount).toFixed(2)}`,
        type: 'counter',
        offer_amount: Number(req.body.amount),
        created_at: now,
      }
      await docClient.send(new PutCommand({ TableName: 'Messages', Item: msg }))

      await docClient.send(
        new UpdateCommand({
          TableName: 'Conversations',
          Key: { conversation_id: req.params.id },
          UpdateExpression: 'SET last_message_at = :now',
          ExpressionAttributeValues: { ':now': now },
        })
      )

      res.status(201).json(msg)
    } catch (err) {
      console.error('POST /api/conversations/:id/counter error:', err.message)
      res.status(500).json({ error: 'Failed to send counter-offer' })
    }
  }
)

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

async function getConvoIfParticipant(convoId, userId) {
  const result = await docClient.send(
    new GetCommand({ TableName: 'Conversations', Key: { conversation_id: convoId } })
  )
  const convo = result.Item
  if (!convo) return null
  if (convo.buyer_id !== userId && convo.seller_id !== userId) return null
  return convo
}

module.exports = router
