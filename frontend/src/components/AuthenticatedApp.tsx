"use client";

import { useState, useEffect, useCallback, FormEvent } from "react";
import { 
  FolderOpen, 
  Upload, 
  FileText, 
  MessageSquare, 
  Send, 
  Loader2,
  LogOut,
  Plus,
  X,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { apiClient, uploadClient } from "@/lib/api";
import { useStore } from "@/store/useStore";

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

export default function AuthenticatedApp() {
  const { accessToken, user, logout } = useStore();
  
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [query, setQuery] = useState("");

  // Load workspaces
  const loadWorkspaces = useCallback(async () => {
    try {
      const result = await apiClient("/workspaces", { token: accessToken });
      setWorkspaces(result.workspaces || []);
      if (!selectedWorkspace && result.workspaces?.[0]) {
        setSelectedWorkspace(result.workspaces[0].id);
      }
    } catch (error) {
      console.error("Failed to load workspaces", error);
    }
  }, [accessToken, selectedWorkspace]);

  // Load documents for selected workspace
  const loadDocuments = useCallback(async (workspaceId: string) => {
    try {
      const result = await apiClient(`/workspaces/${workspaceId}/documents`, {
        token: accessToken,
      });
      setDocuments(result.documents || []);
    } catch (error) {
      console.error("Failed to load documents", error);
    }
  }, [accessToken]);

  // Load chat session
  const loadChatSession = useCallback(async (workspaceId: string) => {
    try {
      const result = await apiClient(`/workspaces/${workspaceId}/chat/sessions`, {
        token: accessToken,
      });
      if (result.sessions?.[0]) {
        setChatSessionId(result.sessions[0].id);
        // Load messages
        const msgResult = await apiClient(
          `/workspaces/${workspaceId}/chat/sessions/${result.sessions[0].id}/messages`,
          { token: accessToken }
        );
        setMessages(msgResult.messages || []);
      } else {
        // Create new session
        const newSession = await apiClient(
          `/workspaces/${workspaceId}/chat/sessions`,
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
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      loadWorkspaces();
    }
  }, [accessToken, loadWorkspaces]);

  useEffect(() => {
    if (selectedWorkspace) {
      loadDocuments(selectedWorkspace);
      loadChatSession(selectedWorkspace);
    }
  }, [selectedWorkspace, loadDocuments, loadChatSession]);

  // Poll documents for status updates
  useEffect(() => {
    if (!selectedWorkspace) return;
    
    const hasProcessing = documents.some(d => 
      ["QUEUED", "PROCESSING", "CHUNKING", "EMBEDDING"].includes(d.status)
    );
    
    if (hasProcessing) {
      const interval = setInterval(() => {
        loadDocuments(selectedWorkspace);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [documents, selectedWorkspace, loadDocuments]);

  const handleCreateWorkspace = async (e: FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;

    try {
      const result = await apiClient("/workspaces", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: workspaceName.trim(),
          template: "RESEARCH",
        }),
      });
      setWorkspaces([result.workspace, ...workspaces]);
      setSelectedWorkspace(result.workspace.id);
      setWorkspaceName("");
      setShowNewWorkspace(false);
    } catch (error) {
      console.error("Failed to create workspace", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedWorkspace) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      formData.append("sourceType", getSourceType(file));

      await uploadClient(`/workspaces/${selectedWorkspace}/documents`, formData, accessToken);
      await loadDocuments(selectedWorkspace);
      await loadWorkspaces(); // Refresh counts
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setUploading(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !selectedWorkspace || !chatSessionId) return;

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
        `/workspaces/${selectedWorkspace}/chat/sessions/${chatSessionId}/messages`,
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

  const handleLogout = async () => {
    try {
      await apiClient("/auth/logout", { method: "POST", token: accessToken });
    } catch {
      // Ignore error
    }
    logout();
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar */}
      <aside className="flex w-80 flex-col border-r border-border bg-surface">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h1 className="font-semibold">OmniScript</h1>
            <p className="text-xs text-muted">{user?.fullName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg p-2 hover:bg-subtle"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        {/* Workspace Selector */}
        <div className="border-b border-border p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Workspaces</span>
            <button
              onClick={() => setShowNewWorkspace(!showNewWorkspace)}
              className="rounded-lg p-1 hover:bg-subtle"
            >
              {showNewWorkspace ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>

          {showNewWorkspace && (
            <form onSubmit={handleCreateWorkspace} className="mb-3">
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Workspace name"
                className="mb-2 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                autoFocus
              />
              <button
                type="submit"
                className="h-8 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground"
              >
                Create
              </button>
            </form>
          )}

          <div className="space-y-1">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => setSelectedWorkspace(ws.id)}
                className={`flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm transition ${
                  selectedWorkspace === ws.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-subtle"
                }`}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{ws.name}</div>
                  <div className="text-xs opacity-75">
                    {ws._count?.documents || 0} docs
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Upload Button */}
        <div className="border-b border-border p-4">
          <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={!selectedWorkspace || uploading}
              className="hidden"
              accept=".pdf,.txt,.md,.markdown"
            />
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload Document
          </label>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="mb-3 text-sm font-semibold">Documents</h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{doc.title}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs">
                      {doc.status === "INDEXED" && (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          <span className="text-success">Ready</span>
                        </>
                      )}
                      {["QUEUED", "PROCESSING", "CHUNKING", "EMBEDDING"].includes(doc.status) && (
                        <>
                          <Clock className="h-3 w-3 text-warning" />
                          <span className="text-warning">{doc.status.toLowerCase()}</span>
                        </>
                      )}
                      {doc.status === "FAILED" && (
                        <>
                          <AlertCircle className="h-3 w-3 text-danger" />
                          <span className="text-danger">Failed</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {documents.length === 0 && (
              <p className="text-center text-sm text-muted">No documents yet</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex flex-1 flex-col">
        {/* Chat Header */}
        <header className="flex items-center gap-3 border-b border-border bg-surface p-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Chat</h2>
            <p className="text-xs text-muted">
              {workspaces.find(w => w.id === selectedWorkspace)?.name || "Select a workspace"}
            </p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-3xl space-y-4">
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
                  <p className="text-sm leading-relaxed">{msg.content}</p>
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
          <form onSubmit={handleSendMessage} className="mx-auto max-w-3xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask a question..."
                disabled={!selectedWorkspace || chatting}
                className="h-12 flex-1 rounded-lg border border-border bg-background px-4 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!query.trim() || !selectedWorkspace || chatting}
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
