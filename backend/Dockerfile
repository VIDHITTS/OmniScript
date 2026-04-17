# Multi-stage build for OmniScript Backend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client (with dummy DATABASE_URL for build time)
# The real DATABASE_URL will be provided at runtime via environment variables
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# Expose port
EXPOSE 7860

# Start the application
CMD ["node", "dist/index.js"]
