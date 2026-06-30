# Developer Setup Guide

Everything a new developer needs to get flockm running locally from scratch.

---

## What You're Setting Up

```
Your Machine
├── Docker Desktop        — runs Supabase stack in containers
├── Supabase CLI          — manages local Supabase (PostgreSQL + Studio)
├── Node.js               — runs the NestJS API
├── NestJS CLI            — NestJS project tooling
└── Expo CLI              — React Native mobile app (coming soon)

Local services (once started):
├── PostgreSQL            — localhost:54322
├── Supabase Studio       — http://localhost:54323  (visual DB browser)
└── NestJS API            — http://localhost:3000
```

---

## Step 1 — Install Prerequisites

### Node.js (v20 or higher)

**Download:** https://nodejs.org/en/download

**Recommended:** Use `nvm` to manage Node versions.

```bash
# Install nvm (Mac/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Install and use Node 20
nvm install 20
nvm use 20

# Verify
node --version   # should print v20.x.x or higher
npm --version    # should print 10.x.x or higher
```

---

### Docker Desktop (v24 or higher)

Supabase runs its local stack inside Docker containers. Docker Desktop must be installed and **running** before you start Supabase.

**Download:** https://www.docker.com/products/docker-desktop/

- Mac (Apple Silicon): choose the **Apple Chip** download
- Mac (Intel): choose the **Intel Chip** download
- Windows: choose the **Windows** download

After installing, open Docker Desktop and wait for the whale icon in your menu bar to stop animating — that means Docker is ready.

**Verify:**
```bash
docker --version    # should print Docker version 24.x.x or higher
docker info         # should print system info without errors
```

> **First-time Docker prompt:** Docker may ask for permission to find devices on your local network. **Allow it** — Docker containers need this to communicate with each other and expose ports to your machine.

---

### Supabase CLI (v2 or higher)

**Install via Homebrew (Mac):**
```bash
brew install supabase/tap/supabase

# Verify
supabase --version   # should print 2.x.x or higher
```

**Install via npm (Windows/Linux):**
```bash
npm install -g supabase

# Verify
supabase --version
```

---

### NestJS CLI (v10 or higher)

```bash
npm install -g @nestjs/cli

# Verify
nest --version   # should print 10.x.x or higher
```

---

## Step 2 — Clone the Repository

```bash
git clone https://github.com/your-org/flockm.git
cd flockm
```

---

## Step 3 — Set Up Environment Variables

The API reads database credentials from a `.env` file. Copy the example:

```bash
cp api/.env.example api/.env
```

Open `api/.env`. The only value you need to change is `JWT_SECRET`:

```env
NODE_ENV=development

# Supabase local DB — DO NOT CHANGE these values
# Supabase CLI always uses these fixed credentials on every developer's machine.
# Port 54322, username "postgres", password "postgres" are Supabase CLI defaults —
# they are the same on every laptop. No need to update them after setup.
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

# JWT secret — use any random string for local dev
JWT_SECRET="local-dev-secret-change-in-production"
```

> **Why are the DB URLs the same for everyone?**
> Supabase CLI always starts PostgreSQL on port `54322` with username `postgres` and password `postgres` on every machine — these are fixed defaults baked into the CLI, not tied to your machine. Every developer gets identical local credentials. The only thing that changes per environment is production, which uses a real Supabase cloud URL stored separately and never committed to git.

---

## Step 4 — Install API Dependencies

```bash
cd api
npm install
cd ..
```

---

## Step 5 — Start the Dev Environment

Make the start script executable (first time only):
```bash
chmod +x dev.sh
```

Start everything:
```bash
./dev.sh
```

This will:
1. Check Docker is running
2. Start local Supabase (pulls Docker images on first run — takes 2–3 minutes)
3. Start the NestJS API in watch mode

You should see:
```
==> Checking Docker...
    Docker is running.
==> Starting Supabase...
         API URL: http://127.0.0.1:54321
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    ...
==> Applying database migrations...
    Migrations up to date.

==> Seeding topics (safe to run — uses upsert)...
Seeded topics: nature, architecture, travel, food, street-photography

==> Starting NestJS API (watch mode)...

[Nest] LOG [NestApplication] Nest application successfully started
```

---

## Step 6 — Verify Everything Works

**Supabase Studio** — visual database browser:
Open http://localhost:54323 in your browser. You should see the tables under the `user`, `topic`, and `media` schemas, and 5 rows in `topic.topics`.

**API health check:**
```bash
curl http://localhost:3000
```

---

## Database Schemas

The database is divided into schemas by domain. Never put tables in `public`.

| Schema | Tables | Purpose |
|--------|--------|---------|
| `user` | `accounts` | User accounts and auth |
| `topic` | `topics`, `follows` | Topics and user follows |
| `media` | `photos`, `photo_likes` | Photos and likes |
| `chat` | *(empty, reserved)* | Future messaging |

---

## Tech Stack Reference

| Layer | Technology | Version | Docs |
|-------|-----------|---------|------|
| Mobile | Expo + React Native | SDK 51+ | https://docs.expo.dev |
| Backend | Node.js + NestJS | Node 20+, NestJS 10+ | https://docs.nestjs.com |
| ORM | Prisma | v7+ | https://www.prisma.io/docs |
| Database | PostgreSQL via Supabase | Postgres 15 | https://supabase.com/docs |
| Realtime | Supabase Realtime | — | https://supabase.com/docs/guides/realtime |
| Storage | Supabase Storage | — | https://supabase.com/docs/guides/storage |

---

## Daily Workflow

```bash
# Start everything
./dev.sh

# In a second terminal — useful Prisma commands
cd api
npx prisma studio          # visual schema browser (alternative to Supabase Studio)
npx prisma migrate dev     # create a new migration after editing schema.prisma
npx prisma db seed         # re-run the seed (safe — uses upsert)
npx prisma generate        # regenerate client after schema changes
```

---

## Stopping the Environment

**Stop the API:** `Ctrl+C` in the terminal running `dev.sh`

**Stop Supabase** (optional — Docker keeps containers running across reboots):
```bash
supabase stop
```

**Stop all Supabase containers and remove data** (full reset):
```bash
supabase stop --no-backup
```

---

## Troubleshooting

**`docker info` fails / Docker not running**
→ Open Docker Desktop and wait for it to fully start before running `./dev.sh`.

**`supabase start` hangs or fails**
→ Make sure Docker Desktop is running. Try `supabase stop` then `supabase start` again.

**`DATABASE_URL` undefined error in API**
→ Make sure `api/.env` exists and has `DATABASE_URL` set. Copy from `api/.env.example`.

**Port 54322 or 3000 already in use**
→ Another process is using that port. Run `lsof -i :54322` or `lsof -i :3000` to find it.

**`nest build` TypeScript errors after pulling new code**
→ Run `cd api && npm install` to pick up any new dependencies, then try again.

**Tables missing in Supabase Studio**
→ Run `cd api && npx prisma migrate deploy` to apply any migrations you may have missed.
