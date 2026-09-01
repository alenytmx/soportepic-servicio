import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/soportepic_servicio'),
  JWT_SECRET: z.string().default(''),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_IMAGE_MB: z.coerce.number().positive().max(20).default(5),
  TRUST_PROXY: z.coerce.number().int().min(0).max(2).default(0)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuracion invalida:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

let jwtSecret = parsed.data.JWT_SECRET.trim();
if (jwtSecret.length < 32) {
  if (parsed.data.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en produccion.');
  }
  jwtSecret = randomBytes(48).toString('base64url');
  console.warn('JWT_SECRET era corta o no existia. Se genero una clave temporal segura para esta ejecucion.');
  console.warn('Ejecuta el sistema desde el package principal para guardarla automaticamente en apps/api/.env.');
}

export const env = { ...parsed.data, JWT_SECRET: jwtSecret };
