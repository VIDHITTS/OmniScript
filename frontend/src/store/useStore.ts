import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GuestState {
  guestWorkspaceId: string | null;
  guestWorkspaceName: string | null;
  guestDocumentTitle: string | null;
  isAuthenticated: boolean;
  createGuestWorkspace: (name: string) => void;
  uploadGuestDocument: (title: string) => void;
  login: () => void;
  logout: () => void;
}

export const useStore = create<GuestState>()(
  persist(
    (set) => ({
      guestWorkspaceId: null,
      guestWorkspaceName: null,
      guestDocumentTitle: null,
      isAuthenticated: false,
      createGuestWorkspace: (name) =>
        set({
          guestWorkspaceId: "mock-ws-" + Date.now().toString(),
          guestWorkspaceName: name,
        }),
      uploadGuestDocument: (title) =>
        set({
          guestDocumentTitle: title,
        }),
      login: () => set({ isAuthenticated: true }),
      logout: () =>
        set({
          isAuthenticated: false,
          guestWorkspaceId: null,
          guestWorkspaceName: null,
          guestDocumentTitle: null,
        }),
    }),
    {
      name: "omniscript-storage",
    },
  ),
);
