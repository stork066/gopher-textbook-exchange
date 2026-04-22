require('dotenv').config()
const { Router } = require('express')
const { body, validationResult } = require('express-validator')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const { QueryCommand, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb')
const { docClient } = require('../db/dynamodb')
const { requireAuth } = require('../middleware/auth')

const router = Router()
const SALT_ROUNDS = 10

function makeToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, display_name: user.display_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

async function findUserByEmail(email) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: 'Users',
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
      Limit: 1,
    })
  )
  return result.Items?.[0] || null
}

// POST /api/auth/signup
router.post(
  '/signup',
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('display_name').notEmpty().withMessage('Display name is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { email, password, display_name } = req.body

    try {
      const existing = await findUserByEmail(email)
      if (existing) {
        return res.status(409).json({ error: 'An account with that email already exists' })
      }

      const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
      const user = {
        user_id: uuidv4(),
        email,
        password_hash,
        display_name,
        created_at: new Date().toISOString(),
      }

      await docClient.send(new PutCommand({ TableName: 'Users', Item: user }))

      const token = makeToken(user)
      return res.status(201).json({
        user: { user_id: user.user_id, email: user.email, display_name: user.display_name },
        token,
      })
    } catch (err) {
      console.error('POST /api/auth/signup error:', err.message)
      return res.status(500).json({ error: 'Signup failed' })
    }
  }
)

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { email, password } = req.body
    const INVALID = { error: 'Invalid credentials' }

    try {
      const user = await findUserByEmail(email)
      if (!user) return res.status(401).json(INVALID)

      const match = await bcrypt.compare(password, user.password_hash)
      if (!match) return res.status(401).json(INVALID)

      const token = makeToken(user)
      return res.json({
        user: { user_id: user.user_id, email: user.email, display_name: user.display_name },
        token,
      })
    } catch (err) {
      console.error('POST /api/auth/login error:', err.message)
      return res.status(500).json({ error: 'Login failed' })
    }
  }
)

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await docClient.send(
      new GetCommand({ TableName: 'Users', Key: { user_id: req.user.user_id } })
    )
    if (!result.Item) return res.status(404).json({ error: 'User not found' })

    const { user_id, email, display_name, created_at } = result.Item
    return res.json({ user: { user_id, email, display_name, created_at } })
  } catch (err) {
    console.error('GET /api/auth/me error:', err.message)
    return res.status(500).json({ error: 'Failed to fetch user' })
  }
})

module.exports = router
