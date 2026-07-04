// ─────────────────────────────────────────────
//  routes/files.js
//  All routes here require a valid login token.
//
//  POST   /api/files              — upload a file
//  GET    /api/files              — list your files
//  GET    /api/files/:id/download — get a download link
//  DELETE /api/files/:id          — delete a file
// ─────────────────────────────────────────────

const express    = require('express');
const multer     = require('multer');
const { v4: uuid } = require('uuid');
const { S3Client, PutObjectCommand,
        DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const requireAuth = require('../middleware/auth');
const db          = require('../db/dynamo');
const config      = require('../config');

const router = express.Router();

// S3 client — on EC2 with an IAM role, no keys needed, AWS handles it automatically
const s3 = new S3Client({ region: config.awsRegion });

// multer holds the uploaded file in memory temporarily before we send it to S3
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: config.maxFileSizeMB * 1024 * 1024 },
});

// Every route below this line checks for a valid login first
router.use(requireAuth);

// ── Upload ────────────────────────────────────
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const fileId = uuid();

    // Store each user's files in their own "folder" inside the bucket
    const s3Key = `${req.user.userId}/${fileId}-${req.file.originalname}`;

    // 1. Upload the actual file bytes to S3
    await s3.send(new PutObjectCommand({
      Bucket:      config.s3Bucket,
      Key:         s3Key,
      Body:        req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    // 2. Save the file's metadata to DynamoDB
    const record = {
      userId:     req.user.userId,
      fileId,
      fileName:   req.file.originalname,
      s3Key,
      size:       req.file.size,
      mimeType:   req.file.mimetype,
      uploadedAt: new Date().toISOString(),
    };

    await db.createFile(record);
    res.json({ message: 'Uploaded', file: record });

  } catch (err) {
    console.error('[upload]', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── List files ────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const files = await db.getFilesByUser(req.user.userId);
    res.json(files);
  } catch (err) {
    console.error('[list]', err);
    res.status(500).json({ error: 'Could not load files' });
  }
});

// ── Download link ─────────────────────────────
router.get('/:fileId/download', async (req, res) => {
  try {
    // Look up the file in DynamoDB — this also confirms the file belongs to this user
    const file = await db.getFile(req.user.userId, req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Generate a temporary S3 link (valid 5 minutes) — bucket stays private
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: config.s3Bucket, Key: file.s3Key }),
      { expiresIn: 300 }
    );

    res.json({ url });

  } catch (err) {
    console.error('[download]', err);
    res.status(500).json({ error: 'Could not generate download link' });
  }
});

// ── Delete ────────────────────────────────────
router.delete('/:fileId', async (req, res) => {
  try {
    // Confirm the file exists and belongs to this user before deleting
    const file = await db.getFile(req.user.userId, req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Delete from S3 first, then remove the record from DynamoDB
    await s3.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: file.s3Key }));
    await db.deleteFile(req.user.userId, req.params.fileId);

    res.json({ message: 'Deleted' });

  } catch (err) {
    console.error('[delete]', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
