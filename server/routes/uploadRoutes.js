const express = require('express');
const { authRequired, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

/**
 * POST /api/uploads — upload a single question image (teacher).
 * Returns { imageUrl } pointing at the statically-served /uploads path.
 * Multer errors are handled inline so they become clean 400s.
 */
router.post('/', authRequired, requireRole('teacher'), (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image file was provided.' });
    }
    res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
