const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { UPLOAD } = require('../config/constants');

const allowedMimeTypes = Object.keys(UPLOAD.IMAGE_EXTENSIONS_BY_MIME);

function imageFileFilter(req, file, callback) {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(ApiError.badRequest('Only JPG, PNG and WEBP images are allowed'));
  }
  return callback(null, true);
}

// Files are kept in memory and only written to disk by the storage service after validation passes,
// so a rejected request never leaves an orphan file behind.
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD.MAX_IMAGE_SIZE_BYTES, files: 1 },
  fileFilter: imageFileFilter,
});

function uploadSingleImage(fieldName) {
  return imageUpload.single(fieldName);
}

module.exports = { uploadSingleImage };
