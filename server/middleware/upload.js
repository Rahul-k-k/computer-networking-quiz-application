const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Ensure the uploads directory exists (it may be gitignored/empty on a fresh
// clone save for its .gitkeep).
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = /^\.(png|jpg|jpeg|gif|webp|svg)$/.test(ext) ? ext : '.png';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `q-${unique}${safeExt}`);
  },
});

function fileFilter(_req, file, cb) {
  if (/^image\//.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image uploads are allowed.'));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
});

module.exports = { upload, UPLOAD_DIR };
