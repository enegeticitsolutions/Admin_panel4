const multer = require('multer');

// Use memory storage since we're passing buffers to the storage service directly
const storage = multer.memoryStorage();

// Validate file types — mirrors the main API (apps/api) allowed list
// Includes image/jpg (alias for image/jpeg — some browsers/phones send this),
// image/webp, image/heic, image/heif for modern cameras and screenshots
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',    // alias — some browsers send this instead of image/jpeg
  'image/png',
  'image/gif',
  'image/webp',   // modern screenshots & browser exports
  'image/heic',   // iOS camera default
  'image/heif',   // iOS camera variant
  'application/pdf',
];

const fileFilter = (req, file, cb) => {
  // Normalize image/jpg → image/jpeg (consistent storage)
  if (file.mimetype === 'image/jpg') {
    file.mimetype = 'image/jpeg';
  }

  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, GIF, WEBP, HEIC, PDF`
      ),
      false
    );
  }
};

// 25MB limit — matches the visits upload middleware
const limits = {
  fileSize: 25 * 1024 * 1024,
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits,
});

module.exports = upload;
