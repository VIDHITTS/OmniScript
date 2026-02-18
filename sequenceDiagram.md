# Sequence Diagram — Personal Knowledge OS

## Overview
This diagram illustrates the end-to-end flow of the **Personal Knowledge OS**, from user login to asking a question and receiving an answer.

```mermaid
sequenceDiagram
    actor User as User
    participant Frontend as Frontend (Web App)
    participant Backend as Backend (API)
    participant DB as Database (Postgres)
    participant Worker as Background Worker
    participant LLM as LLM (OpenAI)

    User->>Frontend: Upload Document (PDF/URL)
    Frontend->>Backend: POST /upload
    Backend->>DB: Save Document Metadata (Status: QUEUED)
    Backend->>Worker: Enqueue Job
    Worker->>DB: Update Status (PROCESSING)
    Worker->>Worker: Parse & Chunk Text
    Worker->>Worker: Generate Embeddings
    Worker->>DB: Store Chunks & Embeddings
    Worker->>DB: Update Status (INDEXED)

    User->>Frontend: Ask Question
    Frontend->>Backend: POST /chat (Question)
    Backend->>Worker: Vector Search for Relevant Chunks
    Worker->>DB: Query Chunks (Embedding Similarity)
    DB-->>Worker: Return Top 3-5 Chunks
    Worker->>LLM: Send Prompt (Question + Context)
    LLM-->>Worker: Generate Check Answer
    Worker->>Frontend: Return Answer + Citations
    Frontend->>User: Display Answer
```
