import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const existing = req.headers['x-correlation-id'];
  const id = typeof existing === 'string' && existing.length > 0 ? existing : uuid();
  (req as any).correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
}

