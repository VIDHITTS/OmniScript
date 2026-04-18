"use client";

import { useState } from "react";
import {
  FileText,
  Upload,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Link as LinkIcon,
  Plus,
  ArrowLeft,
} from "lucide-react";

type Document = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  errorMessage?: string | null;
};

interface WorkspaceSidebarProps {
  workspaceName: string;
  documents: Document[];
  uploading: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
}

export default function WorkspaceSidebar({
  workspaceName,
  documents,
  uploading,
  onFileUpload,
  onBack,
}: WorkspaceSidebarProps) {
  const [activeTab, setActiveTab] = useState<"documents" | "links">("documents");

  return (
    <aside className="flex h-screen w-80 flex-col border-r border-border bg-surface">
      {/* Header */}
      <div className="border-b border-border p-4">
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Workspaces
        </button>
        <h2 className="truncate text-lg font-semibold">{workspaceName}</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("documents")}
          className={`flex-1 border-b-2 px-4 py-3 text-sm font-medium transition ${
            activeTab === "documents"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </div>
        </button>
        <button
          onClick={() => setActiveTab("links")}
          className={`flex-1 border-b-2 px-4 py-3 text-sm font-medium transition ${
            activeTab === "links"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Links
          </div>
        </button>
      </div>

      {/* Upload Button */}
      <div className="border-b border-border p-4">
        {activeTab === "documents" ? (
          <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
            <input
              type="file"
              onChange={onFileUpload}
              disabled={uploading}
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
        ) : (
          <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" />
            Add Link
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "documents" ? (
          <div className="space-y-2">
            {documents.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted" />
                <p className="mt-2 text-sm text-muted">No documents yet</p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-lg border border-border bg-background p-3 transition hover:border-primary"
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
                        {["QUEUED", "PROCESSING", "CHUNKING", "EMBEDDING"].includes(
                          doc.status
                        ) && (
                          <>
                            <Clock className="h-3 w-3 text-warning" />
                            <span className="text-warning">
                              {doc.status.toLowerCase()}
                            </span>
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
              ))
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <LinkIcon className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-2 text-sm text-muted">No links yet</p>
          </div>
        )}
      </div>
    </aside>
  );
}
