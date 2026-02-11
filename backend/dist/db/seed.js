"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const pool_1 = require("./pool");
async function seed() {
    const client = await pool_1.pool.connect();
    try {
        const adminEmail = 'admin@pyce.com';
        const { rows } = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (rows.length > 0) {
            console.log('Admin user already exists.');
            return;
        }
        const hash = await bcrypt_1.default.hash('admin123', 10);
        await client.query(`INSERT INTO users (email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4)`, [adminEmail, hash, 'PYCE Admin', 'admin']);
        console.log('Seeded admin user: admin@pyce.com / admin123');
    }
    finally {
        client.release();
        await pool_1.pool.end();
    }
}
seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
