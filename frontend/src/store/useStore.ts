import { create } from "zustand";
import { persist } from "zustand/middleware";

type User = {
  id: string;
  email: string;
  fullName: string;
};

interface AppState {
  accessToken: string | null;
  user: User | null;
  activeWorkspaceId: string | null;
  activeSessionId: string | null;
  setAuth: (accessToken: string, user: User) => void;
  setActiveWorkspace: (workspaceId: string | null) => void;
  setActiveSession: (sessionId: string | null) => void;
  logout: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      activeWorkspaceId: null,
      activeSessionId: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      setActiveWorkspace: (workspaceId) =>
        set({ activeWorkspaceId: workspaceId, activeSessionId: null }),
      setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
      logout: () =>
        set({
          accessToken: null,
          user: null,
          activeWorkspaceId: null,
          activeSessionId: null,
        }),
    }),
    {
      name: "omniscript-storage",
      partialize: (state) => ({
        user: state.user,
        activeWorkspaceId: state.activeWorkspaceId,
        activeSessionId: state.activeSessionId,
      }),
    },
  ),
);
