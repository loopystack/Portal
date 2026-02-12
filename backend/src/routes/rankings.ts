import { Router, Request, Response } from 'express';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

interface UserRow {
  id: string;
  display_name: string | null;
  email: string;
}

interface WorkHoursRow {
  user_id: string;
  daily_hours: number;
  weekly_hours: number;
  monthly_hours: number;
  total_hours: number;
}

interface RevenueRow {
  user_id: string;
  monthly_revenue: number;
  total_revenue: number;
  expected_revenue: number | null;
}

// Date bounds in app timezone (UTC+9 Asia/Yakutsk) — Node uses TZ=Asia/Yakutsk
function getWorkHoursRanges(): { todayS: string; todayE: string; weekS: string; weekE: string; monthS: string; monthE: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dayOfWeek = now.getDay();
  const todayS = new Date(y, m, d);
  const todayE = new Date(y, m, d + 1);
  const weekS = new Date(y, m, d - dayOfWeek);
  const weekE = new Date(weekS.getTime());
  weekE.setDate(weekE.getDate() + 7);
  const monthS = new Date(y, m, 1);
  const monthE = new Date(y, m + 1, 1);
  return {
    todayS: todayS.toISOString(),
    todayE: todayE.toISOString(),
    weekS: weekS.toISOString(),
    weekE: weekE.toISOString(),
    monthS: monthS.toISOString(),
    monthE: monthE.toISOString(),
  };
}

// GET /api/rankings/work-hours — all members' work hours (daily, weekly, monthly, total), Work blocks only
router.get('/work-hours', async (_req: Request, res: Response) => {
  try {
    const ranges = getWorkHoursRanges();
    const workQuery = `
      WITH ranges AS (
        SELECT
          $1::timestamptz AS today_s,
          $2::timestamptz AS today_e,
          $3::timestamptz AS week_s,
          $4::timestamptz AS week_e,
          $5::timestamptz AS month_s,
          $6::timestamptz AS month_e
      ),
      blocks AS (
        SELECT
          user_id,
          start_at,
          end_at,
          (SELECT today_s FROM ranges) AS today_s,
          (SELECT today_e FROM ranges) AS today_e,
          (SELECT week_s FROM ranges) AS week_s,
          (SELECT week_e FROM ranges) AS week_e,
          (SELECT month_s FROM ranges) AS month_s,
          (SELECT month_e FROM ranges) AS month_e
        FROM time_blocks, ranges
        WHERE summary IS NOT NULL AND (summary = 'Work' OR summary LIKE 'Work' || E'\\n\\n' || '%')
      )
      SELECT
        user_id,
        COALESCE(SUM(
          CASE WHEN start_at < today_e AND end_at > today_s
          THEN EXTRACT(EPOCH FROM (LEAST(end_at, today_e) - GREATEST(start_at, today_s))) / 3600
          ELSE 0 END
        ), 0) AS daily_hours,
        COALESCE(SUM(
          CASE WHEN start_at < week_e AND end_at > week_s
          THEN EXTRACT(EPOCH FROM (LEAST(end_at, week_e) - GREATEST(start_at, week_s))) / 3600
          ELSE 0 END
        ), 0) AS weekly_hours,
        COALESCE(SUM(
          CASE WHEN start_at < month_e AND end_at > month_s
          THEN EXTRACT(EPOCH FROM (LEAST(end_at, month_e) - GREATEST(start_at, month_s))) / 3600
          ELSE 0 END
        ), 0) AS monthly_hours,
        COALESCE(SUM(EXTRACT(EPOCH FROM (end_at - start_at)) / 3600), 0) AS total_hours
      FROM blocks
      GROUP BY user_id
    `;
    const { rows: workRows } = await pool.query<WorkHoursRow>(workQuery, [
      ranges.todayS,
      ranges.todayE,
      ranges.weekS,
      ranges.weekE,
      ranges.monthS,
      ranges.monthE,
    ]);
    const { rows: users } = await pool.query<UserRow>(
      "SELECT id, display_name, email FROM users WHERE role = 'member' ORDER BY display_name NULLS LAST, email"
    );
    const workByUser = new Map(workRows.map((r) => [r.user_id, r]));
    const result = users.map((u) => {
      const w = workByUser.get(u.id);
      return {
        userId: u.id,
        displayName: u.display_name || u.email,
        email: u.email,
        dailyHours: w ? Number(Number(w.daily_hours).toFixed(2)) : 0,
        weeklyHours: w ? Number(Number(w.weekly_hours).toFixed(2)) : 0,
        monthlyHours: w ? Number(Number(w.monthly_hours).toFixed(2)) : 0,
        totalHours: w ? Number(Number(w.total_hours).toFixed(2)) : 0,
      };
    });
    result.sort((a, b) => b.totalHours - a.totalHours);
    res.json(result);
  } catch (err) {
    console.error('Rankings work-hours error:', err);
    res.status(500).json({
      error: 'Failed to load work hours rankings',
      ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
    });
  }
});

// GET /api/rankings/revenue — all members' revenue (monthly, total) and expected
// Optional query: ?year=YYYY&month=M (1-12) to get revenue for a specific month
router.get('/revenue', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const queryYear = req.query.year != null ? Number(req.query.year) : null;
    const queryMonth = req.query.month != null ? Number(req.query.month) : null;
    const useSpecificMonth = typeof queryYear === 'number' && typeof queryMonth === 'number' &&
      queryMonth >= 1 && queryMonth <= 12 && queryYear >= 2000 && queryYear <= 2100;

    const year = useSpecificMonth ? queryYear : now.getFullYear();
    const month = useSpecificMonth ? queryMonth : now.getMonth() + 1;
    const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEndDate = new Date(year, month, 0);
    const monthEndStr = monthEndDate.toISOString().slice(0, 10);

    const { rows: revRows } = await pool.query<{ user_id: string; total: number; monthly: number }>(
      `SELECT user_id,
        SUM(amount) AS total,
        SUM(CASE WHEN date >= $1 AND date <= $2 THEN amount ELSE 0 END) AS monthly
       FROM revenue_entries
       GROUP BY user_id`,
      [monthStartStr, monthEndStr]
    );
    const { rows: expRows } = await pool.query<{ user_id: string; amount: number }>(
      'SELECT user_id, amount FROM expected_revenue WHERE year = $1 AND month = $2',
      [year, month]
    );
    const { rows: users } = await pool.query<UserRow>(
      "SELECT id, display_name, email FROM users WHERE role = 'member' ORDER BY display_name NULLS LAST, email"
    );
    const revByUser = new Map(revRows.map((r) => [r.user_id, { total: Number(r.total), monthly: Number(r.monthly) }]));
    const expByUser = new Map(expRows.map((r) => [r.user_id, Number(r.amount)]));
    const result = users.map((u) => {
      const r = revByUser.get(u.id);
      const exp = expByUser.get(u.id);
      return {
        userId: u.id,
        displayName: u.display_name || u.email,
        email: u.email,
        monthlyRevenue: r ? Number(Number(r.monthly).toFixed(2)) : 0,
        totalRevenue: r ? Number(Number(r.total).toFixed(2)) : 0,
        expectedRevenue: exp != null ? Number(Number(exp).toFixed(2)) : null,
      };
    });
    result.sort((a, b) => b.totalRevenue - a.totalRevenue);
    res.json(result);
  } catch (err) {
    console.error('Rankings revenue error:', err);
    res.status(500).json({
      error: 'Failed to load revenue rankings',
      ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
    });
  }
});

export default router;
