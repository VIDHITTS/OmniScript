"use client";

import { apiClient, uploadClient } from "@/lib/api";
import { useStore } from "@/store/useStore";
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  FolderPlus,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Workspace = {
  id: string;
  name: string;
  description?: string | null;
  template?: string;
  createdAt?: string;
  _count?: {
    documents?: number;
    members?: number;
    chatSessions?: number;
  };
};

type DocumentItem = {
  id: string;
  title: string;
  originalFilename: string;
  sourceType: string;
  status: string;
  totalChunks: number;
  tokenCount: number;
  createdAt: string;
  processedAt?: string | null;
  errorMessage?: string | null;
};

type ChatSession = {
  id: string;
  title: string;
  lastActiveAt: string;
  _count?: {
    messages?: number;
  };
};

type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  citations?: unknown;
  createdAt?: string;
};

type Mode = "login" | "register";

const emptyWorkspace = {
  name: "",
  description: "",
};

const sourceTypeForFile = (file: File | null) => {
  const name = file?.name.toLowerCase() || "";
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "MARKDOWN";
  if (name.endsWith(".csv")) return "CSV";
  if (name.match(/\.(png|jpg|jpeg|webp|gif)$/)) return "IMAGE";
  if (name.match(/\.(mp3|wav|m4a|aac)$/)) return "AUDIO";
  if (name.match(/\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c|json|yaml|yml)$/)) {
    return "CODE";
  }
  return "TEXT";
};

const shortDate = (value?: string | null) => {
  if (!value) return "Not processed";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export default function Home() {
  const {
    accessToken,
    user,
    activeWorkspaceId,
    activeSessionId,
    setAuth,
    setActiveWorkspace,
    setActiveSession,
    logout,
  } = useStore();

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [authForm, setAuthForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [workspaceForm, setWorkspaceForm] = useState(emptyWorkspace);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [sessionTitle, setSessionTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState({
    auth: false,
    workspace: false,
    upload: false,
    chat: false,
    boot: false,
  });

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [activeWorkspaceId, workspaces],
  );

  const isAuthenticated = Boolean(accessToken && user);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const withErrorHandling = useCallback(async (task: () => Promise<void>) => {
    setError("");
    setStatus("");
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
    }
  }, []);

  const loadWorkspaces = useCallback(async (token = accessToken) => {
    setLoading((current) => ({ ...current, boot: true }));
    await withErrorHandling(async () => {
      const result = await apiClient("/workspaces", { token });
      setWorkspaces(result.workspaces || []);
      if (!activeWorkspaceId && result.workspaces?.[0]?.id) {
        setActiveWorkspace(result.workspaces[0].id);
      }
    });
    setLoading((current) => ({ ...current, boot: false }));
  }, [accessToken, activeWorkspaceId, setActiveWorkspace, withErrorHandling]);

  const loadDocuments = useCallback(async (workspaceId: string) => {
    try {
      const result = await apiClient(`/workspaces/${workspaceId}/documents`, {
        token: accessToken,
      });
      setDocuments(result.documents || []);
    } catch {
      // Silently fail — stale state is better than crashing the poll
    }
  }, [accessToken]);

  const loadSessions = useCallback(async (workspaceId: string) => {
    try {
      const result = await apiClient(`/workspaces/${workspaceId}/chat/sessions`, {
        token: accessToken,
      });
      setSessions(result.sessions || []);
      if (!activeSessionId && result.sessions?.[0]?.id) {
        setActiveSession(result.sessions[0].id);
      }
    } catch {
      // Silently fail
    }
  }, [accessToken, activeSessionId, setActiveSession]);

  const loadMessages = useCallback(async (workspaceId: string, sessionId: string) => {
    const result = await apiClient(
      `/workspaces/${workspaceId}/chat/sessions/${sessionId}/messages`,
      { token: accessToken },
    );
    setMessages(result.messages || []);
  }, [accessToken]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || accessToken || !user) return;
    void apiClient("/auth/refresh", { method: "POST" })
      .then((result) => setAuth(result.accessToken, user))
      .catch(() => {
        logout();
        setError("Your session expired. Please log in again.");
      });
  }, [mounted, accessToken, user, setAuth, logout]);

  useEffect(() => {
    if (!mounted || !accessToken) return;
    void loadWorkspaces();
  }, [mounted, accessToken, loadWorkspaces]);

  useEffect(() => {
    if (!mounted || !accessToken || !activeWorkspaceId) return;
    void Promise.all([loadDocuments(activeWorkspaceId), loadSessions(activeWorkspaceId)]);
  }, [
    mounted,
    accessToken,
    activeWorkspaceId,
    loadDocuments,
    loadSessions,
  ]);

  // Poll document status while any doc is still processing
  useEffect(() => {
    const hasInFlight = documents.some(
      (d) => d.status === "QUEUED" || d.status === "PROCESSING" || d.status === "CHUNKING" || d.status === "EMBEDDING"
    );

    if (hasInFlight && activeWorkspaceId && accessToken) {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          void loadDocuments(activeWorkspaceId);
        }, 5000);
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [documents, activeWorkspaceId, accessToken, loadDocuments]);

  useEffect(() => {
    if (!mounted || !accessToken || !activeWorkspaceId || !activeSessionId) return;
    void loadMessages(activeWorkspaceId, activeSessionId);
  }, [mounted, accessToken, activeWorkspaceId, activeSessionId, loadMessages]);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setLoading((current) => ({ ...current, auth: true }));
    await withErrorHandling(async () => {
      const body =
        mode === "register"
          ? authForm
          : { email: authForm.email, password: authForm.password };
      const result = await apiClient(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setAuth(result.accessToken, result.user);
      setStatus(mode === "register" ? "Account created." : "Signed in.");
      await loadWorkspaces(result.accessToken);
    });
    setLoading((current) => ({ ...current, auth: false }));
  };

  const submitWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    if (!workspaceForm.name.trim()) return;

    setLoading((current) => ({ ...current, workspace: true }));
    await withErrorHandling(async () => {
      const result = await apiClient("/workspaces", {
        method: "POST",
        token: accessToken,
        body: JSON.stringify({
          name: workspaceForm.name.trim(),
          description: workspaceForm.description.trim() || undefined,
          template: "RESEARCH",
        }),
      });
      const nextWorkspace = result.workspace;
      setWorkspaces((current) => [nextWorkspace, ...current]);
      setActiveWorkspace(nextWorkspace.id);
      setWorkspaceForm(emptyWorkspace);
      setStatus("Workspace created.");
    });
    setLoading((current) => ({ ...current, workspace: false }));
  };

  const submitDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeWorkspaceId) return;

    setLoading((current) => ({ ...current, upload: true }));
    await withErrorHandling(async () => {
      if (uploadMode === "url") {
        // URL-based source (WEB_URL or YOUTUBE)
        if (!documentUrl.trim()) return;
        const isYoutube = documentUrl.includes("youtube.com") || documentUrl.includes("youtu.be");
        const sourceType = isYoutube ? "YOUTUBE" : "WEB_URL";
        await apiClient(`/workspaces/${activeWorkspaceId}/documents`, {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            title: documentTitle.trim() || documentUrl,
            sourceType,
            url: documentUrl.trim(),
          }),
        });
        setDocumentUrl("");
        setDocumentTitle("");
      } else {
        // File-based source
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", documentTitle.trim() || selectedFile.name);
        formData.append("sourceType", sourceTypeForFile(selectedFile));
        await uploadClient(`/workspaces/${activeWorkspaceId}/documents`, formData, accessToken);
        setSelectedFile(null);
        setDocumentTitle("");
      }
      setStatus("Document queued for processing.");
      await loadDocuments(activeWorkspaceId);
      await loadWorkspaces();
    });
    setLoading((current) => ({ ...current, upload: false }));
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!activeWorkspaceId) return;
    await withErrorHandling(async () => {
      await apiClient(`/workspaces/${activeWorkspaceId}/documents/${documentId}`, {
        method: "DELETE",
        token: accessToken,
      });
      setDocuments((current) => current.filter((d) => d.id !== documentId));
    });
  };

  const createSession = async () => {
    if (!activeWorkspaceId) return;

    setLoading((current) => ({ ...current, chat: true }));
    await withErrorHandling(async () => {
      const result = await apiClient(
        `/workspaces/${activeWorkspaceId}/chat/sessions`,
        {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({
            title: sessionTitle.trim() || "Research chat",
          }),
        },
      );
      setSessions((current) => [result.session, ...current]);
      setActiveSession(result.session.id);
      setMessages([]);
      setSessionTitle("");
      setStatus("Chat session ready.");
    });
    setLoading((current) => ({ ...current, chat: false }));
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeWorkspaceId || !activeSessionId || !prompt.trim()) return;

    const content = prompt.trim();
    setPrompt("");
    setLoading((current) => ({ ...current, chat: true }));
    await withErrorHandling(async () => {
      const optimistic: Message = {
        id: `local-${Date.now()}`,
        role: "USER",
        content,
      };
      setMessages((current) => [...current, optimistic]);
      const result = await apiClient(
        `/workspaces/${activeWorkspaceId}/chat/sessions/${activeSessionId}/messages`,
        {
          method: "POST",
          token: accessToken,
          body: JSON.stringify({ content }),
        },
      );
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimistic.id),
        result.userMessage,
        result.aiMessage,
      ]);
      await loadSessions(activeWorkspaceId);
    });
    setLoading((current) => ({ ...current, chat: false }));
  };

  const handleLogout = async () => {
    await withErrorHandling(async () => {
      if (accessToken) {
        await apiClient("/auth/logout", {
          method: "POST",
          token: accessToken,
        }).catch(() => null);
      }
      logout();
      setWorkspaces([]);
      setDocuments([]);
      setSessions([]);
      setMessages([]);
      setStatus("Signed out.");
    });
  };

  if (!mounted) return null;

  if (user && !accessToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-sm">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted">Restoring secure session</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-10 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-muted">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Private knowledge workspaces
            </div>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
                OmniScript turns documents into a working knowledge system.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted">
                Upload source material, let the backend process it, then ask
                focused questions with workspace-scoped retrieval and citations.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Ingest", "PDF, text, code, audio, image and web sources."],
                ["Organize", "Secure workspaces with isolated document sets."],
                ["Ask", "Chat sessions built on the indexed knowledge base."],
              ].map(([title, copy]) => (
                <div
                  key={title}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{copy}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="mb-6 flex rounded-md border border-border bg-subtle p-1">
              {(["login", "register"] as Mode[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setMode(item)}
                  className={`h-10 flex-1 rounded-md text-sm font-semibold transition ${
                    mode === item
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {item === "login" ? "Log in" : "Create account"}
                </button>
              ))}
            </div>

            <form className="space-y-4" onSubmit={submitAuth}>
              {mode === "register" && (
                <label className="block">
                  <span className="text-sm font-medium text-foreground">Full name</span>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                    value={authForm.fullName}
                    onChange={(event) =>
                      setAuthForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    placeholder="Ada Lovelace"
                    minLength={2}
                    required
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-medium text-foreground">Email</span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="you@example.com"
                  type="email"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-foreground">Password</span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                  type="password"
                  minLength={mode === "register" ? 8 : 1}
                  required
                />
              </label>

              <button
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading.auth}
              >
                {loading.auth ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {mode === "login" ? "Log in" : "Create secure account"}
              </button>
            </form>

            <Feedback error={error} status={status} />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted">OmniScript</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Knowledge workspace
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden rounded-md border border-border px-3 py-2 text-sm text-muted sm:block">
              {user?.fullName}
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-subtle"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-5">
          <section className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Workspaces</h2>
              {loading.boot && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
            </div>

            <div className="space-y-2">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => setActiveWorkspace(workspace.id)}
                  className={`w-full rounded-md border px-3 py-3 text-left transition ${
                    activeWorkspaceId === workspace.id
                      ? "border-primary bg-subtle"
                      : "border-border bg-surface hover:bg-subtle"
                  }`}
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {workspace.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {workspace._count?.documents || 0} documents
                  </span>
                </button>
              ))}
              {workspaces.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted">
                  Create a workspace to start indexing sources.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <FolderPlus className="h-4 w-4" />
              New workspace
            </h2>
            <form className="space-y-3" onSubmit={submitWorkspace}>
              <input
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                value={workspaceForm.name}
                onChange={(event) =>
                  setWorkspaceForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Research vault"
              />
              <textarea
                className="min-h-20 w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                value={workspaceForm.description}
                onChange={(event) =>
                  setWorkspaceForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Scope, team, or topic"
              />
              <button
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
                disabled={loading.workspace || !workspaceForm.name.trim()}
              >
                {loading.workspace ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
            </form>
          </section>
        </aside>

        <section className="space-y-5">
          <Feedback error={error} status={status} />

          <div className="grid gap-5 md:grid-cols-3">
            <Metric
              icon={<Database className="h-5 w-5" />}
              label="Active workspace"
              value={activeWorkspace?.name || "None"}
            />
            <Metric
              icon={<FileText className="h-5 w-5" />}
              label="Documents"
              value={String(documents.length)}
            />
            <Metric
              icon={<MessageSquare className="h-5 w-5" />}
              label="Chat sessions"
              value={String(sessions.length)}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-lg border border-border bg-surface p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Document intake</h2>
                  <p className="mt-1 text-sm text-muted">
                    Upload source files into the selected workspace.
                  </p>
                </div>
                <Upload className="h-5 w-5 text-muted" />
              </div>

              <form className="space-y-4" onSubmit={submitDocument}>
                {/* Mode tabs */}
                <div className="flex rounded-md border border-border bg-subtle p-1">
                  {(["file", "url"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setUploadMode(m)}
                      className={`h-8 flex-1 rounded text-sm font-semibold transition ${
                        uploadMode === m
                          ? "bg-surface text-foreground shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {m === "file" ? "File upload" : "Web / YouTube URL"}
                    </button>
                  ))}
                </div>

                {uploadMode === "file" ? (
                  <label className="block rounded-lg border border-dashed border-border bg-subtle p-4">
                    <span className="text-sm font-semibold text-foreground">Source file</span>
                    <input
                      className="mt-3 block w-full text-sm text-muted file:mr-4 file:h-9 file:rounded-md file:border-0 file:bg-primary file:px-3 file:text-sm file:font-semibold file:text-primary-foreground"
                      type="file"
                      accept=".pdf,.txt,.md,.markdown,.csv,.json,.yaml,.yml,.ts,.tsx,.js,.jsx,.py,.go,.rs,.java,.cpp,.c"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setSelectedFile(file);
                        setDocumentTitle(file?.name.replace(/\.[^/.]+$/, "") || "");
                      }}
                      disabled={!activeWorkspaceId}
                    />
                    <span className="mt-3 block text-xs text-muted">
                      {selectedFile
                        ? `${selectedFile.name} — ${sourceTypeForFile(selectedFile)}`
                        : "PDF, Markdown, CSV, JSON, YAML, code files"}
                    </span>
                  </label>
                ) : (
                  <label className="block">
                    <span className="text-sm font-semibold text-foreground">Page or YouTube URL</span>
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                      type="url"
                      value={documentUrl}
                      onChange={(e) => {
                        setDocumentUrl(e.target.value);
                        if (!documentTitle) setDocumentTitle(e.target.value);
                      }}
                      placeholder="https://example.com/article or YouTube link"
                      disabled={!activeWorkspaceId}
                    />
                    <span className="mt-2 block text-xs text-muted">
                      {documentUrl.includes("youtube.com") || documentUrl.includes("youtu.be")
                        ? "YouTube — transcript will be extracted"
                        : "Web page — article text will be extracted"}
                    </span>
                  </label>
                )}

                <input
                  className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  placeholder="Document title (optional)"
                  disabled={!activeWorkspaceId}
                />

                <button
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    !activeWorkspaceId ||
                    (uploadMode === "file" ? !selectedFile : !documentUrl.trim()) ||
                    loading.upload
                  }
                >
                  {loading.upload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Queue document
                </button>
              </form>

              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-semibold text-muted">Recent documents</h3>
                {documents.map((document) => (
                  <article
                    key={document.id}
                    className="rounded-md border border-border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{document.title}</p>
                        <p className="mt-1 text-xs text-muted">
                          {document.sourceType} | {shortDate(document.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={document.status} />
                        <button
                          onClick={() => handleDeleteDocument(document.id)}
                          className="rounded p-1 text-muted hover:bg-subtle hover:text-danger"
                          title="Delete document"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    {document.status === "FAILED" && document.errorMessage && (
                      <p className="mt-2 rounded bg-danger-soft px-2 py-1 text-xs text-danger">
                        ⚠ {document.errorMessage}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      {document.totalChunks} chunks · {document.tokenCount} tokens
                    </p>
                  </article>
                ))}
                {documents.length === 0 && (
                  <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted">
                    No documents yet. Upload one to activate retrieval.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-surface p-5">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Ask your workspace</h2>
                  <p className="mt-1 text-sm text-muted">
                    Create a session, then query indexed workspace knowledge.
                  </p>
                </div>
                <BookOpen className="h-5 w-5 text-muted" />
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  className="h-10 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                  value={sessionTitle}
                  onChange={(event) => setSessionTitle(event.target.value)}
                  placeholder="Session title"
                  disabled={!activeWorkspaceId}
                />
                <button
                  onClick={createSession}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold hover:bg-subtle disabled:opacity-60"
                  disabled={!activeWorkspaceId || loading.chat}
                >
                  <Plus className="h-4 w-4" />
                  New chat
                </button>
              </div>

              {sessions.length > 0 && (
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setActiveSession(session.id)}
                      className={`shrink-0 rounded-md border px-3 py-2 text-sm ${
                        activeSessionId === session.id
                          ? "border-primary bg-subtle font-semibold"
                          : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {session.title}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex min-h-[360px] flex-col rounded-lg border border-border bg-subtle">
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[88%] rounded-lg border p-3 text-sm leading-6 ${
                        message.role === "USER"
                          ? "ml-auto border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-foreground"
                      }`}
                    >
                      {message.content}
                    </div>
                  ))}
                  {loading.chat && (
                    <div className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking through the indexed context
                    </div>
                  )}
                  {!activeSessionId && (
                    <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                      <Search className="h-8 w-8 text-muted" />
                      <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
                        Start a chat session once your workspace has source
                        material queued or indexed.
                      </p>
                    </div>
                  )}
                </div>

                <form
                  className="grid gap-2 border-t border-border bg-surface p-3 sm:grid-cols-[1fr_auto]"
                  onSubmit={sendMessage}
                >
                  <input
                    className="h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Ask about your uploaded documents"
                    disabled={!activeSessionId || loading.chat}
                  />
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                    disabled={!activeSessionId || !prompt.trim() || loading.chat}
                  >
                    <ArrowUp className="h-4 w-4" />
                    Send
                  </button>
                </form>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feedback({ error, status }: { error: string; status: string }) {
  if (!error && !status) return null;

  return (
    <div
      className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
        error
          ? "border-danger bg-danger-soft text-danger"
          : "border-success bg-success-soft text-success"
      }`}
    >
      {error ? <AlertCircle className="mt-0.5 h-4 w-4" /> : <CheckCircle2 className="mt-0.5 h-4 w-4" />}
      <span>{error || status}</span>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-4 text-muted">{icon}</div>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const inFlight = ["QUEUED", "PROCESSING", "CHUNKING", "EMBEDDING"].includes(status);
  const className =
    status === "INDEXED"
      ? "border-success bg-success-soft text-success"
      : status === "FAILED"
        ? "border-danger bg-danger-soft text-danger"
        : "border-warning bg-warning-soft text-warning";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold uppercase ${className}`}
    >
      {inFlight && <Loader2 className="h-3 w-3 animate-spin" />}
      {status.toLowerCase()}
    </span>
  );
}
