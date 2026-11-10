const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const { UPLOAD } = require('../config/constants');

/*
 * The only module that knows images live on the local disk.
 * Switching to Cloudinary/S3 later means rewriting these functions; callers stay the same.
 */

const uploadRoot = path.resolve(env.uploadDir);

function getUploadRoot() {
  return uploadRoot;
}

// Saves an in-memory Multer file and returns the public URL path, e.g. "/uploads/messages/<uuid>.png".
async function saveImage(file, folder) {
  const extension = UPLOAD.IMAGE_EXTENSIONS_BY_MIME[file.mimetype];
  // Random names stop users from guessing or overwriting each other's files.
  const fileName = `${crypto.randomUUID()}${extension}`;
  const folderPath = path.join(uploadRoot, folder);

  await fs.mkdir(folderPath, { recursive: true });
  await fs.writeFile(path.join(folderPath, fileName), file.buffer);

  return `${UPLOAD.PUBLIC_PATH}/${folder}/${fileName}`;
}

function resolveSafePath(publicUrl) {
  const prefix = `${UPLOAD.PUBLIC_PATH}/`;
  if (!publicUrl || !publicUrl.startsWith(prefix)) {
    return null;
  }
  const filePath = path.resolve(uploadRoot, publicUrl.slice(prefix.length));
  // Guards against "../" tricks reaching files outside the upload folder.
  return filePath.startsWith(uploadRoot + path.sep) ? filePath : null;
}

// Best effort: a leftover file must never make the user's request fail.
async function deleteFile(publicUrl) {
  const filePath = resolveSafePath(publicUrl);
  if (!filePath) {
    return;
  }
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Could not delete file ${filePath}:`, error.message);
    }
  }
}

module.exports = { getUploadRoot, saveImage, deleteFile };
