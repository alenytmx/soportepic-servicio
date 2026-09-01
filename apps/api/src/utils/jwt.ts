import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface TokenPayload {
  sub: string;
  username: string;
  tokenVersion: number;
}

export function signAccessToken(payload: TokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'soportepic-servicio',
    audience: 'soportepic-web'
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET, {
    issuer: 'soportepic-servicio',
    audience: 'soportepic-web'
  }) as TokenPayload;
}
