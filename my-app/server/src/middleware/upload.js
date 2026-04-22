const multer = require('multer')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

const UPLOAD_DIR = path.join(__dirname, '../../uploads')
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `${uuidv4()}${ext}`)
  },
})

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false)
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } })

module.exports = { upload, UPLOAD_DIR }
