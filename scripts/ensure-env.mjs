import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = process.env.ENV_FILE_PATH ? path.resolve(process.env.ENV_FILE_PATH) : path.join(root, 'apps', 'api', '.env');
const examplePath = path.join(root, 'apps', 'api', '.env.example');

if (!fs.existsSync(envPath)) {
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.copyFileSync(examplePath, envPath);
  console.log('Se creo apps/api/.env a partir del archivo de ejemplo.');
}

let contents = fs.readFileSync(envPath, 'utf8');
const jwtMatch = contents.match(/^JWT_SECRET=(.*)$/m);
const currentSecret = jwtMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '') || '';

if (currentSecret.length < 32 || currentSecret.includes('cambia-esta')) {
  const generatedSecret = randomBytes(48).toString('base64url');
  if (jwtMatch) contents = contents.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${generatedSecret}`);
  else contents = `${contents.trimEnd()}\nJWT_SECRET=${generatedSecret}\n`;
  fs.writeFileSync(envPath, contents, { encoding: 'utf8', mode: 0o600 });
  console.log('JWT_SECRET segura generada y guardada. No necesitas escribirla manualmente.');
}

const mongoMatch = contents.match(/^MONGODB_URI=(.*)$/m);
const mongoUri = mongoMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '') || '';
if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
  console.warn('MONGODB_URI no tiene un formato valido. Revisa apps/api/.env.');
} else {
  console.log(`Configuracion de MongoDB detectada (${mongoUri.startsWith('mongodb+srv://') ? 'Atlas/SRV' : 'local'}).`);
}
