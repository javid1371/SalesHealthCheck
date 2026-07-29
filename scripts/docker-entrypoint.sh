#!/bin/sh
set -e

PRISMA_BIN="${PRISMA_TOOLS:-/prisma-tools}/node_modules/.bin"

# Prefer DIRECT_URL (Postgres) for migrate/seed when PgBouncer fronts DATABASE_URL.
MIGRATE_URL="${DIRECT_URL:-$DATABASE_URL}"

echo "Running database migrations..."
DATABASE_URL="${MIGRATE_URL}" "$PRISMA_BIN/prisma" migrate deploy

echo "Checking if seed is needed..."
SEED_NEEDED=$(DATABASE_URL="${MIGRATE_URL}" NODE_PATH="${PRISMA_TOOLS:-/prisma-tools}/node_modules" node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.modelVersion.findFirst({ where: { status: 'active' }, include: { _count: { select: { questions: true } } } })
  .then((mv) => { console.log(mv && mv._count.questions >= 80 ? 'no' : 'yes'); })
  .catch(() => { console.log('yes'); })
  .finally(() => prisma.\$disconnect());
")

if [ "$SEED_NEEDED" = "yes" ]; then
  echo "Seeding database..."
  DATABASE_URL="${MIGRATE_URL}" "$PRISMA_BIN/tsx" prisma/seed.ts
else
  echo "Active model already seeded. Skipping seed."
fi

echo "Starting application..."
exec "$@"
