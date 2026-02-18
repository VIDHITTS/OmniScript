# Use Case Diagram — Personal Knowledge OS

## Overview
This diagram illustrates the interactions between the **User**, **System (Background Processor)**, and the **LLM** (Language Model) within the Personal Knowledge OS.

```mermaid
useCaseDiagram
    actor "User" as U
    actor "System (Background Job)" as S
    actor "LLM (AI Model)" as AI

    package "Personal Knowledge OS" {
        usecase "Create Workspace" as UC1
        usecase "Upload Document" as UC2
        usecase "Ingest Document" as UC3
        usecase "Create Embeddings" as UC4
        usecase "Ask Question" as UC5
        usecase "Search Chunks" as UC6
        usecase "Generate Answer" as UC7
        usecase "View Citation" as UC8
    }

    U --> UC1
    U --> UC2
    UC2 ..> UC3 : triggers
    S --> UC3
    UC3 ..> UC4 : include
    S --> UC4

    U --> UC5
    UC5 ..> UC6 : include
    S --> UC6
    UC6 ..> UC7 : include
    AI --> UC7
    UC7 --> U : returns answer
    U --> UC8
```
