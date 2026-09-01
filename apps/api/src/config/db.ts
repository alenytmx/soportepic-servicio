import mongoose from 'mongoose';
import { env } from './env.js';
import { ServiceOrder } from '../models/ServiceOrder.js';
import { User } from '../models/User.js';
import { DEFAULT_QUOTATION_TYPES, QuotationType } from '../models/QuotationType.js';

export const databaseState = {
  connected: false,
  connecting: false,
  lastError: null as string | null,
  lastAttemptAt: null as Date | null
};

let connectionAttempt: Promise<boolean> | null = null;
let retryTimer: NodeJS.Timeout | null = null;
let dataMigrationsCompleted = false;

async function seedQuotationTypes() {
  const admin = await User.findOne({ role: 'admin', active: true }).select('_id');
  if (!admin) return;
  await Promise.all(DEFAULT_QUOTATION_TYPES.map(([name, description]) => QuotationType.updateOne(
    { name },
    { $setOnInsert: { name, description, active: true, createdBy: admin._id, updatedBy: admin._id } },
    { upsert: true }
  )));
}

async function migrateLegacyOrderTotals() {
  if (dataMigrationsCompleted) return;
  const materialsTotal = {
    $sum: {
      $map: {
        input: { $ifNull: ['$materials', []] },
        as: 'material',
        in: { $multiply: [{ $ifNull: ['$$material.quantity', 0] }, { $ifNull: ['$$material.unitCost', 0] }] }
      }
    }
  };
  const correctedTotal = { $round: [{ $add: ['$total', materialsTotal] }, 2] };
  const result = await ServiceOrder.collection.updateMany(
    { serviceAmount: { $exists: false } },
    [{
      $set: {
        serviceAmount: '$total',
        total: correctedTotal,
        balance: { $round: [{ $max: [0, { $subtract: [correctedTotal, { $ifNull: ['$paidAmount', 0] }] }] }, 2] }
      }
    }]
  );
  dataMigrationsCompleted = true;
  if (result.modifiedCount > 0) console.log(`Ordenes corregidas para sumar refacciones: ${result.modifiedCount}`);
}

function describeConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes('authentication failed') || lower.includes('bad auth')) {
    return 'Atlas rechazo el usuario o la contraseña. Revisa Database Access y codifica los caracteres especiales de la contraseña para URL.';
  }
  if (lower.includes('querysrv') || lower.includes('enotfound')) {
    return 'No se pudo localizar el cluster de Atlas. Revisa el nombre del cluster, la conexion a Internet y el DNS.';
  }
  if (lower.includes('tls') || lower.includes('ssl')) {
    return 'Atlas rechazo la conexion TLS. Verifica la fecha de Windows y usa una version vigente de Node.js.';
  }
  if (lower.includes('econnrefused')) {
    return 'El servidor de MongoDB rechazo la conexion. Si usas Atlas revisa la URI; si es local inicia el servicio MongoDB.';
  }
  if (lower.includes('timed out') || lower.includes('server selection')) {
    return 'Atlas no respondio. Agrega tu IP actual en Network Access y confirma que el cluster este activo.';
  }
  return message.replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, 'mongodb://***@');
}

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);
mongoose.connection.on('connected', () => {
  databaseState.connected = true;
  databaseState.lastError = null;
});
mongoose.connection.on('disconnected', () => {
  databaseState.connected = false;
});
mongoose.connection.on('error', (error) => {
  databaseState.connected = false;
  databaseState.lastError = error.message;
});

export function isDatabaseReady() {
  return databaseState.connected && mongoose.connection.readyState === 1;
}

export async function connectDatabase() {
  if (isDatabaseReady()) return true;
  if (connectionAttempt) return connectionAttempt;

  connectionAttempt = (async () => {
    databaseState.connecting = true;
    databaseState.lastAttemptAt = new Date();
    try {
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5_000,
        connectTimeoutMS: 5_000,
        maxPoolSize: 10
      });
      await migrateLegacyOrderTotals().catch((error) => {
        console.error('No fue posible corregir automaticamente los totales anteriores:', error instanceof Error ? error.message : error);
      });
      await seedQuotationTypes().catch((error) => console.error('No fue posible insertar tipos de cotización:', error instanceof Error ? error.message : error));
      databaseState.connected = true;
      databaseState.lastError = null;
      console.log(`MongoDB conectado: ${mongoose.connection.name}`);
      return true;
    } catch (error) {
      databaseState.connected = false;
      databaseState.lastError = describeConnectionError(error);
      console.error('MongoDB no esta disponible. La API seguira encendida y volvera a intentar la conexion.');
      console.error(`Detalle: ${databaseState.lastError}`);
      return false;
    } finally {
      databaseState.connecting = false;
      connectionAttempt = null;
    }
  })();
  return connectionAttempt;
}

export function startDatabaseRetry(intervalMs = 5_000) {
  void connectDatabase();
  retryTimer = setInterval(() => {
    if (!isDatabaseReady() && !databaseState.connecting) void connectDatabase();
  }, intervalMs);
  retryTimer.unref();
  return () => {
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = null;
  };
}

export async function disconnectDatabase() {
  if (retryTimer) clearInterval(retryTimer);
  retryTimer = null;
  await mongoose.disconnect();
}
