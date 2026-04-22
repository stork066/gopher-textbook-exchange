require('dotenv').config()
const express = require('express')
const path = require('path')

const authRouter = require('./routes/auth')
const listingsRouter = require('./routes/listings')
const departmentsRouter = require('./routes/departments')
const textbooksRouter = require('./routes/textbooks')
const uploadRouter = require('./routes/upload')
const conversationsRouter = require('./routes/conversations')
const buyNowRouter = require('./routes/buyNow')
const cartRouter = require('./routes/cart')
const accountRouter = require('./routes/account')

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(express.json())

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Request logger
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/auth', authRouter)
app.use('/api/listings', listingsRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/textbooks', textbooksRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/conversations', conversationsRouter)
app.use('/api/listings', buyNowRouter)
app.use('/api/cart', cartRouter)
app.use('/api/account', accountRouter)

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
