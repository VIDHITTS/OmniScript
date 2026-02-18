# Project Idea: Personal Knowledge OS

## Overview
**Personal Knowledge OS** (often referred to as **InsightStream**) is a web application designed to help users organize and query their personal documents using AI. Users can upload PDFs, text files, and YouTube links into distinct workspaces. The system processes these inputs to allow for natural language Q&A, providing answers grounded in the user's specific data with precise citations.

## Scope
The project scope includes a full-stack web application with the following components:
- **Frontend**: A responsive web interface for managing workspaces, uploading documents, and chatting with the AI.
- **Backend**: An API server to handle file uploads, document processing, and chat interactions.
- **Database**: A vector-enabled database (e.g., Postgres with pgvector) to store document embeddings and metadata.
- **AI Integration**: Integration with LLMs (e.g., GPT-4) for generating answers based on retrieved context.

## Key Features

### 1. Workspaces
- Users can create isolated environments (e.g., "Biology 101", "Startup Ideas") to organize their data.
- Context is strictly limited to the active workspace, ensuring the AI responses are relevant to the selected topic.

### 2. Document Ingestion
- Supports multiple file types:
    - **PDFs**: Parsed and chunked for indexing.
    - **Text Files**: Directly ingested.
    - **YouTube URLs**: Transcripts are fetched and processed.
- Background processing splits content into manageable chunks and generates vector embeddings.

### 3. RAG (Retrieval-Augmented Generation)
- **Semantic Search**: The system converts user queries into vectors to find the most relevant document chunks.
- **Context-Aware Answers**: Retrieved chunks are fed to the LLM to generate accurate, fact-based responses.

### 4. Citations
- **Source Transparency**: Every AI response includes citations linking back to the specific source document.
- **Deep Links**: Users can click a citation to view the exact page or timestamp where the information was found.

## Technical Flow

### Upload & Processing
1.  **User** uploads a file or link.
2.  **Server** receives the file and initiates a background job.
3.  **Processor** reads the content, splits it into chunks, and generates vector embeddings.
4.  **Database** stores the chunks and embeddings for fast retrieval.

### Chat Interaction
1.  **User** asks a question in the chat interface.
2.  **System** searches the database for the top 3-5 most relevant chunks using vector similarity.
3.  **LLM** receives the question along with the relevant chunks.
4.  **System** displays the LLM's answer with clickable citations pointing to the source material.
