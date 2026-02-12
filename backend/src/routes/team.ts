import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

interface MemberRow {
  id: string;
  display_name: string | null;
  email: string;
}

// GET /api/team/members — list all members (any authenticated user, for team time logs)
router.get('/members', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query<MemberRow>(
      `SELECT id, display_name, email FROM users WHERE role = 'member' ORDER BY display_name NULLS LAST, email`
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        displayName: r.display_name || r.email,
        email: r.email,
      }))
    );
  } catch (err) {
    console.error('Team members list error:', err);
    res.status(500).json({
      error: 'Failed to load members',
      ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
    });
  }
});

export default router;
