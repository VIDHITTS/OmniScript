#!/bin/sh
set -e

echo "Checking environment variables..."
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL environment variable is not set!"
  exit 1
fi

echo "DATABASE_URL is set"

# Create uploads directory if it doesn't exist
echo "Creating uploads directory..."
mkdir -p uploads

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting application..."
node dist/index.js
