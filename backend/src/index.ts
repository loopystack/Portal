import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import authRoutes from './routes/auth';
import timeBlocksRoutes from './routes/timeBlocks';
import revenueRoutes from './routes/revenue';
import rankingsRoutes from './routes/rankings';
import adminRoutes from './routes/admin';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/time-blocks', timeBlocksRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(config.nodeEnv === 'development' && { detail: err.message }),
  });
});

app.listen(config.port, () => {
  console.log(`PYCE Portal API running on http://localhost:${config.port}`);
});
