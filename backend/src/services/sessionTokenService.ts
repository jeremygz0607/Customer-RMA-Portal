import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface SessionTokenPayload {
  rmaId: string;
  customerId?: string;
  customerEmail?: string;
}

export function signSessionToken(payload: SessionTokenPayload): string {
  const expiresIn = `${config.jwtTtlMinutes}m`;
  return jwt.sign(payload, config.jwtSecret, { expiresIn });
}

