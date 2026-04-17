#!/bin/sh
set -e

echo "Checking environment variables..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

echo "DATABASE_URL is set"
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting application..."
node dist/index.js
