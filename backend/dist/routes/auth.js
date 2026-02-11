"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_validator_1 = require("express-validator");
const pool_1 = require("../db/pool");
const config_1 = require("../config");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
function toPublic(user) {
    return {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        created_at: user.created_at,
    };
}
router.post('/signup', (0, express_validator_1.body)('email').isEmail().normalizeEmail(), (0, express_validator_1.body)('password').isLength({ min: 6 }), (0, express_validator_1.body)('displayName').optional().trim().isLength({ max: 100 }), async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const email = (req.body.email || '').trim().toLowerCase();
        const password = req.body.password;
        const displayName = req.body.displayName ? String(req.body.displayName).trim() : null;
        const client = await pool_1.pool.connect();
        try {
            const { rows: existing } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existing.length > 0) {
                res.status(409).json({ error: 'Email already registered' });
                return;
            }
            const password_hash = await bcrypt_1.default.hash(password, 10);
            const { rows } = await client.query(`INSERT INTO users (email, password_hash, display_name, role)
           VALUES ($1, $2, $3, 'member')
           RETURNING id, email, display_name, role, created_at`, [email, password_hash, displayName]);
            const user = rows[0];
            const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
            res.status(201).json({ user: toPublic(user), token });
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({
            error: 'Sign up failed',
            ...(config_1.config.nodeEnv === 'development' && err instanceof Error && { detail: err.message }),
        });
    }
});
router.post('/signin', (0, express_validator_1.body)('email').isEmail().normalizeEmail(), (0, express_validator_1.body)('password').notEmpty(), async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            res.status(400).json({ errors: errors.array() });
            return;
        }
        const email = (req.body.email || '').trim().toLowerCase();
        const password = req.body.password;
        const { rows } = await pool_1.pool.query('SELECT id, email, password_hash, display_name, role, created_at FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        const user = rows[0];
        const ok = await bcrypt_1.default.compare(password, user.password_hash);
        if (!ok) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, config_1.config.jwt.secret, { expiresIn: config_1.config.jwt.expiresIn });
        res.json({ user: toPublic(user), token });
    }
    catch (err) {
        console.error('Signin error:', err);
        res.status(500).json({
            error: 'Sign in failed',
            ...(config_1.config.nodeEnv === 'development' && err instanceof Error && { detail: err.message }),
        });
    }
});
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    const { rows } = await pool_1.pool.query('SELECT id, email, display_name, role, created_at FROM users WHERE id = $1', [req.user.userId]);
    if (rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json(toPublic(rows[0]));
});
exports.default = router;
