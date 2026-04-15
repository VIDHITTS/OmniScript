"use client";

import { X, CheckCircle2, ArrowRight } from "lucide-react";

interface SignupPromptProps {
  isOpen: boolean;
  onClose: () => void;
  limitType: "document" | "query";
}

export default function SignupPrompt({ isOpen, onClose, limitType }: SignupPromptProps) {
  if (!isOpen) return null;

  const benefits = [
    "Upload unlimited documents",
    "Create multiple workspaces",
    "Unlimited AI-powered queries",
    "Advanced document processing",
    "Full retrieval and citations",
    "Priority support",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 hover:bg-subtle"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold">
            {limitType === "document" ? "Upload Limit Reached" : "Query Limit Reached"}
          </h2>
          <p className="mt-2 text-muted">
            You've used your free trial. Sign up to unlock unlimited access!
          </p>
        </div>

        <div className="mb-6 space-y-3">
          {benefits.map((benefit, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              <span className="text-sm">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              window.location.href = "/?mode=signup";
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground hover:opacity-90"
          >
            Sign Up Free <ArrowRight className="h-4 w-4" />
          </button>

          <button
            onClick={() => {
              window.location.href = "/?mode=login";
            }}
            className="flex h-12 w-full items-center justify-center rounded-lg border border-border bg-surface font-semibold hover:bg-subtle"
          >
            Already have an account? Log in
          </button>
        </div>
      </div>
    </div>
  );
}
