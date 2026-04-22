const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const { requireAuth } = require('../middleware/auth')
const { upload, UPLOAD_DIR } = require('../middleware/upload')

const router = Router()

// POST /api/upload — upload up to 5 images
router.post('/', requireAuth, upload.array('images', 5), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  const urls = req.files.map((f) => `/uploads/${f.filename}`)
  res.status(201).json({ urls })
})

// DELETE /api/upload/:filename
router.delete('/:filename', requireAuth, (req, res) => {
  const filename = path.basename(req.params.filename) // prevent traversal
  const filePath = path.join(UPLOAD_DIR, filename)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' })
  }

  fs.unlinkSync(filePath)
  res.json({ message: 'File deleted' })
})

// Error handler for multer errors
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 5MB)' })
  }
  if (err.message) {
    return res.status(400).json({ error: err.message })
  }
  res.status(500).json({ error: 'Upload failed' })
})

module.exports = router
