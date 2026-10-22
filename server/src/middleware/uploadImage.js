const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

const uploadDirectory = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const imageTypes = {
  'image/jpeg': { extension: '.jpg', signatures: [Buffer.from([0xff, 0xd8, 0xff])] },
  'image/png': { extension: '.png', signatures: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])] },
  'image/gif': { extension: '.gif', signatures: [Buffer.from('GIF87a'), Buffer.from('GIF89a')] },
  'image/webp': { extension: '.webp', signatures: [Buffer.from('RIFF')] },
};

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename(req, file, callback) {
    const imageType = imageTypes[file.mimetype];
    callback(null, `${crypto.randomUUID()}${imageType.extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 16 * 1024 },
  fileFilter(req, file, callback) {
    if (!imageTypes[file.mimetype]) {
      return callback(new AppError('Image must be JPEG, PNG, GIF, or WebP', 400));
    }
    return callback(null, true);
  },
}).single('image');

function matchesSignature(buffer, imageType) {
  if (imageType === imageTypes['image/webp']) {
    return buffer.length >= 12
      && buffer.subarray(0, 4).equals(Buffer.from('RIFF'))
      && buffer.subarray(8, 12).equals(Buffer.from('WEBP'));
  }
  return imageType.signatures.some((signature) => buffer.subarray(0, signature.length).equals(signature));
}

function uploadImage(req, res, next) {
  upload(req, res, async (uploadError) => {
    if (uploadError) return next(uploadError);
    if (!req.file) return next();

    try {
      const handle = await fs.promises.open(req.file.path, 'r');
      const header = Buffer.alloc(12);
      let bytesRead;
      try {
        ({ bytesRead } = await handle.read(header, 0, header.length, 0));
      } finally {
        await handle.close();
      }

      const imageType = imageTypes[req.file.mimetype];
      if (!matchesSignature(header.subarray(0, bytesRead), imageType)) {
        await fs.promises.unlink(req.file.path);
        return next(new AppError('Uploaded file contents do not match the declared image type', 400));
      }

      return next();
    } catch (error) {
      try {
        await fs.promises.unlink(req.file.path);
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') return next(cleanupError);
      }
      return next(error);
    }
  });
}

module.exports = { uploadImage, uploadDirectory };
