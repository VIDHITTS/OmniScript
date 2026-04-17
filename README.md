# OmniScript

> **The AI-Powered Knowledge Operating System**

OmniScript is a full-stack, intelligence-driven document platform that allows you to ingest any form of media (PDFs, text, YouTube videos, web pages, audio, images) and seamlessly interact with it. By leveraging agentic orchestration and modern Retrieval-Augmented Generation (RAG), OmniScript transforms stagnant files into a dynamic, queryable knowledge base.

---

## 🎯 What It Does

- **Deep Ingestion:** Upload files and run robust background workers to semantically chunk, contextually enrich, and embed text.
- **Advanced Retrieval:** Uses a high-performance Hybrid Search pipeline (PostgreSQL pgvector + BM25 Full-Text) combined with Reciprocal Rank Fusion (RRF) and Cohere Cross-Encoder reranking to find the exact needle in the haystack.
- **Agentic Interactions:** Talk seamlessly to your documents using a streaming chat interface that cites its sources, evaluates relevance, and navigates document hierarchies intelligently.
- **Knowledge Organization:** Group your files into secure Workspaces with fine-grained role-based access control (RBAC).

---

## ✨ Key Features

- **💬 Real-Time Streaming Chat:** Multi-turn conversational AI with exact source citations and conversation branching.
- **🧠 Modern RAG Pipeline:** Contextual retrieval, Hypothetical Document Embeddings (HyDE), and Corrective RAG (CRAG) grading.
- **📁 Secure Workspaces:** Isolated knowledge vaults with membership management and real-time collaboration.
- **🔎 Hybrid Search:** Vector similarity (pgvector) and Full-Text (tsvector) merged with RRF for extreme precision.
- **⚙️ Agentic Orchestration:** Dynamic tool-calling enabling the AI to pick the best retrieval strategy based on query complexity.
- **📊 Auto-Generated Artifacts:** Instantly create summaries, flashcards, mind maps, and study guides directly from your documents.
- **🔐 Enterprise-Ready Auth:** JWT access/refresh token rotation with PostgreSQL-based token storage, email verification, MFA, and API keys.

---

## 🛠 Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | Next.js 15, React, Tailwind CSS, shadcn/ui |
| **Backend API** | Node.js, Express, TypeScript, Zod |
| **Database** | PostgreSQL 16 (pgvector, pg_trgm), Prisma ORM |
| **Storage** | MongoDB GridFS / AWS S3 / MinIO |
| **AI / LLMs** | Groq, OpenAI, Cohere |
| **Deployment** | Hugging Face Spaces (Backend), Vercel/Netlify (Frontend) |

---

## 🚀 Deployment

### Backend (Hugging Face Spaces)
The backend is deployed on Hugging Face Spaces using Docker:
- **Live API**: https://vidhitts-omniscript.hf.space
- **Health Check**: https://vidhitts-omniscript.hf.space/health
- **Database**: Neon PostgreSQL (serverless)
- **Storage**: MongoDB GridFS
- **No Redis Required**: Refresh tokens stored in PostgreSQL, queue processing runs synchronously

### Frontend
- **Framework**: Next.js 15 with App Router
- **Deployment**: Vercel/Netlify recommended
- **API URL**: Configured via `NEXT_PUBLIC_API_URL` environment variable

---

## 📚 Project Documentation

Detailed documentation on project architecture, the build roadmap, and technical phases are meticulously maintained in dedicated files:

- 🗺️ **[Roadmap & Build Phases](./ROADMAP.md)**: Step-by-step build guide, technical principles, and checklists.
- 💡 **[Project Vision](./idea.md)**: Full project vision and feature breakdowns.
- 🗄️ **[Database Schema](./ErDiagram.md)**: Full database schema (ER Diagram) and architecture decisions.
- 🔄 **[System Sequences](./sequenceDiagram.md)**: Sequence diagrams detailing auth, ingestion, RAG, and knowledge graphing.
- 📐 **[Class Diagrams](./classDiagram.md)**: Domain model and architectural design patterns.
- 👥 **[Use Cases](./useCaseDiagram.md)**: Complete map of actors and their interaction flows.

---
*OmniScript is licensed under the MIT License.*
