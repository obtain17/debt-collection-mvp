#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations..."
npx prisma migrate deploy

if [ "$SERVICE_ROLE" = "worker" ]; then
  echo "[entrypoint] Starting dunning worker..."
  exec npm run worker
else
  echo "[entrypoint] Seeding demo data (skipped automatically if already present)..."
  npm run db:seed
  echo "[entrypoint] Starting web app..."
  exec npm start
fi
