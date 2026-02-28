# Sequence Diagrams — OmniScript

## Overview

End-to-end flows covering authentication, document ingestion, agentic RAG chat, knowledge graph construction, and artifact generation.

---

## 1. User Authentication (OAuth + JWT)

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend (Next.js)
    participant Backend as Backend (Express)
    participant OAuth as OAuth Provider (Google/GitHub)
    participant DB as PostgreSQL
    participant Redis as Redis

    User->>Frontend: Click "Sign in with Google"
    Frontend->>OAuth: Redirect to Google OAuth
    OAuth-->>Frontend: Authorization Code
    Frontend->>Backend: POST /auth/oauth/callback (code)
    Backend->>OAuth: Exchange code for tokens
    OAuth-->>Backend: Access Token + User Info
    Backend->>DB: Upsert User (email, name, avatar, provider)
    Backend->>Backend: Generate JWT (access + refresh)
    Backend->>Redis: Store refresh token (TTL: 7 days)
    Backend-->>Frontend: { accessToken, refreshToken, user }
    Frontend->>Frontend: Store in memory + httpOnly cookie
```

---

## 2. Document Upload & Processing Pipeline

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend
    participant Backend as API Server
    participant S3 as S3 / MinIO
    participant Queue as BullMQ (Redis)
    participant Worker as Background Worker
    participant AI as OpenAI API
    participant DB as PostgreSQL

    User->>Frontend: Upload PDF / Paste YouTube URL
    Frontend->>Backend: POST /api/documents/upload (file + workspaceId)
    Backend->>S3: Upload original file
    S3-->>Backend: storage_url
    Backend->>DB: INSERT Document (status: QUEUED)
    Backend->>Queue: Enqueue ingestion job
    Backend-->>Frontend: { documentId, status: QUEUED }

    Note over Worker: Background Worker picks up job

    Queue->>Worker: Dequeue job
    Worker->>DB: UPDATE Document (status: PROCESSING)
    Worker->>S3: Download file
    S3-->>Worker: File content

    alt PDF
        Worker->>Worker: pdf-parse / Tesseract OCR
    else YouTube
        Worker->>Worker: Fetch transcript via API
    else Web URL
        Worker->>Worker: Scrape with Readability
    else Audio
        Worker->>AI: Whisper transcription
        AI-->>Worker: Transcript text
    else Image
        Worker->>AI: GPT-4o Vision describe
        AI-->>Worker: Description text
    end

    Worker->>DB: UPDATE Document (status: CHUNKING)
    Worker->>Worker: Smart chunking (semantic boundaries, overlap)
    Worker->>DB: UPDATE Document (status: EMBEDDING)
    Worker->>AI: Generate embeddings (batch, text-embedding-3-small)
    AI-->>Worker: Vector embeddings (1536 dim)
    Worker->>DB: INSERT Chunks (content + embedding + metadata)
    Worker->>DB: UPDATE Document (status: INDEXED, total_chunks, token_count)

    Note over Worker: Knowledge Graph Extraction (async)
    Worker->>Queue: Enqueue KG extraction job
    Worker-->>Frontend: WebSocket notification (document ready)
    Frontend->>User: Show "Document indexed" toast
```

---

## 3. Agentic RAG Chat Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend
    participant Backend as API Server
    participant Agent as RAG Agent
    participant DB as PostgreSQL (pgvector)
    participant LLM as OpenAI GPT-4o
    participant Redis as Redis (Cache)

    User->>Frontend: "Compare what Lecture 3 and Lecture 7 say about mitosis"
    Frontend->>Backend: POST /api/chat (sessionId, message)
    Backend->>DB: INSERT Message (role: USER)
    Backend->>Agent: Process query

    Note over Agent: STEP 1 — PLAN
    Agent->>LLM: "Given this query, what tools should I use?"
    LLM-->>Agent: Plan: 1) Search Lecture 3 for mitosis, 2) Search Lecture 7 for mitosis, 3) Compare

    Note over Agent: STEP 2 — EXECUTE TOOL 1
    Agent->>DB: vector_search("mitosis", filter: document_title = "Lecture 3")
    DB-->>Agent: Top 5 chunks from Lecture 3

    Note over Agent: STEP 3 — EXECUTE TOOL 2
    Agent->>DB: vector_search("mitosis", filter: document_title = "Lecture 7")
    DB-->>Agent: Top 5 chunks from Lecture 7

    Note over Agent: STEP 4 — EVALUATE
    Agent->>LLM: "Are these 10 chunks sufficient to answer the comparison?"
    LLM-->>Agent: "Yes, I have enough context from both lectures"

    Note over Agent: STEP 5 — SYNTHESIZE
    Agent->>LLM: "Using these chunks, compare mitosis coverage in Lecture 3 vs Lecture 7"
    LLM-->>Agent: Structured comparison + citations + confidence score

    Note over Agent: STEP 6 — FOLLOW-UPS
    Agent->>LLM: "Suggest 3 follow-up questions"
    LLM-->>Agent: ["How does meiosis differ?", "What diagrams...", "Which lecture covers..."]

    Agent-->>Backend: Answer + citations + tool_calls log + followups + confidence
    Backend->>DB: INSERT Message (role: ASSISTANT, citations, tool_calls, followups)
    Backend->>Redis: Cache this query-answer pair
    Backend-->>Frontend: Stream response (SSE)
    Frontend->>User: Display answer with citations + follow-up buttons
```

---

## 4. Knowledge Graph Construction

```mermaid
sequenceDiagram
    participant Queue as BullMQ
    participant Worker as KG Worker
    participant DB as PostgreSQL
    participant LLM as OpenAI GPT-4o

    Queue->>Worker: KG extraction job (documentId)
    Worker->>DB: SELECT chunks WHERE document_id = X
    DB-->>Worker: All chunks for document

    loop For each chunk batch (5 chunks)
        Worker->>LLM: "Extract entities and relationships from this text"
        LLM-->>Worker: { entities: [...], relationships: [...] }

        loop For each entity
            Worker->>DB: UPSERT KG_ENTITY (deduplicate by name + workspace)
            Worker->>DB: INSERT KG_ENTITY_CHUNK (link entity to source chunk)
        end

        loop For each relationship
            Worker->>DB: INSERT KG_EDGE (source, target, relationship, confidence)
        end
    end

    Worker->>DB: UPDATE entity mention_counts
    Worker-->>Queue: Job complete
```

---

## 5. Artifact Generation (Flashcards Example)

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend
    participant Backend as API Server
    participant DB as PostgreSQL
    participant LLM as OpenAI GPT-4o
    participant S3 as S3 / MinIO

    User->>Frontend: Click "Generate Flashcards" on workspace
    Frontend->>Backend: POST /api/artifacts/generate (workspaceId, type: FLASHCARD_SET)
    Backend->>DB: SELECT top chunks by citation count (most important content)
    DB-->>Backend: Top 50 most-cited chunks

    Backend->>LLM: "Generate Q&A flashcards from these chunks"
    LLM-->>Backend: { flashcards: [{q: "...", a: "...", source: "chunk_id"}, ...] }

    Backend->>DB: INSERT Artifact (type: FLASHCARD_SET, content: JSON)
    Backend->>S3: Export as Anki-compatible .apkg (optional)
    S3-->>Backend: export_url
    Backend->>DB: UPDATE Artifact (export_url)
    Backend-->>Frontend: { artifactId, flashcards, export_url }
    Frontend->>User: Display interactive flashcard viewer + download button
```
