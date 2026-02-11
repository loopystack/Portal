"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
function toBlock(row) {
    return {
        id: row.id,
        userId: row.user_id,
        startAt: row.start_at,
        endAt: row.end_at,
        summary: row.summary,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
// List time blocks in range (member: own only; admin: optional userId for any member)
router.get('/', (0, express_validator_1.query)('from').isISO8601(), (0, express_validator_1.query)('to').isISO8601(), (0, express_validator_1.query)('userId').optional().isUUID(), async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const from = req.query.from;
        const to = req.query.to;
        const targetUserId = req.user.role === 'admin' && typeof req.query.userId === 'string'
            ? req.query.userId
            : req.user.userId;
        const { rows } = await pool_1.pool.query(`SELECT id, user_id, start_at, end_at, summary, created_at, updated_at
         FROM time_blocks
         WHERE user_id = $1 AND end_at > $2 AND start_at < $3
         ORDER BY start_at`, [targetUserId, from, to]);
        res.json(rows.map(toBlock));
    }
    catch (err) {
        console.error('Time blocks list error:', err);
        res.status(500).json({
            error: 'Failed to load time blocks',
            ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
        });
    }
});
// Create
router.post('/', (0, express_validator_1.body)('startAt').isISO8601(), (0, express_validator_1.body)('endAt').isISO8601(), (0, express_validator_1.body)('summary').optional().trim().isLength({ max: 2000 }), async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const { startAt, endAt, summary } = req.body;
        const start = new Date(startAt);
        const end = new Date(endAt);
        if (end.getTime() <= start.getTime()) {
            res.status(400).json({ error: 'endAt must be after startAt' });
            return;
        }
        const userId = req.user.userId;
        const { rows: existing } = await pool_1.pool.query(`SELECT id, start_at, end_at FROM time_blocks
         WHERE user_id = $1 AND end_at > $2 AND start_at < $3`, [userId, start, end]);
        if (existing.length > 0) {
            res.status(409).json({ error: 'Time block overlaps an existing block' });
            return;
        }
        const { rows } = await pool_1.pool.query(`INSERT INTO time_blocks (user_id, start_at, end_at, summary)
         VALUES ($1, $2, $3, $4)
         RETURNING id, user_id, start_at, end_at, summary, created_at, updated_at`, [userId, start, end, summary || null]);
        res.status(201).json(toBlock(rows[0]));
    }
    catch (err) {
        console.error('Time block create error:', err);
        res.status(500).json({
            error: 'Failed to create time block',
            ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
        });
    }
});
// Update
router.patch('/:id', (0, express_validator_1.param)('id').isUUID(), (0, express_validator_1.body)('startAt').optional().isISO8601(), (0, express_validator_1.body)('endAt').optional().isISO8601(), (0, express_validator_1.body)('summary').optional().trim().isLength({ max: 2000 }), async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const id = req.params.id;
        const userId = req.user.userId;
        const { startAt, endAt, summary } = req.body;
        const updates = [];
        const values = [];
        let i = 1;
        if (startAt !== undefined) {
            updates.push(`start_at = $${i++}`);
            values.push(new Date(startAt));
        }
        if (endAt !== undefined) {
            updates.push(`end_at = $${i++}`);
            values.push(new Date(endAt));
        }
        if (summary !== undefined) {
            updates.push(`summary = $${i++}`);
            values.push(summary === '' ? null : summary);
        }
        if (updates.length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }
        updates.push(`updated_at = NOW()`);
        values.push(id, userId);
        const { rows } = await pool_1.pool.query(`UPDATE time_blocks SET ${updates.join(', ')}
         WHERE id = $${i} AND user_id = $${i + 1}
         RETURNING id, user_id, start_at, end_at, summary, created_at, updated_at`, values);
        if (rows.length === 0) {
            res.status(404).json({ error: 'Time block not found' });
            return;
        }
        res.json(toBlock(rows[0]));
    }
    catch (err) {
        console.error('Time block update error:', err);
        res.status(500).json({
            error: 'Failed to update time block',
            ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
        });
    }
});
// Delete
router.delete('/:id', (0, express_validator_1.param)('id').isUUID(), async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const id = req.params.id;
        const userId = req.user.userId;
        const { rowCount } = await pool_1.pool.query('DELETE FROM time_blocks WHERE id = $1 AND user_id = $2', [id, userId]);
        if (rowCount === 0) {
            res.status(404).json({ error: 'Time block not found' });
            return;
        }
        res.status(204).send();
    }
    catch (err) {
        console.error('Time block delete error:', err);
        res.status(500).json({
            error: 'Failed to delete time block',
            ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
        });
    }
});
exports.default = router;
