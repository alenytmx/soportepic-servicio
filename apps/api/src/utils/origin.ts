import { env } from '../config/env.js';

const configuredOrigins = env.CLIENT_ORIGIN
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [first, second] = parts;
  return first === 10
    || (first === 172 && second! >= 16 && second! <= 31)
    || (first === 192 && second === 168);
}

export function isAllowedOrigin(origin?: string) {
  if (!origin || configuredOrigins.includes(origin)) return true;
  if (env.NODE_ENV !== 'development') return false;

  try {
    const { hostname, protocol } = new URL(origin);
    if (!['http:', 'https:'].includes(protocol)) return false;
    return hostname === 'localhost'
      || hostname === '127.0.0.1'
      || hostname === '[::1]'
      || hostname.endsWith('.local')
      || isPrivateIpv4(hostname);
  } catch {
    return false;
  }
}
