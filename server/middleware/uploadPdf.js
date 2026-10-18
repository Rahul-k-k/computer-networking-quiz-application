const multer = require('multer');

// PDF upload used only by the AI question-generation endpoint. Kept separate
// from the image upload middleware (which accepts only images and rejects PDFs).
//
// Uses memoryStorage so the file lives in `req.file.buffer` and can be
// base64-encoded and handed straight to the AI — there is no temp file on disk
// to clean up afterwards.
const storage = multer.memoryStorage();

function fileFilter(_req, file, cb) {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed.'));
  }
}

const uploadPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = { uploadPdf };
