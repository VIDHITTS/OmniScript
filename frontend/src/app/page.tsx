"use client";

import { useStore } from "@/store/useStore";
import { CopyPlus, FileText, Lock, Plus, UploadCloud } from "lucide-react";
import { useState, useEffect } from "react";

export default function Home() {
  const {
    guestWorkspaceId,
    guestWorkspaceName,
    guestDocumentTitle,
    createGuestWorkspace,
    uploadGuestDocument,
  } = useStore();
  const [workspaceName, setWorkspaceName] = useState("");
  const [fileName, setFileName] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFileName(e.dataTransfer.files[0].name);
    }
  };

  if (!isMounted) return null; // Hydration fix

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 border-box sm:p-24 relative overflow-hidden bg-background text-foreground">
      {/* Warm Background Graphic Element without pure gradients */}
      <div className="absolute top-0 -z-10 w-full h-[50vh] bg-[var(--background-alt)] dark:bg-[var(--background-alt)] opacity-50" />

      <div className="w-full max-w-3xl text-center space-y-6 z-10">
        <div className="inline-flex items-center justify-center p-4 rounded-full bg-white dark:bg-[#1f1e1a] border border-gray-200 dark:border-[#383631] shadow-sm mb-4">
          <CopyPlus className="w-10 h-10 sm:w-14 sm:h-14 text-[var(--accent)]" />
        </div>

        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-[var(--foreground)]">
          Omni<span className="text-[var(--muted)]">Script</span>
        </h1>

        <p className="text-xl sm:text-2xl text-[var(--muted)] max-w-2xl mx-auto mt-6">
          The AI-powered knowledge operating system. Ingest, organize, search,
          and converse with your data.
        </p>

        {/* WORKFLOW CONTAINER */}
        <div className="mt-16 w-full bg-white dark:bg-[#181714] shadow-xl border border-gray-100 dark:border-[#2d2a25] rounded-3xl p-8 sm:p-12 text-left">
          {/* STEP 1: Create Workspace */}
          {!guestWorkspaceId && (
            <div className="space-y-6">
              <h2 className="text-3xl font-semibold flex items-center gap-4 text-[var(--foreground)]">
                <span className="bg-[var(--accent)] text-white dark:text-[#111] w-10 h-10 rounded-full flex items-center justify-center text-lg">
                  1
                </span>
                Create your first Workspace
              </h2>
              <p className="text-lg text-[var(--muted)] pl-14">
                Workspaces act as isolated vaults for a specific topic, like
                &quot;Physics 101&quot; or &quot;Legal Case&quot;.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pl-14 pt-4">
                <input
                  type="text"
                  placeholder="e.g. Machine Learning Research"
                  className="flex-1 px-5 py-4 text-lg rounded-xl border border-gray-300 dark:border-[#444] bg-[#fafafa] dark:bg-[#222] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />
                <button
                  onClick={() =>
                    workspaceName && createGuestWorkspace(workspaceName)
                  }
                  disabled={!workspaceName}
                  className="bg-[var(--accent)] hover:opacity-90 text-white dark:text-[#111] px-8 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-6 h-6" /> Let&apos;s Go
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Upload Document */}
          {guestWorkspaceId && !guestDocumentTitle && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-semibold flex items-center gap-4 text-[var(--foreground)]">
                  <span className="bg-[var(--accent)] text-white dark:text-[#111] w-10 h-10 rounded-full flex items-center justify-center text-lg">
                    2
                  </span>
                  Upload a Document
                </h2>
                <span className="text-sm px-4 py-2 bg-gray-100 dark:bg-[#2a2824] text-[var(--muted)] rounded-full font-medium border border-gray-200 dark:border-[#333]">
                  {guestWorkspaceName} Vault
                </span>
              </div>
              <p className="text-lg text-[var(--muted)] pl-14">
                Add your first piece of knowledge to your vault. We&apos;ll simulate
                the upload for our guest experience.
              </p>

              <div
                className={`mt-6 ml-14 border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all bg-[#fafafa] dark:bg-[#1a1916] ${
                  isDragging
                    ? "border-[var(--accent)] bg-[var(--background-alt)] dark:bg-[var(--background-alt)] opacity-80"
                    : "border-gray-300 dark:border-[#3b3833]"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <UploadCloud
                  className={`w-14 h-14 mb-6 transition-colors ${isDragging ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
                />
                <p className="text-xl font-medium mb-2 text-[var(--foreground)]">
                  Drag and drop, or type a mock filename
                </p>
                <p className="text-md text-[var(--muted)] mb-8">
                  PDF, JSON, TXT, MD supported
                </p>

                <div className="flex flex-col sm:flex-row w-full max-w-lg gap-4">
                  <input
                    type="text"
                    placeholder="e.g. quantum-physics-notes.pdf"
                    className="flex-1 px-5 py-4 text-lg rounded-xl border border-gray-300 dark:border-[#444] bg-white dark:bg-[#222] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                  />
                  <button
                    onClick={() => fileName && uploadGuestDocument(fileName)}
                    disabled={!fileName}
                    className="bg-[var(--accent)] hover:opacity-90 text-white dark:text-[#111] px-8 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Upload
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Prompt Login/Signup */}
          {guestWorkspaceId && guestDocumentTitle && (
            <div className="space-y-8 text-center py-6">
              <div className="inline-flex items-center gap-3 px-6 py-3 bg-[#e8f5e9] dark:bg-[#1c2e20] text-[#2e7d32] dark:text-[#81c784] rounded-full font-medium text-md border border-[#c8e6c9] dark:border-[#2e7d32]">
                <FileText className="w-5 h-5" /> &quot;{guestDocumentTitle}&quot; uploaded
                to {guestWorkspaceName}!
              </div>

              <div className="space-y-4 pt-4">
                <h2 className="text-4xl font-bold text-[var(--foreground)]">
                  Unlock Agentic RAG
                </h2>
                <p className="text-xl text-[var(--muted)] max-w-2xl mx-auto">
                  You&apos;ve hit the guest limit. OmniScript requires an account to
                  process the knowledge graph, build relationships, and start
                  generating intelligent insights.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8 pb-4">
                <button className="w-full sm:w-auto bg-[var(--accent)] hover:opacity-90 text-white dark:text-[#111] px-10 py-5 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all shadow-md">
                  <Lock className="w-6 h-6" /> Sign up for free
                </button>
                <button className="w-full sm:w-auto bg-transparent border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--background-alt)] px-10 py-5 rounded-xl font-semibold text-lg transition-all">
                  Log in
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
