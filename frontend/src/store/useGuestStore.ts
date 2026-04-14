import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GuestLimits {
  maxDocuments: number;
  maxQueries: number;
  documentsRemaining: number;
  queriesRemaining: number;
  documentsUploaded: number;
  queriesUsed: number;
}

interface GuestState {
  sessionId: string | null;
  limits: GuestLimits | null;
  workspaceId: string | null;
  chatSessionId: string | null;
  documentId: string | null;
  expiresAt: string | null;
  setSession: (sessionId: string, limits: GuestLimits, expiresAt: string) => void;
  setWorkspace: (workspaceId: string) => void;
  setChatSession: (chatSessionId: string) => void;
  setDocument: (documentId: string) => void;
  updateLimits: (limits: GuestLimits) => void;
  clearSession: () => void;
  isLimitReached: (type: "document" | "query") => boolean;
}

export const useGuestStore = create<GuestState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      limits: null,
      workspaceId: null,
      chatSessionId: null,
      documentId: null,
      expiresAt: null,

      setSession: (sessionId, limits, expiresAt) =>
        set({ sessionId, limits, expiresAt }),

      setWorkspace: (workspaceId) => set({ workspaceId }),

      setChatSession: (chatSessionId) => set({ chatSessionId }),

      setDocument: (documentId) => set({ documentId }),

      updateLimits: (limits) => set({ limits }),

      clearSession: () =>
        set({
          sessionId: null,
          limits: null,
          workspaceId: null,
          chatSessionId: null,
          documentId: null,
          expiresAt: null,
        }),

      isLimitReached: (type) => {
        const { limits } = get();
        if (!limits) return true;
        return type === "document"
          ? limits.documentsRemaining === 0
          : limits.queriesRemaining === 0;
      },
    }),
    {
      name: "omniscript-guest-storage",
    }
  )
);
