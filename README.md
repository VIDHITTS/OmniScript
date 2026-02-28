# OmniScript

> AI-powered knowledge OS — ingest, search, and converse with your documents.

OmniScript lets you ingest PDFs, YouTube videos, web pages, audio, images, and code — then ask questions, get cited answers, explore a knowledge graph, and generate study materials. Built with Agentic RAG, hybrid search, and real-time collaboration.

---

## ✨ Features

| Category               | Features                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| **🔐 Auth**            | Email/password, Google/GitHub OAuth, MFA, API keys                     |
| **📁 Workspaces**      | Isolated knowledge vaults with templates, RBAC, analytics              |
| **📄 Ingestion**       | PDF, Markdown, YouTube, Web URL, Audio, Images, Code, CSV              |
| **🤖 Agentic RAG**     | Multi-step reasoning, tool selection, query rewriting, self-evaluation |
| **🔍 Hybrid Search**   | Vector (pgvector) + Full-Text (BM25) + Reciprocal Rank Fusion          |
| **🕸️ Knowledge Graph** | Auto-extracted entities & relationships, visual explorer               |
| **💬 Chat**            | Multi-turn, branching, bookmarks, follow-ups, streaming                |
| **📊 Artifacts**       | Summaries, flashcards, mind maps, timelines, study guides, glossaries  |
| **👥 Collaboration**   | Shared workspaces, live chat, annotations, activity feed               |
| **🔌 Integrations**    | REST API, webhooks, Chrome extension, Slack bot                        |
| **📈 Observability**   | Usage dashboard, cost tracking, RAG quality metrics, audit logs        |
| **🔒 Security**        | AES-256 encryption, Row-Level Security, GDPR compliance                |

---

## 🏗️ Tech Stack

| Layer            | Technology                                     |
| ---------------- | ---------------------------------------------- |
| Frontend         | React, Next.js, Tailwind CSS, shadcn/ui        |
| API Server       | Express, TypeScript                            |
| ORM              | Prisma                                         |
| Database         | PostgreSQL 16 + pgvector + pg_trgm             |
| Queue            | BullMQ + Redis                                 |
| Cache            | Redis                                          |
| Real-Time        | Socket.io                                      |
| File Storage     | S3 (prod) / MinIO (local)                      |
| AI               | OpenAI GPT-4o, text-embedding-3-small, Whisper |
| Monitoring       | Sentry, Prometheus + Grafana                   |
| Containerization | Docker + Docker Compose                        |
| CI/CD            | GitHub Actions                                 |

---

## 📐 Documentation

| File                                       | Description                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| [idea.md](./idea.md)                       | Full project vision, features, architecture, and build phases            |
| [useCaseDiagram.md](./useCaseDiagram.md)   | Complete use case diagram (all actors and flows)                         |
| [sequenceDiagram.md](./sequenceDiagram.md) | Sequence diagrams (auth, ingestion, agentic RAG, KG, artifacts)          |
| [classDiagram.md](./classDiagram.md)       | Domain model with design patterns                                        |
| [ErDiagram.md](./ErDiagram.md)             | Full database schema (17 tables) with indexes and architecture decisions |

---

## 🚀 Build Phases

- [x] **Phase 1** — Foundation (Auth, Workspaces, Upload, Basic RAG, Citations)
- [ ] **Phase 2** — Intelligence (Agentic RAG, Hybrid Search, YouTube/Web ingestion)
- [ ] **Phase 3** — Knowledge Graph (Entity extraction, graph explorer, gap detection)
- [ ] **Phase 4** — Multi-Modal + Artifacts (Audio, images, flashcards, timelines)
- [ ] **Phase 5** — Collaboration & Platform (RBAC, WebSocket, API, webhooks)
- [ ] **Phase 6** — Production (OAuth, MFA, encryption, Docker, CI/CD, monitoring)

---

## 📄 License

MIT
