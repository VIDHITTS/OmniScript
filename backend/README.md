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
- 🔐 JWT authentication

## Environment Variables

Set these in your Space settings as **Secrets**.

## API Endpoints

- Health: `GET /health`
- Auth: `/api/auth/*`
- Workspaces: `/api/workspaces/*`

## License

MIT
