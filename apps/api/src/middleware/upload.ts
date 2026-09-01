import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const uploadDirectory = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes = new Set(['image/jpeg', 'image/png']);
const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (_req, file, callback) => {
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    callback(null, `${Date.now()}-${randomUUID()}${ext}`);
  }
});

export const uploadPhotos = multer({
  storage,
  limits: { fileSize: env.MAX_IMAGE_MB * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(new AppError('Solo se permiten imagenes JPG o PNG.', 422));
    callback(null, true);
  }
}).array('photos', 5);

export const uploadLogo = multer({
  storage,
  limits: { fileSize: env.MAX_IMAGE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(new AppError('El logotipo debe ser JPG o PNG.', 422));
    callback(null, true);
  }
}).single('logo');
