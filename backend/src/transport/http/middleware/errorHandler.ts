import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status || 500;
  const message =
    status === 500 ? 'Something went wrong. Please try again later.' : err.message;

  res.status(status).json({
    error: message,
  });
}

