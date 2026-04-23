const multer = require('multer')

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const MAX_FILES = 8
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false)
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_SIZE, files: MAX_FILES },
})

module.exports = { upload, MAX_FILES, MAX_SIZE, ALLOWED_TYPES }
