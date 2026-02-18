# ER Diagram — InsightStream (AI Knowledge OS)

## Overview

This Entity-Relationship diagram defines the architecture for **InsightStream**, a full-stack RAG (Retrieval-Augmented Generation) platform.

The schema is designed to support the **AI Knowledge Lifecycle**:
1.  **Ingestion:** Users upload documents to specific workspaces.
2.  **Processing:** The system tracks async jobs (OCR/Chunking).
3.  **Retrieval:** The database stores vector embeddings for semantic search.
4.  **Generation:** Chat history maintains context for the LLM.

---

```mermaid
erDiagram
    %% ===== CORE IDENTITY & ACCESS =====
    USERS {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        timestamp created_at
        timestamp last_login
    }

    WORKSPACES {
        uuid id PK
        string name
        string description
        uuid owner_id FK
        boolean is_public
        timestamp created_at
    }

    WORKSPACE_MEMBERS {
        uuid workspace_id FK
        uuid user_id FK
        enum role "OWNER | EDITOR | VIEWER"
        timestamp joined_at
    }

    %% ===== KNOWLEDGE BASE (RAG PIPELINE) =====
    DOCUMENTS {
        uuid id PK
        uuid workspace_id FK
        string title
        string storage_path "S3/Blob URL"
        enum source_type "PDF | MARKDOWN | YOUTUBE | WEB"
        enum status "QUEUED | PROCESSING | INDEXED | FAILED"
        int token_count
        jsonb metadata "Author, Date, Tags"
        timestamp created_at
    }

    DOCUMENT_CHUNKS {
        uuid id PK
        uuid document_id FK
        text content "The actual text segment"
        vector embedding "dim: 1536 (OpenAI)"
        int chunk_index "Order in original doc"
        jsonb location "Page num, timestamp"
    }

    %% ===== CONVERSATIONAL AI =====
    CHAT_SESSIONS {
        uuid id PK
        uuid workspace_id FK
        uuid user_id FK
        string title
        timestamp last_active_at
        timestamp created_at
    }

    MESSAGES {
        uuid id PK
        uuid session_id FK
        enum role "USER | ASSISTANT | SYSTEM"
        text content
        jsonb citations "Array of chunk_ids"
        int token_usage
        timestamp created_at
    }

    %% ===== RELATIONSHIPS =====
    USERS ||--o{ WORKSPACES : "owns"
    USERS ||--o{ WORKSPACE_MEMBERS : "member of"
    WORKSPACES ||--o{ WORKSPACE_MEMBERS : "has members"

    WORKSPACES ||--o{ DOCUMENTS : "contains"
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : "split into"

    USERS ||--o{ CHAT_SESSIONS : "starts"
    WORKSPACES ||--o{ CHAT_SESSIONS : "context for"
    CHAT_SESSIONS ||--o{ MESSAGES : "history"


    Key Indexes
Table	Index	Purpose
DOCUMENT_CHUNKS	HNSW (embedding)	Critical: Enables millisecond-speed vector similarity search.
DOCUMENTS	(workspace_id, status)	Quickly find docs that are stuck or still processing.
MESSAGES	(session_id, created_at)	Efficiently load chat history in chronological order.
CHAT_SESSIONS	(user_id, last_active_at DESC)	Show "Recent Chats" sidebar quickly.
DOCUMENT_CHUNKS	(document_id)	Fast deletion: If a doc is deleted, all its chunks must go.
Architecture Decisions (Why it is done this way)
1. Vector Embeddings inside Postgres (DOCUMENT_CHUNKS)

Why: Traditional SQL databases cannot understand context. If you search for "dog", they won't find "puppy".

What was done: We added a vector column to the DOCUMENT_CHUNKS table using the pgvector extension.

Benefit: This creates a "Hybrid Search" engine. We can query metadata (e.g., "Files from 2024") and meaning (e.g., "Concepts about Photosynthesis") in a single, fast SQL query, without needing a separate database like Pinecone.

2. Asynchronous Processing Status (DOCUMENTS)

Why: AI operations are slow. Converting a 100-page PDF into embeddings can take 30+ seconds. If we did this while the user waited, the browser would timeout/crash.

What was done: We added a status enum (QUEUED, PROCESSING, INDEXED).

Benefit: The backend can accept the file immediately, say "Received!", and then a background worker processes it. The frontend simply polls this status to show a progress bar.

3. Citations & Attribution (MESSAGES)

Why: AI models (LLMs) sometimes "hallucinate" or make up facts. Users need to verify where the answer came from.

What was done: The MESSAGES table has a citations JSONB column. When the AI answers, it saves the IDs of the exact text chunks it used.

Benefit: The UI can render clickable footnotes (e.g., [1]), allowing the user to jump directly to the original PDF page that proves the AI's answer is correct.

4. Workspace Isolation (WORKSPACES)

Why: You don't want your "Personal Diary" notes appearing when you search your "Chemistry Homework".

What was done: Every search is strictly filtered by workspace_id.

Benefit: This enforces a hard "Wall" between different contexts, ensuring privacy and relevance in search results.