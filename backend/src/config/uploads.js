import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

const uploadRoot = process.env.VERCEL
  ? path.join('/tmp', 'maison-bistro-uploads')
  : path.resolve('uploads');
export const uploadDirectory = uploadRoot;
const profileDirectory = path.join(uploadRoot, 'profiles');
const menuDirectory = path.join(uploadRoot, 'menu');
fs.mkdirSync(profileDirectory, { recursive: true });
fs.mkdirSync(menuDirectory, { recursive: true });

function createStorage(directory, prefix) {
  return multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, directory),
    filename: (_request, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`);
    }
  });
}

function imageOnly(_request, file, callback) {
  if (!file.mimetype.startsWith('image/')) {
    return callback(new Error('Uploaded file must be an image'));
  }
  callback(null, true);
}

export const profileUpload = multer({
  storage: createStorage(profileDirectory, 'profile'),
  fileFilter: imageOnly,
  limits: { fileSize: 5 * 1024 * 1024 }
});

export const menuImageUpload = multer({
  storage: createStorage(menuDirectory, 'menu'),
  fileFilter: imageOnly,
  limits: { fileSize: 5 * 1024 * 1024 }
});
