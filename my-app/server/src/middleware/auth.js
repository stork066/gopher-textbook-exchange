const jwt = require('jsonwebtoken')

function verifyToken(req) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return null
  const token = header.slice(7)
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return null
  }
}

function requireAuth(req, res, next) {
  const payload = verifyToken(req)
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  req.user = payload
  next()
}

function optionalAuth(req, res, next) {
  req.user = verifyToken(req) || null
  next()
}

module.exports = { requireAuth, optionalAuth }
