"use client";

import { useState, useEffect, FormEvent } from "react";
import { apiClient } from "@/lib/api";
import { useStore } from "@/store/useStore";
import GuestLanding from "@/components/GuestLanding";
import AuthenticatedApp from "@/components/AuthenticatedApp";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";

type Mode = "login" | "register";

interface FeedbackProps {
  error: string;
  status: string;
}

function Feedback({ error, status }: FeedbackProps) {
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

export default function Home() {
  const { accessToken, user, setAuth } = useStore();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [authForm, setAuthForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const isAuthenticated = Boolean(accessToken && user);

  useEffect(() => {
    setMounted(true);
  }, []);

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");

    try {
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  // Check URL for mode parameter
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlMode = urlParams?.get("mode");
  const showAuth = urlMode === "login" || urlMode === "signup";

  if (!isAuthenticated) {
    // Show auth page if mode=login or mode=signup in URL
    if (showAuth) {
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
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {mode === "login" ? "Log in" : "Create secure account"}
                </button>
              </form>

              <Feedback error={error} status={status} />
            </section>
          </div>
        </main>
      );
    }

    // Default: Show guest landing page
    return <GuestLanding />;
  }

  // Authenticated user - show new UI
  return <AuthenticatedApp />;
}
