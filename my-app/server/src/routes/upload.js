const { Router } = require('express')
const sharp = require('sharp')
const { v4: uuidv4 } = require('uuid')
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')
const { requireAuth } = require('../middleware/auth')
const { upload, MAX_FILES } = require('../middleware/upload')

const router = Router()

const S3_BUCKET = process.env.S3_BUCKET
const S3_REGION = process.env.AWS_REGION || 'us-east-1'
const S3_PREFIX = 'listings'

const s3 = new S3Client({ region: S3_REGION })

function publicUrlFor(key) {
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`
}

async function processAndUpload(fileBuffer) {
  const processed = await sharp(fileBuffer)
    .rotate() // Apply EXIF orientation so portraits don't come out sideways
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer()

  const key = `${S3_PREFIX}/${uuidv4()}.jpg`
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: processed,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  return publicUrlFor(key)
}

// POST /api/upload — up to 8 images; returns array of public S3 URLs
router.post('/', requireAuth, upload.array('images', MAX_FILES), async (req, res) => {
  if (!S3_BUCKET) {
    return res.status(500).json({ error: 'Image uploads are not configured on this server' })
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  try {
    const urls = await Promise.all(req.files.map((f) => processAndUpload(f.buffer)))
    res.status(201).json({ urls })
  } catch (err) {
    console.error('POST /api/upload error:', err)
    res.status(500).json({ error: 'Failed to process uploads' })
  }
})

// DELETE /api/upload — body: { url }
// Only allows deleting keys in our own bucket and prefix.
router.delete('/', requireAuth, async (req, res) => {
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'url is required' })
  if (!S3_BUCKET) {
    return res.status(500).json({ error: 'S3 not configured' })
  }

  const bucketPrefix = publicUrlFor('')
  if (!url.startsWith(bucketPrefix) || !url.includes(`/${S3_PREFIX}/`)) {
    return res.status(400).json({ error: 'Invalid URL' })
  }
  const key = url.slice(bucketPrefix.length)

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error('DELETE /api/upload error:', err)
    res.status(500).json({ error: 'Failed to delete' })
  }
})

// Multer/route error handler (must be last)
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large (max 10 MB)' })
  }
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: `Too many files (max ${MAX_FILES})` })
  }
  if (err.message) return res.status(400).json({ error: err.message })
  res.status(500).json({ error: 'Upload failed' })
})

module.exports = router
