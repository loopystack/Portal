"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pool_1 = require("../db/pool");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// GET /api/team/members — list all members (any authenticated user, for team time logs)
router.get('/members', async (_req, res) => {
    try {
        const { rows } = await pool_1.pool.query(`SELECT id, display_name, email FROM users WHERE role = 'member' ORDER BY display_name NULLS LAST, email`);
        res.json(rows.map((r) => ({
            id: r.id,
            displayName: r.display_name || r.email,
            email: r.email,
        })));
    }
    catch (err) {
        console.error('Team members list error:', err);
        res.status(500).json({
            error: 'Failed to load members',
            ...(process.env.NODE_ENV === 'development' && err instanceof Error && { detail: err.message }),
        });
    }
});
exports.default = router;
