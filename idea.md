# Project Idea: OmniScript — Personal Knowledge OS

## Overview
**OmniScript** is an AI-powered knowledge operating system that lets users ingest, organize, search, and converse with their personal data. Unlike basic "Chat with PDF" tools, OmniScript is a **full platform** with agentic AI, real-time collaboration, a knowledge graph, and multi-modal understanding — designed to be the **single source of truth** for everything a user knows.

## What Makes This Different From Everything Else

| Existing Tools | What They Do | What OmniScript Does Better |
|---|---|---|
| ChatPDF, PDF.ai | Chat with ONE PDF | Chat across ALL your documents in a workspace, with cross-document reasoning |
| NotebookLM (Google) | Summarize + Q&A on docs | + Knowledge Graph + Agentic RAG + Real-time Collab + API Access |
| Notion AI | AI on your notes | OmniScript ingests external sources (PDFs, YouTube, Web, Audio, Images) |
| Obsidian + Plugins | Local-first notes | OmniScript auto-discovers connections between documents you didn't know existed |
| Perplexity AI | Search the internet | OmniScript searches YOUR data, not the internet — with source citations |

---

## Core Features

### 1. Workspaces (Knowledge Vaults)
- Isolated environments (e.g., "ML Research", "Legal Case #42", "Semester 5")
- Each workspace has its own document set, chat history, knowledge graph, and settings
- **Workspace Templates** — Pre-built setups for common use cases (Research Paper Review, Course Notes, Legal Discovery)
- **Role-Based Access** — Owner / Editor / Viewer / Commenter roles
- **Workspace Analytics** — Total documents, chunks, queries, most-cited sources, knowledge gaps

### 2. Multi-Modal Document Ingestion
Supports a wide range of input types, all processed asynchronously:

| Input Type | How It's Processed |
|---|---|
| **PDF** | OCR (for scanned docs) → Text extraction → Chunking → Embedding |
| **Markdown / Text** | Direct ingestion → Chunking → Embedding |
| **YouTube URL** | Transcript fetch (with timestamps) → Chunking → Embedding |
| **Web URL** | Scrape readable content (Readability) → Chunking → Embedding |
| **Audio Files** (mp3, wav) | Whisper transcription → Chunking → Embedding |
| **Images** (png, jpg) | Vision LLM description → Text → Embedding |
| **Code Files** (.py, .ts, .java) | AST-aware chunking → Embedding |
| **CSV / Excel** | Row-level or table-level summarization → Embedding |

- **Smart Chunking** — Not naive splitting. Uses semantic boundaries (paragraphs, sections, headings) with configurable overlap
- **Chunk Metadata** — Every chunk stores: page number, timestamp, section heading, document title, source URL
- **Re-processing** — Users can re-ingest documents if the chunking strategy changes

### 3. Agentic RAG (Not Basic RAG)

This is the core differentiator. The AI doesn't just blindly retrieve-and-generate. It **thinks**.

#### The Agent Loop:
```
User Question
    → Agent PLANS (what do I need to find?)
    → Agent SELECTS TOOLS (vector search? keyword search? filter by date? search another workspace?)
    → Agent RETRIEVES (executes the search)
    → Agent EVALUATES (are these chunks relevant enough? do I need more?)
    → Agent may RETRY (rephrase query, search again, try different filters)
    → Agent SYNTHESIZES (generate answer from validated context)
    → Agent CITES (attach source references)
    → Answer + Citations + Confidence Score
```

#### Agent Tools Available:
| Tool | What It Does |
|---|---|
| `vector_search` | Semantic similarity search on chunk embeddings |
| `keyword_search` | Full-text search (BM25) for exact terms, names, dates |
| `filter_by_metadata` | Filter chunks by document type, date range, author, tags |
| `cross_workspace_search` | Search across multiple workspaces (if user permits) |
| `summarize_document` | Get a summary of an entire document |
| `compare_documents` | Side-by-side comparison of two sources |
| `web_search` | (Optional) Fall back to web search if local knowledge is insufficient |
| `calculate` | Perform math operations on extracted data |

#### Hybrid Search (Vector + BM25):
- **Vector Search** finds semantically similar content ("What causes cancer?" → finds "oncogenesis")
- **BM25/Keyword Search** finds exact matches ("BRCA1 gene" → finds exact mentions)
- **Reciprocal Rank Fusion (RRF)** merges both result sets into one ranked list
- This is what Google does internally — and most "Chat with PDF" apps skip this entirely

### 4. Knowledge Graph (Auto-Generated)
The system automatically builds a **graph of entities and relationships** from ingested documents.

- **Entity Extraction** — People, organizations, concepts, dates, locations are automatically identified
- **Relationship Mapping** — "Einstein" → "developed" → "Theory of Relativity" → "published in" → "1915"
- **Visual Graph Explorer** — Interactive node-link diagram (D3.js / Cytoscape) where users can explore connections
- **Graph-Augmented Retrieval** — When the user asks a question, the agent can traverse the knowledge graph for multi-hop reasoning
- **Knowledge Gap Detection** — "You have 12 documents about Machine Learning but none cover Reinforcement Learning"

### 5. Smart Citations & Source Viewer
- Every AI response has **numbered citations** `[1]`, `[2]`, etc.
- Clicking a citation opens a **source viewer panel**:
  - **PDFs**: Highlights the exact paragraph on the exact page
  - **YouTube**: Jumps to the exact timestamp
  - **Web**: Shows the archived snippet
  - **Audio**: Plays from the exact timestamp
- **Citation Confidence Score** — Each citation shows how semantically relevant the chunk was (cosine similarity %)
- **"Verify" Button** — User can flag an answer as correct/incorrect, creating a feedback loop

### 6. Conversation Intelligence
- **Multi-Turn Context** — The agent remembers previous messages in the session for follow-up questions
- **Conversation Branching** — Fork a conversation at any point to explore a different line of questioning
- **Suggested Follow-Ups** — AI suggests 3 related questions after each answer
- **Pin & Bookmark** — Pin important answers for quick reference
- **Export Chat** — Export a conversation as Markdown, PDF, or shareable link
- **Chat Templates** — Pre-built prompts: "Summarize this workspace", "Find contradictions", "Create study guide"

### 7. Auto-Generated Artifacts
The AI can produce structured outputs, not just text answers:

| Artifact | Description |
|---|---|
| **Summaries** | Executive summary of any document or workspace |
| **Flashcards** | Auto-generate Q&A flashcards from your notes (Anki-compatible export) |
| **Mind Maps** | Visual mind map of key topics in a workspace |
| **Timelines** | Chronological timeline of events extracted from documents |
| **Study Guides** | Structured study guide with key concepts, definitions, and practice questions |
| **Comparison Tables** | Side-by-side comparison of multiple sources on the same topic |
| **Glossary** | Auto-extracted key terms and definitions |

### 8. Real-Time Collaboration
- **Shared Workspaces** — Multiple users can access the same workspace
- **Live Chat** — All members see AI responses in real-time (WebSocket)
- **Annotations** — Team members can annotate documents and AI responses
- **Activity Feed** — "John uploaded 3 documents", "Sarah asked 5 questions today"
- **@Mentions** — Tag team members in chat for their attention
- **Conflict-Free** — Concurrent uploads and chats don't interfere with each other

### 9. API & Integrations
- **REST API** — Full API for programmatic access (upload, search, chat)
- **Webhook Triggers** — "When a document finishes processing, notify my Slack"
- **Zapier / n8n Integration** — Connect OmniScript to 1000+ apps
- **Chrome Extension** — Right-click any webpage → "Save to OmniScript workspace"
- **Obsidian Plugin** — Sync Obsidian vault to an OmniScript workspace
- **Slack Bot** — Ask OmniScript questions directly from Slack

### 10. Security & Privacy
- **End-to-End Encryption** — Documents encrypted at rest (AES-256) and in transit (TLS 1.3)
- **Row-Level Security (RLS)** — Postgres RLS ensures users can ONLY access their own data
- **OAuth 2.0 + MFA** — Google/GitHub login + optional TOTP-based 2FA
- **Audit Log** — Every action (upload, delete, share, query) is logged
- **Data Residency** — Users can choose where their data is stored (US, EU, Asia)
- **GDPR Compliant** — Full data export and "Right to be Forgotten" (delete all user data)
- **API Key Scoping** — API keys with granular permissions (read-only, write, admin)

### 11. Observability & Analytics
- **Usage Dashboard** — Questions asked, documents processed, tokens consumed, response times
- **RAG Quality Metrics** — Track retrieval precision, answer relevance, citation accuracy over time
- **Cost Tracking** — Monitor OpenAI API spend per user/workspace
- **Error Monitoring** — Failed ingestions, timeout jobs, LLM errors — all tracked and alertable
- **A/B Testing** — Compare different chunking strategies, embedding models, or prompts

---

## Technical Architecture

### System Components
```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (React + Next.js)                    │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │Workspace │ │ Document │ │   Chat    │ │ Knowledge Graph  │  │
│  │ Manager  │ │ Viewer   │ │ Interface │ │   Explorer       │  │
│  └──────────┘ └──────────┘ └───────────┘ └──────────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │ REST + WebSocket
┌───────────────────────▼─────────────────────────────────────────┐
│                    API GATEWAY (Express + TypeScript)            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────┐  │
│  │  Auth  │ │ Upload │ │  Chat  │ │ Search │ │  Workspace  │  │
│  │ Module │ │ Module │ │ Module │ │ Module │ │   Module    │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └─────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
┌────────▼───────┐ ┌────▼────┐ ┌───────▼───────┐
│  BullMQ Queue  │ │  Redis  │ │  WebSocket    │
│  (Job Queue)   │ │ (Cache) │ │  (Socket.io)  │
└────────┬───────┘ └─────────┘ └───────────────┘
         │
┌────────▼────────────────────────────────────────────────────────┐
│              BACKGROUND WORKERS (Separate Processes)            │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────────────┐  │
│  │  Ingestion  │ │  Embedding  │ │  Knowledge Graph Builder │  │
│  │   Worker    │ │   Worker    │ │       Worker             │  │
│  │ PDF/YT/Web  │ │  OpenAI API │ │   Entity Extraction      │  │
│  └─────────────┘ └─────────────┘ └──────────────────────────┘  │
└────────┬────────────────────────────────────────────────────────┘
         │
┌────────▼────────────────────────────────────────────────────────┐
│                  DATA LAYER                                     │
│                                                                 │
│  ┌──────────────────────────────┐  ┌─────────────────────────┐  │
│  │   PostgreSQL + pgvector      │  │    S3 / MinIO           │  │
│  │                              │  │                         │  │
│  │  • users, workspaces         │  │  • Original PDFs        │  │
│  │  • documents, chunks         │  │  • Audio files          │  │
│  │  • chat_sessions, messages   │  │  • Images               │  │
│  │  • knowledge_graph_nodes     │  │  • Generated artifacts  │  │
│  │  • knowledge_graph_edges     │  │                         │  │
│  │  • api_keys, audit_logs      │  │                         │  │
│  │  • vector embeddings (HNSW)  │  │                         │  │
│  │  • full-text search (tsvector)│ │                         │  │
│  └──────────────────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React + Next.js + Tailwind + shadcn/ui |
| API Server | Express + TypeScript |
| ORM | Prisma (with pgvector extension) |
| Primary Database | PostgreSQL 16 + pgvector + pg_trgm |
| Queue | BullMQ + Redis |
| Cache | Redis |
| Real-Time | Socket.io (WebSocket) |
| File Storage | S3 (prod) / MinIO (local dev) |
| Auth | JWT + bcrypt + OAuth 2.0 (Google, GitHub) |
| AI - Embeddings | OpenAI text-embedding-3-small (1536 dim) |
| AI - Chat | OpenAI GPT-4o / GPT-4o-mini (configurable) |
| AI - Transcription | OpenAI Whisper (audio) |
| AI - Vision | OpenAI GPT-4o Vision (images) |
| AI - Entity Extraction | LLM-based NER for knowledge graph |
| Full-Text Search | PostgreSQL tsvector + ts_rank (BM25-style) |
| Monitoring | Prometheus + Grafana (or Sentry for errors) |
| Containerization | Docker + Docker Compose |
| CI/CD | GitHub Actions |

---

## Build Phases

### Phase 1 — Foundation (MVP)
- [x] Project planning & documentation
- [ ] Auth (register, login, JWT)
- [ ] Workspace CRUD
- [ ] Document upload (PDF, text) + S3 storage
- [ ] Background processing (chunking + embedding)
- [ ] Basic RAG (vector search → LLM → answer)
- [ ] Citations (chunk IDs linked to sources)
- [ ] Chat sessions with history

### Phase 2 — Intelligence Upgrade
- [ ] Agentic RAG (query rewriting, multi-step retrieval, self-evaluation)
- [ ] Hybrid Search (vector + BM25 + RRF fusion)
- [ ] YouTube transcript ingestion
- [ ] Web URL scraping + ingestion
- [ ] Suggested follow-up questions
- [ ] Conversation branching

### Phase 3 — Knowledge Graph
- [ ] Entity extraction from chunks (LLM-based NER)
- [ ] Knowledge graph storage (nodes + edges in Postgres)
- [ ] Graph-augmented retrieval
- [ ] Visual graph explorer (D3.js / Cytoscape)
- [ ] Knowledge gap detection

### Phase 4 — Multi-Modal + Artifacts
- [ ] Audio file ingestion (Whisper transcription)
- [ ] Image ingestion (Vision LLM)
- [ ] Code file ingestion (AST-aware chunking)
- [ ] CSV/Excel ingestion
- [ ] Auto-generated summaries, flashcards, mind maps, timelines
- [ ] Export artifacts as PDF/Markdown

### Phase 5 — Collaboration & Platform
- [ ] Workspace sharing (invite by email)
- [ ] Role-based access control (RBAC)
- [ ] Real-time collaborative chat (WebSocket)
- [ ] Annotations on documents and AI responses
- [ ] Activity feed
- [ ] REST API with API key auth
- [ ] Webhook system
- [ ] Usage analytics dashboard

### Phase 6 — Production Hardening
- [ ] OAuth 2.0 (Google, GitHub)
- [ ] MFA (TOTP)
- [ ] Audit logging
- [ ] Rate limiting (Redis-backed)
- [ ] End-to-end encryption
- [ ] GDPR compliance (data export, deletion)
- [ ] Docker Compose for full-stack local dev
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring (Sentry + Prometheus)
- [ ] Cost tracking per user/workspace

---

## What Makes This "Best-in-Class"

1. **Agentic RAG** — Not a dumb retrieve-and-generate pipeline. The AI reasons, plans, retries, and validates.
2. **Knowledge Graph** — Auto-discovers connections between documents. No other "Chat with PDF" app does this.
3. **Hybrid Search** — Vector + BM25 + RRF. Industry-grade retrieval, not toy similarity search.
4. **Multi-Modal** — PDFs, YouTube, audio, images, code, CSV — all in one place.
5. **Real-Time Collaboration** — Multiple users, live updates, annotations.
6. **Auto-Generated Artifacts** — Flashcards, timelines, mind maps, study guides — not just chat.
7. **Full Observability** — RAG quality metrics, cost tracking, audit logs.
8. **Production-Grade Security** — RLS, encryption, RBAC, GDPR, MFA.
9. **API-First** — Every feature is accessible programmatically.
10. **Extensible** — Plugin architecture for Chrome extension, Slack bot, Obsidian sync.
