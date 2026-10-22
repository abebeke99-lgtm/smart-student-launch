const fs = require('fs');
const path = require('path');

const uploadsPrefix = '/uploads/';
const uploadsDirectory = path.resolve(__dirname, '../../uploads');

async function removeLocalImage(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith(uploadsPrefix)) return;

  const filename = imageUrl.slice(uploadsPrefix.length);
  if (!/^[a-f0-9-]+\.(jpg|png|gif|webp)$/i.test(filename)) return;

  try {
    await fs.promises.unlink(path.join(uploadsDirectory, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function removeUploadedFile(file) {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = { removeLocalImage, removeUploadedFile };
