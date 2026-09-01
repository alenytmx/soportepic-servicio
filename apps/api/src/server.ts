import http from 'node:http';
import { Server } from 'socket.io';
import { app } from './app.js';
import { disconnectDatabase, startDatabaseRetry } from './config/db.js';
import { env } from './config/env.js';
import { verifyAccessToken } from './utils/jwt.js';
import { User } from './models/User.js';
import { isAllowedOrigin } from './utils/origin.js';

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: (origin, callback) => callback(null, isAllowedOrigin(origin)), credentials: true },
  transports: ['websocket', 'polling']
});

io.use(async (socket, next) => {
  try {
    const cookies = Object.fromEntries(String(socket.handshake.headers.cookie || '').split(';').map((item) => item.trim().split('=').map(decodeURIComponent)).filter((item) => item.length === 2));
    const token = cookies.sp_session || socket.handshake.auth?.token;
    if (!token) return next(new Error('No autorizado'));
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (!user || !user.active || user.tokenVersion !== payload.tokenVersion) return next(new Error('No autorizado'));
    socket.data.userId = user.id;
    next();
  } catch {
    next(new Error('No autorizado'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.data.userId}`);
  socket.emit('system:ready', { version: '1.3.0' });
});

app.set('io', io);

async function start() {
  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`API lista en http://localhost:${env.PORT}`);
    console.log(`Diagnostico: http://localhost:${env.PORT}/api/health`);
    console.log('Conectando con MongoDB...');
    startDatabaseRetry();
  });
}

async function shutdown(signal: string) {
  console.log(`\n${signal}: cerrando servidor...`);
  io.close();
  httpServer.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => console.error('Promesa no controlada:', error));

start().catch((error) => {
  console.error('No fue posible iniciar la API:', error);
  process.exit(1);
});
