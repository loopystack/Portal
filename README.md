# PYCE Portal

Team portal for tracking working time and revenue with rankings.

## Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL

## Setup

### Start both servers (one command)

From the project root, after backend and frontend have been set up once:

```bash
npm install          # install root deps (concurrently) + run once in backend/ and frontend/
npm run dev          # starts API (port 4000) and frontend (port 3000) together
```

Logs are prefixed with `[api]` and `[web]`.

### 1. PostgreSQL

Create a database:

```bash
createdb pyce_portal
```

Or with psql:

```sql
CREATE DATABASE pyce_portal;
```

### 2. Backend

```bash
cd backend
# Copy env.example to .env and set DATABASE_URL (PostgreSQL) and JWT_SECRET
# Windows: copy env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

API runs at `http://localhost:4000`.

- **Seed admin:** `admin@pyce.com` / `admin123`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:3000` and proxies `/api` to the backend.

## Scripts

| Where  | Command           | Description                          |
|--------|-------------------|--------------------------------------|
| **root** | `npm run dev`    | Start API + frontend together        |
| root  | `npm run migrate` | Run DB migrations (backend)          |
| root  | `npm run seed`    | Seed admin user (backend)            |
| root  | `npm run build`   | Build backend + frontend             |
| backend  | `npm run dev`  | Start API only (port 4000)           |
| frontend | `npm run dev`  | Start frontend only (port 3000)      |

## Development plan

See [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) for phases and roadmap.
