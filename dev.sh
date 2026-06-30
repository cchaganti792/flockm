#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> Checking Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "ERROR: Docker is not running. Open Docker Desktop and try again."
  exit 1
fi
echo "    Docker is running."

echo "==> Starting Supabase..."
cd "$ROOT"
supabase start > /dev/null 2>&1 || true
supabase status

echo ""
echo "==> Applying database migrations..."
cd "$ROOT/api"
npx prisma migrate deploy
echo "    Migrations up to date."

echo ""
echo "==> Seeding topics (safe to run — uses upsert)..."
npx prisma db seed
echo ""

echo "==> Starting NestJS API (watch mode)..."
echo "    Prisma query logs will appear in this terminal."
echo "    Press Ctrl+C to stop."
echo ""
npm run start:dev
