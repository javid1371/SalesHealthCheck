#!/bin/sh
set -e

PRISMA_BIN="${PRISMA_TOOLS:-/prisma-tools}/node_modules/.bin"

echo "Running database migrations..."
"$PRISMA_BIN/prisma" migrate deploy

echo "Checking if seed is needed..."
SEED_NEEDED=$(NODE_PATH="${PRISMA_TOOLS:-/prisma-tools}/node_modules" node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.modelVersion.findFirst({ where: { status: 'active' }, include: { _count: { select: { questions: true } } } })
  .then((mv) => { console.log(mv && mv._count.questions >= 80 ? 'no' : 'yes'); })
  .catch(() => { console.log('yes'); })
  .finally(() => prisma.\$disconnect());
")

if [ "$SEED_NEEDED" = "yes" ]; then
  echo "Seeding database..."
  "$PRISMA_BIN/tsx" prisma/seed.ts
else
  echo "Active model already seeded. Skipping seed."
fi

echo "Starting application..."
exec "$@"
