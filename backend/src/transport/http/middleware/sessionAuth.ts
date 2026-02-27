import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../../../services/sessionTokenService';

export interface AuthenticatedRequest extends Request {
  rmaId?: string;
  customerEmail?: string;
  customerId?: string;
}

export async function requireSessionAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const payload = verifySessionToken(token);
    req.rmaId = payload.rmaId;
    req.customerEmail = payload.customerEmail;
    req.customerId = payload.customerId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session token' });
  }
}
