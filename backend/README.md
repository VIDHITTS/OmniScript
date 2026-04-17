---
title: OmniScript Backend
emoji: 🚀
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# OmniScript Backend API

AI-powered knowledge operating system with RAG capabilities.

## Features

- 📄 Multi-format document processing (PDF, text, markdown, CSV, code)
- 🔍 Hybrid retrieval (vector + keyword search)  
- 🤖 Agentic RAG with tool calling
- 💬 Conversational AI with context compression
- 📊 Knowledge graph extraction
- 🔐 JWT authentication with PostgreSQL-based refresh tokens

## Configuration

This Space uses Docker SDK with the following configuration:
- **Port**: 7860 (configured in `app_port`)
- **Build**: Multi-stage Docker build with TypeScript compilation
- **Runtime**: Node.js 22 Alpine
- **Database**: PostgreSQL (Neon) + MongoDB (GridFS)

## Environment Variables

Set these in your Space settings as **Secrets**:

### Required
- `DATABASE_URL` - PostgreSQL connection string (Neon)
- `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for access tokens (min 10 chars)
- `JWT_REFRESH_SECRET` - Secret for refresh tokens (min 10 chars)
- `GROQ_API_KEY` - Groq API key for LLM
- `COHERE_API_KEY` - Cohere API key for reranking

### Optional
- `STORAGE_BACKEND` - Storage backend (default: GRIDFS)
- `CORS_ORIGIN` - CORS origin (default: http://localhost:3000)
- `NODE_ENV` - Environment (default: development)
- `PORT` - Port number (default: 3000, HF uses 7860)

### Not Required
- `REDIS_URL` - Redis is optional (removed for HF Spaces deployment)

## Startup Process

1. Docker builds the image with Prisma client generation
2. On startup, `start.sh` runs Prisma migrations (`prisma migrate deploy`)
3. Application starts on port 7860

## API Endpoints

- Health: `GET /health`
- Auth: `/api/auth/*` (register, login, refresh, logout)
- Workspaces: `/api/workspaces/*`
- Documents: `/api/workspaces/:id/documents/*`
- Chat: `/api/workspaces/:id/chat/*`

## License

MIT
