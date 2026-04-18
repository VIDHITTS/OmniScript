"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { apiClient, uploadClient } from "@/lib/api";
import { useStore } from "@/store/useStore";
import WorkspaceSidebar from "./WorkspaceSidebar";

type Workspace = {
  id: string;
  name: string;
  description?: string | null;
  _count?: { documents?: number };
};

type Document = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  errorMessage?: string | null;
};

type Message = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
};

interface WorkspaceViewProps {
  workspace: Workspace;
  onBack: () => void;
}

export default function WorkspaceView({ workspace, onBack }: WorkspaceViewProps) {
  const { accessToken } = useStore();
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [query, setQuery] = useState("");

  // Load documents for workspace
  const loadDocuments = useCallback(async () => {
    try {
      const result = await apiClient(`/workspaces/${workspace.id}/documents`, {
        token: accessToken,
      });
      setDocuments(result.documents || []);
    } catch (error) {
      console.error("Failed to load documents", error);
    }
  }, [workspace.id, accessToken]);

  // Load chat session
  const loadChatSession = useCallback(async () => {
    try {
      const result = await apiClient(`/workspaces/${workspace.id}/chat/sessions`, {
        token: accessToken,
      });
      if (result.sessions?.[0]) {
        setChatSessionId(result.sessions[0].id);
        // Load messages
        const msgResult = await apiClient(
          `/workspaces/${workspace.id}/chat/sessions/${result.sessions[0].id}/messages`,
          { token: accessToken }
        );
        setMessages(msgResult.messages || []);
      } else {
        // Create new session
        const newSession = await apiClient(
          `/workspaces/${workspace.id}/chat/sessions`,
          {
            method: "POST",
            token: accessToken,
            body: JSON.stringify({ title: "Chat Session" }),
          }
        );
        setChatSessionId(newSession.session.id);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to load chat", error);
    }
  }, [workspace.id, accessToken]);

  useEffect(() => {
    loadDocuments();
    loadChatSession();
  }, [loadDocuments, loadChatSession]);

  // Poll documents for status updates
  useEffect(() => {
    const hasProcessing = documents.some(d => 
      ["QUEUED", "PROCESSING", "CHUNKING", "EMBEDDING"].includes(d.status)
    );
    
    if (hasProcessing) {
      const interval = setInterval(() => {
        loadDocuments();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [documents, loadDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("sourceType", getSourceType(file));

      await uploadClient(`/workspaces/${workspace.id}/documents`, formData, accessToken);
      await loadDocuments();
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !chatSessionId) return;

    const content = query.trim();
    setQuery("");
    setChatting(true);

    try {
      const optimistic: Message = {
        id: `temp-${Date.now()}`,
        role: "USER",
        content,
      };
      setMessages([...messages, optimistic]);

      const result = await apiClient(
        `/workspaces/${workspace.id}/chat/sessions/${chatSessionId}/messages`,
        {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ content }),
        }
      );

      setMessages([
        ...messages.filter(m => m.id !== optimistic.id),
        result.userMessage,
        result.aiMessage,
      ]);
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setChatting(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <WorkspaceSidebar
        workspaceName={workspace.name}
        documents={documents}
        uploading={uploading}
        onFileUpload={handleFileUpload}
        onBack={onBack}
      />

      {/* Main Chat Area */}
      <main className="flex flex-1 flex-col">
        {/* Chat Header */}
        <header className="flex items-center gap-3 border-b border-border bg-surface p-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Chat</h2>
            <p className="text-xs text-muted">Ask questions about your documents</p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-4xl space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    msg.role === "USER"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {chatting && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-border bg-surface p-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted" />
                </div>
              </div>
            )}
            {messages.length === 0 && !chatting && (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <MessageSquare className="mx-auto h-12 w-12 text-muted" />
                  <p className="mt-4 text-sm text-muted">
                    Upload documents and start asking questions
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border bg-surface p-4">
          <form onSubmit={handleSendMessage} className="mx-auto max-w-4xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question..."
                disabled={chatting}
                className="h-12 flex-1 rounded-lg border border-border bg-background px-4 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!query.trim() || chatting}
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function getSourceType(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "MARKDOWN";
  if (name.endsWith(".txt")) return "TEXT";
  return "TEXT";
}
