const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { uploadDir } = require('../config');

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    cb(null, crypto.randomUUID() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed =
      (file.mimetype === 'image/jpeg' && (ext === '.jpg' || ext === '.jpeg')) ||
      (file.mimetype === 'image/png' && ext === '.png');
    if (!allowed) {
      const error = new Error('Only JPEG and PNG images are allowed');
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  }
});
module.exports = upload;
