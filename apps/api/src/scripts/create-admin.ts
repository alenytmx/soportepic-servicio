import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { User } from '../models/User.js';
import { ADMIN_PERMISSIONS } from '../utils/permissions.js';

const rl = readline.createInterface({ input, output });

try {
  await connectDatabase();
  const name = (await rl.question('Nombre del administrador: ')).trim();
  const username = (await rl.question('Usuario: ')).trim();
  const password = (await rl.question('Contraseña (8+, mayúscula, minúscula y número): ')).trim();
  if (!name || username.length < 3 || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Los datos no cumplen los requisitos mínimos.');
  }
  const user = await User.create({
    name,
    username,
    passwordHash: await User.hashPassword(password),
    role: 'admin',
    permissions: ADMIN_PERMISSIONS,
    active: true
  });
  console.log(`Administrador ${user.username} creado correctamente.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  rl.close();
  await disconnectDatabase();
}
