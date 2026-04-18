"use client";

import { useState, useEffect, FormEvent } from "react";
import { FolderOpen, Plus, X, LogOut, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useStore } from "@/store/useStore";

type Workspace = {
  id: string;
  name: string;
  description?: string | null;
  _count?: { documents?: number };
};

interface WorkspaceListProps {
  onSelectWorkspace: (workspace: Workspace) => void;
}

export default function WorkspaceList({ onSelectWorkspace }: WorkspaceListProps) {
  const { accessToken, user, logout } = useStore();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const result = await apiClient("/workspaces", { token: accessToken });
      setWorkspaces(result.workspaces || []);
    } catch (error) {
      console.error("Failed to load workspaces", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setWorkspaceName("");
      setShowNewWorkspace(false);
    } catch (error) {
      console.error("Failed to create workspace", error);
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
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold">OmniScript</h1>
            <p className="text-sm text-muted">Welcome, {user?.fullName}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium hover:bg-subtle"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-semibold">Your Workspaces</h2>
              <p className="mt-2 text-muted">
                Select a workspace to view documents and start chatting
              </p>
            </div>
            <button
              onClick={() => setShowNewWorkspace(!showNewWorkspace)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              {showNewWorkspace ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  New Workspace
                </>
              )}
            </button>
          </div>

          {/* New Workspace Form */}
          {showNewWorkspace && (
            <div className="mb-8 rounded-lg border border-border bg-surface p-6">
              <h3 className="mb-4 text-lg font-semibold">Create New Workspace</h3>
              <form onSubmit={handleCreateWorkspace} className="flex gap-3">
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Enter workspace name"
                  className="h-11 flex-1 rounded-md border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  autoFocus
                />
                <button
                  type="submit"
                  className="h-11 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Create
                </button>
              </form>
            </div>
          )}

          {/* Workspaces Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface p-12 text-center">
              <FolderOpen className="mx-auto h-12 w-12 text-muted" />
              <h3 className="mt-4 text-lg font-semibold">No workspaces yet</h3>
              <p className="mt-2 text-sm text-muted">
                Create your first workspace to get started
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => onSelectWorkspace(workspace)}
                  className="group rounded-lg border border-border bg-surface p-6 text-left transition hover:border-primary hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-3">
                      <FolderOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold group-hover:text-primary">
                        {workspace.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted">
                        {workspace._count?.documents || 0} documents
                      </p>
                      {workspace.description && (
                        <p className="mt-2 text-sm text-muted">
                          {workspace.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
