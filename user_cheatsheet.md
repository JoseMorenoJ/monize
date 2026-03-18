# Monize User Cheatsheet

## Quick Start

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env and set at least POSTGRES_PASSWORD
```

### 2. Start the app (development)

```bash
docker compose -f docker-compose.dev.yml up -d
```

- Frontend: http://localhost:3001
- Backend API: http://localhost:3000
- PostgreSQL: localhost:5432 (only on 127.0.0.1)

### 3. Start the app (production)

```bash
# .env MUST have COOKIE_SECRET set (min 32 chars)
# Generate one: openssl rand -base64 32
docker compose -f docker-compose.prod.yml up -d --build
```

Production exposes only the frontend port (default 3000). Backend and database are internal.

### 4. First use

1. Open the frontend URL in your browser
2. You'll be redirected to the profile picker (`/profiles`)
3. Create your first profile (just a name and color -- no passwords)
4. Click the profile to enter the app

---

## Architecture Overview

```
Browser --> Frontend (Next.js, port 3001/3000)
                |
                | proxies /api/* requests
                v
            Backend (NestJS, port 3000 internal)
                |
                v
            PostgreSQL (port 5432 internal)
```

- **No passwords or login** -- profiles are selected with a single click (like Netflix)
- Session is a signed httpOnly cookie (`profile_session`), valid for 30 days
- The frontend proxy handles cookie forwarding, CSP headers, and auth redirects

---

## Data Storage

### Where is my data?

All data lives in a **Docker named volume** called `postgres_data`.

```bash
# See volume details (location on disk, size, etc.)
docker volume inspect monize_postgres_data
```

### Will I lose data if...

| Action | Data safe? |
|--------|-----------|
| `docker compose down` | Yes -- volume persists |
| `docker compose down && docker compose up` | Yes |
| Container crashes / restarts | Yes |
| `docker compose down -v` | **NO** -- `-v` deletes volumes |
| `docker volume rm monize_postgres_data` | **NO** |
| Rebuild containers (`--build`) | Yes |

### Backing up the database

```bash
# Export a full backup (filename includes today's date)
docker exec monize-postgres pg_dump -U monize_user -d monize > monize_backup_$(date +%Y%m%d).sql

# Restore from backup
docker exec -i monize-postgres psql -U monize_user -d monize < monize_backup_20260318.sql
```

---

## Useful Commands

### Container status

```bash
# See running containers and health status
docker compose -f docker-compose.dev.yml ps

# Or for production
docker compose -f docker-compose.prod.yml ps
```

### Logs

```bash
# All containers
docker compose -f docker-compose.dev.yml logs -f

# Specific container
docker logs -f monize-backend
docker logs -f monize-frontend
docker logs -f monize-postgres

# Last 100 lines
docker logs --tail 100 monize-backend
```

### Database access

```bash
# Interactive psql session
docker exec -it monize-postgres psql -U monize_user -d monize

# Run a single query
docker exec monize-postgres psql -U monize_user -d monize -c "SELECT * FROM users;"

# List all tables
docker exec monize-postgres psql -U monize_user -d monize -c "\dt"

# Check table structure
docker exec monize-postgres psql -U monize_user -d monize -c "\d users"
docker exec monize-postgres psql -U monize_user -d monize -c "\d accounts"
```

### Common database queries

```bash
# List all profiles
docker exec monize-postgres psql -U monize_user -d monize -c \
  "SELECT id, first_name, last_name, avatar_color FROM users;"

# Count records per table
docker exec monize-postgres psql -U monize_user -d monize -c \
  "SELECT 'accounts' as tbl, count(*) FROM accounts
   UNION ALL SELECT 'transactions', count(*) FROM transactions
   UNION ALL SELECT 'categories', count(*) FROM categories;"

# Check which migrations have been applied
docker exec monize-postgres psql -U monize_user -d monize -c \
  "SELECT * FROM applied_migrations ORDER BY applied_at;"
```

### Restart / rebuild

```bash
# Restart a single container
docker restart monize-backend

# Rebuild and restart everything (keeps data)
docker compose -f docker-compose.dev.yml up -d --build

# Full reset (DESTROYS ALL DATA)
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d
```

### Running backend commands inside Docker

Node.js is not available on the host. Run commands inside the container:

```bash
# Run backend tests
docker exec monize-backend npm run test

# Run backend linter
docker exec monize-backend npm run lint

# Run frontend type check
docker exec monize-frontend npm run type-check
```

---

## Environment Variables

| Variable | Required | Default (dev) | Description |
|----------|----------|---------------|-------------|
| `POSTGRES_DB` | No | `monize` | Database name |
| `POSTGRES_USER` | No | `monize_user` | Database user |
| `POSTGRES_PASSWORD` | Yes (prod) | `monize_password` | Database password |
| `COOKIE_SECRET` | Yes (prod) | auto in dev | Signs session cookies (min 32 chars) |
| `FRONTEND_PORT` | No | `3001` (dev) / `3000` (prod) | Host port for the frontend |
| `BACKEND_PORT` | No | `3000` | Host port for the backend (dev only) |
| `PUBLIC_APP_URL` | No | `http://localhost:3001` | Public URL of the frontend |
| `DEMO_MODE` | No | `false` | Enables demo mode with sample data |
| `AI_ENCRYPTION_KEY` | No | -- | Encryption key for AI API keys (min 32 chars) |

Generate secrets:
```bash
openssl rand -base64 32    # For COOKIE_SECRET
openssl rand -hex 32       # For AI_ENCRYPTION_KEY
```

---

## Key Concepts

### Profiles (not users/accounts)

Monize uses a Netflix-style profile system. There are no passwords, emails, or login screens. Each profile has its own accounts, transactions, budgets, etc. All data is scoped to the active profile.

### Database schema and migrations

- `database/schema.sql` -- the complete schema used for fresh installs
- `database/migrations/` -- incremental SQL migrations, auto-applied on backend startup
- Both are kept in sync. Migrations are idempotent (safe to re-run).

### API structure

All backend endpoints are under `/api/v1/`. The frontend proxies these requests internally. You never need to call the backend directly.

Swagger API docs are available at http://localhost:3000/api/docs (development only, not production).

### Demo mode

Set `DEMO_MODE=true` in `.env` to:
- Seed sample data on first start
- Reset all data daily at 4:00 AM UTC
- Restrict destructive write operations

---

## Network Access (LAN / VPN / Tailscale)

By default, Monize is only accessible from the machine running Docker (`localhost`). To access it from other devices on your network (or via a VPN like Tailscale), you need to configure two things:

### 1. Set PUBLIC_APP_URL and CORS_ORIGIN

In your `.env`, set both to the URL other devices will use to reach the app:

```bash
# LAN access (use your machine's local IP)
PUBLIC_APP_URL=http://192.168.1.50:3001
CORS_ORIGIN=http://192.168.1.50:3001

# Tailscale access (use your Tailscale IP or MagicDNS hostname)
PUBLIC_APP_URL=http://my-machine.tail1234.ts.net:3001
CORS_ORIGIN=http://my-machine.tail1234.ts.net:3001
```

These must match the **exact URL in the browser's address bar**. `0.0.0.0` is not valid here -- it is a listen address, not a reachable address.

If you also access the app locally, use the IP/hostname consistently (even from the host machine) so the CORS origin always matches.

### 2. Port binding

**Development:** The frontend port is bound to all interfaces by default. Backend and PostgreSQL remain on `127.0.0.1` only (they don't need external access since the frontend proxy handles all communication).

**Production:** The frontend port is already bound to all interfaces.

### After changing .env

Restart the containers for the changes to take effect:

```bash
# Development
docker compose -f docker-compose.dev.yml up -d

# Production
docker compose -f docker-compose.prod.yml up -d
```

### Finding your IP

```bash
# Local network IP
hostname -I | awk '{print $1}'

# Tailscale IP
tailscale ip -4

# Tailscale MagicDNS hostname
tailscale status | head -1
```

### Port reference

| Compose file | Frontend port | Notes |
|-------------|---------------|-------|
| Dev | `3001` (configurable via `FRONTEND_PORT`) | Backend also exposed on `3000` (localhost only) |
| Prod | `3000` (configurable via `FRONTEND_PORT`) | Only frontend is exposed |

---

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker logs monize-backend
docker logs monize-frontend

# Verify postgres is healthy
docker compose -f docker-compose.dev.yml ps
```

### "Profile session expired" / redirected to /profiles

The session cookie expires after 30 days or if the profile was deleted. Just select a profile again.

### Database connection errors

Make sure postgres is healthy before the backend starts. The dev compose file handles this with `depends_on: condition: service_healthy`. If postgres is slow to start, restart the backend:

```bash
docker restart monize-backend
```

### Resetting everything from scratch

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d --build
```

This destroys all data and rebuilds all containers from scratch.
