import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

interface RevenueEntryRow {
  id: string;
  user_id: string;
  amount: number;
  date: Date;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

function toEntry(row: RevenueEntryRow) {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount),
    date: (row.date as Date).toISOString().slice(0, 10),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ExpectedRevenueRow {
  id: string;
  user_id: string;
  month: number;
  year: number;
  amount: number;
  created_at: Date;
  updated_at: Date;
}

function toExpected(row: ExpectedRevenueRow) {
  return {
    id: row.id,
    userId: row.user_id,
    month: row.month,
    year: row.year,
    amount: Number(row.amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// List revenue entries in date range. Admin may pass ?userId= to list that user's entries.
router.get(
  '/entries',
  query('from').isISO8601(),
  query('to').isISO8601(),
  query('userId').optional().trim().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      const from = (req.query.from as string).slice(0, 10);
      const to = (req.query.to as string).slice(0, 10);
      const isAdmin = req.user!.role === 'admin';
      const requestedUserId = req.query.userId;
      const userIdParam = typeof requestedUserId === 'string'
        ? requestedUserId
        : Array.isArray(requestedUserId) && requestedUserId.length > 0
          ? requestedUserId[0]
          : null;
      const userId = (isAdmin && userIdParam) ? userIdParam : req.user!.userId;
      const { rows } = await pool.query<RevenueEntryRow>(
        `SELECT id, user_id, amount, date, note, created_at, updated_at
         FROM revenue_entries
         WHERE user_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC, created_at DESC`,
        [userId, from, to]
      );
      res.json(rows.map(toEntry));
    } catch (err) {
      console.error('Revenue entries list error:', err);
      res.status(500).json({
        error: 'Failed to load revenue entries',
        ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
      });
    }
  }
);

// Create revenue entry (amount can be negative for deductions e.g. server costs, tools)
router.post(
  '/entries',
  body('date').isISO8601(),
  body('amount').isFloat().toFloat(),
  body('note').optional().trim().isLength({ max: 2000 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      const userId = req.user!.userId;
      const date = (req.body.date as string).slice(0, 10);
      const amount = req.body.amount as number;
      const note = req.body.note as string | undefined;
      const { rows } = await pool.query<RevenueEntryRow>(
        `INSERT INTO revenue_entries (user_id, date, amount, note)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, amount, date, note, created_at, updated_at`,
        [userId, date, amount, note || null]
      );
      res.status(201).json(toEntry(rows[0]));
    } catch (err) {
      console.error('Revenue entry create error:', err);
      res.status(500).json({
        error: 'Failed to create revenue entry',
        ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
      });
    }
  }
);

// Update revenue entry
router.patch(
  '/entries/:id',
  param('id').isUUID(),
  body('date').optional().isISO8601().toDate(),
  body('amount').optional().isFloat().toFloat(),
  body('note').optional().trim().isLength({ max: 2000 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      const id = req.params.id;
      const userId = req.user!.userId;
      const updates: string[] = [];
      const values: unknown[] = [];
      let i = 1;
      if (req.body.date !== undefined) {
        updates.push(`date = $${i++}`);
        const dateVal = req.body.date;
        const dateStr = dateVal instanceof Date
          ? dateVal.toISOString().slice(0, 10)
          : String(dateVal).slice(0, 10);
        values.push(dateStr);
      }
      if (req.body.amount !== undefined) {
        updates.push(`amount = $${i++}`);
        values.push(req.body.amount);
      }
      if (req.body.note !== undefined) {
        updates.push(`note = $${i++}`);
        values.push(req.body.note === '' ? null : req.body.note);
      }
      if (updates.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }
      updates.push('updated_at = NOW()');
      const isAdmin = req.user!.role === 'admin';
      if (isAdmin) {
        values.push(id);
        const { rows } = await pool.query<RevenueEntryRow>(
          `UPDATE revenue_entries SET ${updates.join(', ')}
           WHERE id = $${i}
           RETURNING id, user_id, amount, date, note, created_at, updated_at`,
          values
        );
        if (rows.length === 0) {
          res.status(404).json({ error: 'Revenue entry not found' });
          return;
        }
        return res.json(toEntry(rows[0]));
      }
      values.push(id, userId);
      const { rows } = await pool.query<RevenueEntryRow>(
        `UPDATE revenue_entries SET ${updates.join(', ')}
         WHERE id = $${i} AND user_id = $${i + 1}
         RETURNING id, user_id, amount, date, note, created_at, updated_at`,
        values
      );
      if (rows.length === 0) {
        res.status(404).json({ error: 'Revenue entry not found' });
        return;
      }
      res.json(toEntry(rows[0]));
    } catch (err) {
      console.error('Revenue entry update error:', err);
      res.status(500).json({
        error: 'Failed to update revenue entry',
        ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
      });
    }
  }
);

// Delete revenue entry
router.delete(
  '/entries/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      const id = req.params.id;
      const userId = req.user!.userId;
      const isAdmin = req.user!.role === 'admin';
      const { rowCount } = await pool.query(
        isAdmin
          ? 'DELETE FROM revenue_entries WHERE id = $1'
          : 'DELETE FROM revenue_entries WHERE id = $1 AND user_id = $2',
        isAdmin ? [id] : [id, userId]
      );
      if (rowCount === 0) {
        res.status(404).json({ error: 'Revenue entry not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      console.error('Revenue entry delete error:', err);
      res.status(500).json({
        error: 'Failed to delete revenue entry',
        ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
      });
    }
  }
);

// Get expected revenue for a month (year + month)
router.get(
  '/expected',
  query('year').isInt({ min: 2000, max: 2100 }).toInt(),
  query('month').isInt({ min: 1, max: 12 }).toInt(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      const userId = req.user!.userId;
      const { rows } = await pool.query<ExpectedRevenueRow>(
        `SELECT id, user_id, month, year, amount, created_at, updated_at
         FROM expected_revenue
         WHERE user_id = $1 AND year = $2 AND month = $3`,
        [userId, year, month]
      );
      if (rows.length === 0) {
        return res.json({ year, month, amount: null });
      }
      res.json({ year, month, amount: Number(rows[0].amount) });
    } catch (err) {
      console.error('Expected revenue get error:', err);
      res.status(500).json({
        error: 'Failed to load expected revenue',
        ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
      });
    }
  }
);

// Set expected revenue for a month (upsert)
router.put(
  '/expected',
  body('year').isInt({ min: 2000, max: 2100 }).toInt(),
  body('month').isInt({ min: 1, max: 12 }).toInt(),
  body('amount').isFloat({ min: 0 }).toFloat(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }
      const userId = req.user!.userId;
      const { year, month, amount } = req.body;
      const { rows } = await pool.query<ExpectedRevenueRow>(
        `INSERT INTO expected_revenue (user_id, year, month, amount)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, month, year)
         DO UPDATE SET amount = $4, updated_at = NOW()
         RETURNING id, user_id, month, year, amount, created_at, updated_at`,
        [userId, year, month, amount]
      );
      res.json(toExpected(rows[0]));
    } catch (err) {
      console.error('Expected revenue set error:', err);
      res.status(500).json({
        error: 'Failed to set expected revenue',
        ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
      });
    }
  }
);

export default router;
