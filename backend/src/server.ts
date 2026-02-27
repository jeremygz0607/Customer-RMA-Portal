import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { json } from 'body-parser';
import { rmaRouter } from './transport/http/rma.routes';
import { adminRouter } from './transport/http/admin.routes';
import { correlationIdMiddleware } from './transport/http/middleware/correlationId';
import { errorHandler } from './transport/http/middleware/errorHandler';

dotenv.config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  }),
);
app.use(json({ limit: '10mb' }));
app.use(correlationIdMiddleware);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});
app.use(limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/rma', rmaRouter);
app.use('/api/admin', adminRouter);

app.use(errorHandler);

const port = process.env.PORT || 4000;

// Start storage cleanup job
if (process.env.ENABLE_STORAGE_CLEANUP !== 'false') {
  const { scheduleStorageCleanup } = require('./jobs/storageCleanupJob');
  scheduleStorageCleanup();
}

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`RMA service listening on port ${port}`);
});

