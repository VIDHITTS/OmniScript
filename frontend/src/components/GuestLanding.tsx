"use client";

import { useState, useEffect, FormEvent } from "react";
import { Upload, MessageSquare, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useGuestStore } from "@/store/useGuestStore";
import { guestApi } from "@/lib/guest-api";
import SignupPrompt from "./SignupPrompt";

export default function GuestLanding() {
  const {
    limits,
    workspaceId,
    documentId,
    setSession,
    setWorkspace,
    setDocument,
    setChatSession,
    updateLimits,
    isLimitReached,
  } = useGuestStore();

  const [mounted, setMounted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Array<{ id: string; role: string; content: string }>>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [limitType, setLimitType] = useState<"document" | "query">("document");

  useEffect(() => {
    setMounted(true);
    // Initialize guest session
    guestApi.getSession().then((data) => {
      setSession(data.sessionId, data.limits, data.expiresAt);
    }).catch(console.error);
  }, [setSession]);

  const handleFileUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const result = await guestApi.uploadDocument(selectedFile);
      setDocument(result.document.id);
      setWorkspace(result.workspaceId);
      updateLimits(result.limits);
      setSuccess("Document uploaded! You can now ask questions.");
      setSelectedFile(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Upload failed";
      setError(errorMessage);
      if (errorMessage.includes("limit")) {
        setLimitType("document");
        setShowSignupModal(true);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSendQuery = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !workspaceId) return;

    setChatting(true);
    setError("");

    try {
      const result = await guestApi.sendMessage(
        query,
        workspaceId,
        "guest@omniscript.temp"
      );
      setMessages([...messages, result.userMessage, result.aiMessage]);
      setChatSession(result.chatSession.id);
      updateLimits(result.limits);
      setQuery("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Query failed";
      setError(errorMessage);
      if (errorMessage.includes("limit")) {
        setLimitType("query");
        setShowSignupModal(true);
      }
    } finally {
      setChatting(false);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <SignupPrompt
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        limitType={limitType}
      />

      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <h1 className="text-xl font-bold">OmniScript</h1>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = "/?mode=login"}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-subtle"
              >
                Log In
              </button>
              <button
                onClick={() => window.location.href = "/?mode=signup"}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Sign Up
              </button>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Try OmniScript Free
          </h1>
          <p className="mt-4 text-lg text-muted">
            Upload 1 document and ask 2 questions. No signup required.
          </p>
          
          {limits && (
            <div className="mt-6 flex gap-4">
              <div className="rounded-lg border border-border bg-subtle px-4 py-2">
                <span className="text-sm text-muted">Documents: </span>
                <span className="font-semibold">
                  {limits.maxDocuments - limits.documentsRemaining}/{limits.maxDocuments}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-subtle px-4 py-2">
                <span className="text-sm text-muted">Queries: </span>
                <span className="font-semibold">
                  {limits.maxQueries - limits.queriesRemaining}/{limits.maxQueries}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger bg-danger-soft p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-danger" />
            <span className="text-sm text-danger">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-success bg-success-soft p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <span className="text-sm text-success">{success}</span>
          </div>
        )}

        {/* Signup Prompt Modal */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Upload Section */}
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="mb-4 flex items-center gap-3">
              <Upload className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Upload Document</h2>
            </div>

            <form onSubmit={handleFileUpload} className="space-y-4">
              <label className={`block rounded-lg border-2 border-dashed p-6 text-center ${
                isLimitReached("document") 
                  ? "border-border bg-subtle opacity-50 cursor-not-allowed"
                  : "border-border bg-subtle cursor-pointer hover:border-primary"
              }`}>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  disabled={isLimitReached("document")}
                  className="hidden"
                />
                <div className="text-sm">
                  {selectedFile ? (
                    <span className="font-semibold">{selectedFile.name}</span>
                  ) : isLimitReached("document") ? (
                    <span className="text-muted">Upload limit reached</span>
                  ) : (
                    <span className="text-muted">Click to select PDF, TXT, or MD file</span>
                  )}
                </div>
              </label>

              <button
                type="submit"
                disabled={!selectedFile || uploading || isLimitReached("document")}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload Document
              </button>
            </form>
          </div>

          {/* Chat Section */}
          <div className="rounded-lg border border-border bg-surface p-6">
            <div className="mb-4 flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Ask Questions</h2>
            </div>

            {!documentId ? (
              <div className="rounded-lg border border-dashed border-border bg-subtle p-8 text-center">
                <p className="text-sm text-muted">Upload a document first to start asking questions</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border bg-subtle p-4">
                  {messages.length === 0 ? (
                    <p className="text-center text-sm text-muted">No messages yet</p>
                  ) : (
                    messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg p-3 text-sm ${
                          msg.role === "USER"
                            ? "ml-auto max-w-[80%] bg-primary text-primary-foreground"
                            : "mr-auto max-w-[80%] bg-surface"
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendQuery} className="flex gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={isLimitReached("query") ? "Query limit reached" : "Ask a question..."}
                    disabled={chatting || isLimitReached("query")}
                    className="h-11 flex-1 rounded-lg border border-border bg-surface px-4 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!query.trim() || chatting || isLimitReached("query")}
                    className="flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {chatting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
