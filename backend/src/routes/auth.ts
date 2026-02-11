import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { config } from '../config';
import { authMiddleware } from '../middleware/auth';
import { UserPublic } from '../types';

const router = Router();

function toPublic(user: { id: string; email: string; display_name: string | null; role: string; created_at: Date }): UserPublic {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role as UserPublic['role'],
    created_at: user.created_at,
  };
}

router.post(
  '/signup',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('displayName').optional().trim().isLength({ max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      const email = (req.body.email || '').trim().toLowerCase();
      const password = req.body.password;
      const displayName = req.body.displayName ? String(req.body.displayName).trim() : null;
      const client = await pool.connect();
      try {
        const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.length > 0) {
          res.status(409).json({ error: 'Email already registered' });
          return;
        }
        const password_hash = await bcrypt.hash(password, 10);
        const { rows } = await client.query(
          `INSERT INTO users (email, password_hash, display_name, role)
           VALUES ($1, $2, $3, 'member')
           RETURNING id, email, display_name, role, created_at`,
          [email, password_hash, displayName]
        );
        const user = rows[0];
        const token = jwt.sign(
          { userId: user.id, email: user.email, role: user.role },
          config.jwt.secret as jwt.Secret,
          { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
        );
        res.status(201).json({ user: toPublic(user), token });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({
        error: 'Sign up failed',
        ...(config.nodeEnv === 'development' && err instanceof Error && { detail: err.message }),
      });
    }
  }
);

router.post(
  '/signin',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      const email = (req.body.email || '').trim().toLowerCase();
      const password = req.body.password;
      const { rows } = await pool.query(
        'SELECT id, email, password_hash, display_name, role, created_at FROM users WHERE email = $1',
        [email]
      );
      if (rows.length === 0) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
      const user = rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        config.jwt.secret as jwt.Secret,
        { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
      );
      res.json({ user: toPublic(user), token });
    } catch (err) {
      console.error('Signin error:', err);
      res.status(500).json({
        error: 'Sign in failed',
        ...(config.nodeEnv === 'development' && err instanceof Error && { detail: err.message }),
      });
    }
  }
);

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const { rows } = await pool.query(
    'SELECT id, email, display_name, role, created_at FROM users WHERE id = $1',
    [req.user!.userId]
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(toPublic(rows[0]));
});

export default router;
