import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
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

// Serve built frontend (avoids Vite dev server so http://95.216.225.37:3000 works)
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(config.nodeEnv === 'development' && { detail: err.message }),
  });
});

const host = process.env.HOST || '0.0.0.0';
app.listen(config.port, host, () => {
  console.log(`PYCE Portal running on http://${host === '0.0.0.0' ? 'localhost' : host}:${config.port}`);
});
