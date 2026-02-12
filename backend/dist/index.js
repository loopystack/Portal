"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// All members use the same fixed timezone: UTC+9 (Asia/Yakutsk)
process.env.TZ = 'Asia/Yakutsk';
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const auth_1 = __importDefault(require("./routes/auth"));
const timeBlocks_1 = __importDefault(require("./routes/timeBlocks"));
const revenue_1 = __importDefault(require("./routes/revenue"));
const rankings_1 = __importDefault(require("./routes/rankings"));
const admin_1 = __importDefault(require("./routes/admin"));
const team_1 = __importDefault(require("./routes/team"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use('/api/auth', auth_1.default);
app.use('/api/time-blocks', timeBlocks_1.default);
app.use('/api/revenue', revenue_1.default);
app.use('/api/rankings', rankings_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/team', team_1.default);
app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
});
// Serve built frontend (avoids Vite dev server so http://95.216.225.37:3000 works)
const frontendDist = path_1.default.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs_1.default.existsSync(frontendDist)) {
    app.use(express_1.default.static(frontendDist));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api'))
            return next();
        res.sendFile(path_1.default.join(frontendDist, 'index.html'));
    });
}
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        ...(config_1.config.nodeEnv === 'development' && { detail: err.message }),
    });
});
const host = process.env.HOST || '0.0.0.0';
app.listen(config_1.config.port, host, () => {
    console.log(`PYCE Portal running on http://${host === '0.0.0.0' ? 'localhost' : host}:${config_1.config.port}`);
});
