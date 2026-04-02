# OmniScript — Project Idea

## Overview

**OmniScript** is an AI-powered knowledge operating system that lets users ingest, organize, search, and converse with their personal data. It combines agentic AI with modern retrieval techniques (PageIndex, Contextual Retrieval, Cross-Encoder Reranking), a knowledge graph, real-time collaboration, and multi-modal ingestion into a single platform — designed to be the source of truth for everything a user knows.

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

| Input Type                       | How It's Processed                                                         |
| -------------------------------- | -------------------------------------------------------------------------- |
| **PDF**                          | OCR (for scanned docs) → Text extraction → Structure extraction → Chunking → Contextual enrichment → Embedding |
| **Markdown / Text**              | Direct ingestion → Structure extraction → Chunking → Contextual enrichment → Embedding |
| **YouTube URL**                  | Transcript fetch (with timestamps) → Chunking → Contextual enrichment → Embedding |
| **Web URL**                      | Scrape readable content (Readability) → Structure extraction → Chunking → Contextual enrichment → Embedding |
| **Audio Files** (mp3, wav)       | Whisper transcription → Chunking → Contextual enrichment → Embedding      |
| **Images** (png, jpg)            | Vision LLM description → Text → Embedding                                 |
| **Code Files** (.py, .ts, .java) | AST-aware chunking → Embedding                                            |
| **CSV / Excel**                  | Row-level or table-level summarization → Embedding                        |

- **Semantic Chunking** — Not naive fixed-size splitting. Uses semantic boundaries (paragraphs, sections, headings) with configurable overlap
- **Contextual Retrieval** — Before embedding, each chunk is enriched with context about the document and section it belongs to. Prevents ambiguous chunks from losing meaning.
- **Document Structure Index (PageIndex)** — Documents are parsed into a hierarchical tree (chapters → sections → subsections) enabling LLM-guided structural navigation, not just vector search
- **Chunk Metadata** — Every chunk stores: page number, timestamp, section heading, document title, source URL
- **Re-processing** — Users can re-ingest documents if the chunking strategy changes

### 3. Modern Retrieval Pipeline (Beyond Naive RAG)

The retrieval system uses a multi-stage pipeline inspired by production-grade RAG architectures (2025-2026 best practices), not simple chunk-embed-search:

#### Retrieval Architecture:

```
User Query
    → Query Processor
        • Query Classification (simple factual vs. complex multi-hop vs. structured)
        • Query Decomposition (break complex queries into sub-queries)
        • HyDE Generation (for ambiguous queries, generate hypothetical answer to embed)
    → Adaptive Router (decides strategy based on query complexity)
        ├─ Fast Path: Simple factual queries → Hybrid Search → Rerank → Answer
        └─ Full Path: Complex queries → Agentic Loop (below)
    → Agentic Orchestration (for complex queries)
        • Agent PLANS (what tools/searches needed?)
        • Agent EXECUTES tools in parallel where possible
        • Agent EVALUATES with CRAG Grader (RELEVANT / AMBIGUOUS / IRRELEVANT)
        • If IRRELEVANT → Agent RETRIES (rewrite query, different strategy)
        • If RELEVANT → Agent SYNTHESIZES answer from validated context
        • Agent CITES (attach source references with confidence)
    → Answer + Citations + Confidence Score
```

#### Multi-Stage Retrieval Pipeline:

| Stage | What Happens | Why |
| ----- | ------------ | --- |
| **1. Hybrid Search** | Vector search (pgvector) + BM25 keyword search (tsvector) + Reciprocal Rank Fusion merge | Catches both semantic matches AND exact terms |
| **2. PageIndex Navigation** | For structured docs: LLM navigates the document's hierarchy to find relevant sections | Beats chunk-search for tables, legal clauses, cross-references |
| **3. Cross-Encoder Reranking** | Top-50 candidates reranked by a cross-attention model (Cohere Rerank or local ColBERT) | Dramatically improves precision — the single highest-impact step |
| **4. CRAG Grader** | An evaluator LLM grades retrieved chunks as RELEVANT / AMBIGUOUS / IRRELEVANT | Self-correcting loop: if IRRELEVANT, retry with different strategy |

#### Agent Tools (Claude Code-Inspired Tool Registry):

Every tool is a self-contained module with an input schema (Zod), execution logic, and permission model. Tools are registered in a central registry and selected by the LLM via function calling.

| Tool                     | What It Does                                                          |
| ------------------------ | --------------------------------------------------------------------- |
| `vector_search`          | Semantic similarity search on chunk embeddings (pgvector cosine)      |
| `keyword_search`         | Full-text search (BM25 via tsvector + ts_rank)                        |
| `page_index_navigate`    | Navigate document structure tree to find relevant sections            |
| `hyde_search`            | Generate hypothetical answer → embed → search (for ambiguous queries) |
| `filter_by_metadata`     | Filter chunks by document type, date range, author, tags              |
| `cross_workspace_search` | Search across multiple workspaces (if user permits)                   |
| `graph_traverse`         | Traverse knowledge graph for multi-hop reasoning                      |
| `summarize_document`     | Get a summary of an entire document                                   |
| `compare_documents`      | Side-by-side comparison of two sources                                |
| `web_search`             | (Optional) Fall back to web search if local knowledge is insufficient |
| `calculate`              | Perform math operations on extracted data                             |

### 4. Knowledge Graph (Auto-Generated)

The system automatically builds a graph of entities and relationships from ingested documents.

- **Entity Extraction** — People, organizations, concepts, dates, locations identified via LLM (structured output / JSON mode)
- **Relationship Mapping** — "Einstein" → "developed" → "Theory of Relativity" → "published in" → "1915"
- **Entity Deduplication** — "Albert Einstein", "Einstein", "A. Einstein" → single entity (LLM-normalized)
- **Visual Graph Explorer** — Interactive node-link diagram (D3.js / Cytoscape)
- **Graph-Augmented Retrieval** — Agent can traverse the graph for multi-hop reasoning using recursive CTEs
- **Knowledge Gap Detection** — Identifies topics with sparse coverage across your documents

### 5. Smart Citations & Source Viewer

- Every AI response has **numbered citations** `[1]`, `[2]`, etc.
- Clicking a citation opens a **source viewer panel**:
  - **PDFs**: Highlights the exact paragraph/page
  - **YouTube**: Jumps to the timestamp
  - **Audio**: Plays from the timestamp
  - **Web**: Shows the archived snippet
- **Confidence Score** — Each citation shows semantic relevance (cosine similarity %)
- **Verify Button** — Users can flag answers as correct/incorrect, feeding the feedback loop

### 6. Conversation Intelligence

- **Multi-Turn Context** — The agent remembers previous messages in the session for follow-up questions
- **Conversation Branching** — Fork a conversation at any point to explore a different line of questioning
- **Suggested Follow-Ups** — AI suggests 3 related questions after each answer (using GPT-4o-mini for cost efficiency)
- **Pin & Bookmark** — Pin important answers for quick reference
- **Export Chat** — Export a conversation as Markdown or PDF
- **Chat Templates** — Pre-built prompts: "Summarize this workspace", "Find contradictions", "Create study guide"

### 7. Auto-Generated Artifacts

The AI can produce structured outputs, not just text answers:

| Artifact              | Description                                                                   |
| --------------------- | ----------------------------------------------------------------------------- |
| **Summaries**         | Executive summary of any document or workspace                                |
| **Flashcards**        | Auto-generate Q&A flashcards from your notes (JSON export)                    |
| **Mind Maps**         | Visual mind map of key topics in a workspace                                  |
| **Timelines**         | Chronological timeline of events extracted from documents                     |
| **Study Guides**      | Structured study guide with key concepts, definitions, and practice questions |
| **Comparison Tables** | Side-by-side comparison of multiple sources on the same topic                 |
| **Glossary**          | Auto-extracted key terms and definitions                                      |

### 8. Real-Time Collaboration

- **Shared Workspaces** — Multiple users can access the same workspace
- **Live Chat** — All members see AI responses in real-time (WebSocket)
- **Annotations** — Team members can annotate documents and AI responses
- **Activity Feed** — "John uploaded 3 documents", "Sarah asked 5 questions today"
- **Conflict-Free** — Concurrent uploads and chats don't interfere with each other

### 9. API & Integrations

- **REST API** — Full API for programmatic access (upload, search, chat)
- **Webhook Triggers** — "When a document finishes processing, notify my Slack"
- **API Key Scoping** — API keys with granular permissions (read-only, write, admin)

### 10. Security & Privacy

- **Row-Level Security (RLS)** — Postgres RLS ensures users can ONLY access their own data
- **OAuth 2.0 + MFA** — Google/GitHub login + optional TOTP-based 2FA
- **Password Reset** — Secure token-based password reset flow via email
- **Email Verification** — Verify email on registration before full access
- **Audit Log** — Every action (upload, delete, share, query) is logged
- **GDPR Compliant** — Full data export and "Right to be Forgotten" (delete all user data)
- **API Key Scoping** — API keys with granular permissions (read-only, write, admin)

### 11. Observability & Analytics

- **Usage Dashboard** — Questions asked, documents processed, tokens consumed, response times
- **RAG Quality Metrics** — Retrieval precision, answer relevance, citation accuracy
- **Cost Tracking** — OpenAI API spend per user/workspace with token budget enforcement
- **Error Monitoring** — Failed ingestions, timeout jobs, LLM errors
- **Token Budget Management** — Per-query and per-workspace token limits with diminishing-returns detection (inspired by Claude Code's `tokenBudget.ts` pattern)

---

## Technical Architecture

### System Components

```
                     CLIENT (React + Next.js)                    
       
  Workspace   Document     Chat      Knowledge Graph    
   Manager    Viewer     Interface     Explorer         
       

                         REST + WebSocket + SSE

                    API GATEWAY (Express + TypeScript)            
        
    Auth    Upload    Chat    Search    Workspace    
   Module   Module   Module   Module     Module      
        

                        
         
                                     
  
  BullMQ Queue     Redis     WebSocket    
  (Job Queue)     (Cache)    (Socket.io)  
  
         

              BACKGROUND WORKERS (Separate Processes)            
      
    Ingestion     Embedding     KG Builder    Structure
     Worker        Worker        Worker       Extractor
    PDF/YT/Web   OpenAI API    Entity NER     PageIndex
      

         

                  DATA LAYER                                     
                                                                 
      
     PostgreSQL + pgvector            MongoDB GridFS /S3

    • users, workspaces             • Original PDFs          
    • documents, chunks             • Audio files            
    • chat_sessions, messages       • Images                 
    • knowledge_graph_nodes         • Generated artifacts    
    • knowledge_graph_edges                                  
    • document_structure (PageIndex)
    • api_keys, audit_logs                                   
    • vector embeddings (HNSW)                               
    • full-text search (tsvector)                            
      

```

### Tech Stack

| Layer                  | Technology                                  |
| ---------------------- | ------------------------------------------- |
| Frontend               | React + Next.js + Tailwind + shadcn/ui      |
| API Server             | Express + TypeScript                        |
| ORM                    | Prisma (with pgvector extension)            |
| Primary Database       | PostgreSQL 16 + pgvector + pg_trgm          |
| Queue                  | BullMQ + Redis                              |
| Cache                  | Redis                                       |
| Real-Time              | Socket.io (WebSocket)                       |
| File Storage           | MongoDB GridFS (default) / S3 / MinIO       |
| Auth                   | JWT + bcrypt + OAuth 2.0 (Google, GitHub)   |
| AI - Embeddings        | OpenAI text-embedding-3-small (1536 dim)    |
| AI - Chat              | OpenAI GPT-4o / GPT-4o-mini (configurable)  |
| AI - Transcription     | OpenAI Whisper (audio)                      |
| AI - Vision            | OpenAI GPT-4o Vision (images)               |
| AI - Entity Extraction | LLM-based NER for knowledge graph           |
| AI - Reranking         | Cohere Rerank API / local ColBERT           |
| Full-Text Search       | PostgreSQL tsvector + ts_rank (BM25-style)  |
| Monitoring             | Sentry (errors) + Prometheus + Grafana      |
| Containerization       | Docker + Docker Compose                     |
| CI/CD                  | GitHub Actions                              |

### File Storage: MongoDB GridFS vs S3

OmniScript supports **MongoDB GridFS** as the default file storage for simpler deployment, with **S3/MinIO** as an alternative for production scale:

| Criteria          | MongoDB GridFS                     | S3 / MinIO                        |
| ----------------- | ---------------------------------- | --------------------------------- |
| **Setup**         | Single service (MongoDB)           | Separate service (MinIO container)|
| **Best for**      | Small-medium scale, simpler ops    | Large scale, CDN integration      |
| **File access**   | Stream via GridFS API              | Presigned URLs, direct download   |
| **Cost**          | Included with MongoDB              | Pay per GB stored + transferred   |
| **Max file size** | 16MB per GridFS chunk (unlimited total) | Unlimited                    |
| **When to use**   | Local dev, small teams, < 100GB    | Production, > 100GB, CDN needed   |

The storage layer is abstracted behind a `StorageService` interface — switching backends is a config change, not a code change.

---

## Build Phases

### Phase 1 — Foundation (MVP)

- [x] Project planning & documentation
- [ ] PostgreSQL + Redis + Docker Compose setup
- [ ] Config module (env validation with Zod)
- [ ] Structured logging (pino) + global error handler
- [ ] Auth (register, login, JWT, refresh tokens, email verification, password reset)
- [ ] Workspace CRUD with cursor pagination
- [ ] Document upload + file storage (GridFS or S3)
- [ ] Background processing (structure extraction + semantic chunking + contextual enrichment + embedding)
- [ ] Hybrid search from day 1 (vector + BM25 + RRF)
- [ ] Cross-encoder reranking from day 1
- [ ] Chat sessions with SSE streaming
- [ ] Citations (chunk IDs linked to sources)

### Phase 2 — Intelligence Upgrade

- [ ] Agentic orchestration (plan → execute → evaluate → retry)
- [ ] Tool registry with Zod schemas (inspired by Claude Code's `buildTool` pattern)
- [ ] PageIndex navigation tool (document structure search)
- [ ] HyDE search tool (hypothetical document embeddings)
- [ ] CRAG grader (self-correcting retrieval)
- [ ] Adaptive query routing (fast path vs full agentic path)
- [ ] YouTube transcript ingestion
- [ ] Web URL scraping + ingestion
- [ ] Suggested follow-up questions
- [ ] Conversation branching

### Phase 3 — Knowledge Graph

- [ ] Entity extraction from chunks (LLM-based NER with structured output)
- [ ] Knowledge graph storage (nodes + edges in Postgres with recursive CTEs)
- [ ] Entity deduplication (LLM-normalized names)
- [ ] Graph-augmented retrieval (GraphTraversalTool)
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
- [ ] Role-based access control (RBAC) with permissions matrix
- [ ] Real-time collaborative chat (WebSocket via Socket.io)
- [ ] Annotations on documents and AI responses
- [ ] Activity feed
- [ ] REST API with API key auth
- [ ] Webhook system
- [ ] Usage analytics dashboard

### Phase 6 — Production Hardening

- [ ] OAuth 2.0 (Google, GitHub)
- [ ] MFA (TOTP)
- [ ] Audit logging
- [ ] Rate limiting (Redis-backed sliding window)
- [ ] Row-Level Security policies in Postgres
- [ ] GDPR compliance (data export, deletion)
- [ ] Docker Compose for full-stack local dev
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring (Sentry + Prometheus)
- [ ] Cost tracking + token budget enforcement per user/workspace

---

## Future Considerations (Post-MVP)

These features are deferred until the core platform is stable:

- **Chrome Extension** — Right-click any webpage → "Save to OmniScript workspace"
- **Obsidian Plugin** — Sync Obsidian vault to an OmniScript workspace
- **Slack Bot** — Ask OmniScript questions directly from Slack
- **Zapier / n8n Integration** — Connect OmniScript to 1000+ apps
- **End-to-End Encryption** — AES-256 encryption at rest (requires key management system)
- **Data Residency** — Multi-region storage (US, EU, Asia) — requires cloud architecture
- **A/B Testing** — Compare chunking strategies, embedding models, or prompts
- **Anki Export** — Anki-compatible .apkg flashcard export
- **@Mentions** — Tag team members in chat for notifications

---

## Key Differentiators

1. **Modern Retrieval Pipeline** — PageIndex + Contextual Retrieval + Cross-Encoder Reranking + CRAG. Not 2023-era chunk-embed-search.
2. **Agentic Orchestration** — Coordinator pattern (inspired by Claude Code) with tool registry, plan-execute-evaluate loops, and adaptive routing.
3. **Knowledge Graph** — Auto-discovers entity relationships across documents with LLM-based deduplication.
4. **Hybrid Search** — Vector + BM25 + RRF + Reranking for high-precision retrieval from day 1.
5. **Multi-Modal** — PDFs, YouTube, audio, images, code, CSV in one platform.
6. **Real-Time Collaboration** — Shared workspaces, live updates, annotations.
7. **Auto-Generated Artifacts** — Flashcards, timelines, mind maps, study guides.
8. **Full Observability** — RAG quality metrics, cost tracking, token budget management, audit logs.
9. **API-First** — Every feature accessible programmatically.
10. **Flexible Storage** — MongoDB GridFS or S3/MinIO — choose based on scale.
