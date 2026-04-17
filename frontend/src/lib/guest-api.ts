const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://vidhitts-omniscript.hf.space/api";

/**
 * Guest API Client - Handles guest user API calls
 */

// Get session ID from localStorage
function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("omniscript-guest-session-id");
}

// Save session ID to localStorage
function saveSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("omniscript-guest-session-id", sessionId);
}

// Extract session ID from response headers
function extractSessionId(response: Response): void {
  const sessionId = response.headers.get("X-Guest-Session-Id");
  if (sessionId) {
    saveSessionId(sessionId);
  }
}

export const guestApi = {
  /**
   * Get or create guest session
   */
  async getSession() {
    const sessionId = getSessionId();
    const headers: HeadersInit = {};
    if (sessionId) {
      headers["X-Guest-Session-Id"] = sessionId;
    }

    const response = await fetch(`${baseURL}/guest/session`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Failed to get guest session");
    }

    extractSessionId(response);
    return response.json();
  },

  /**
   * Upload document as guest
   */
  async uploadDocument(file: File, title?: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title || file.name);
    formData.append("sourceType", getSourceType(file));

    const sessionId = getSessionId();
    const headers: HeadersInit = {};
    if (sessionId) {
      headers["X-Guest-Session-Id"] = sessionId;
    }

    const response = await fetch(`${baseURL}/guest/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to upload document");
    }

    extractSessionId(response);
    return response.json();
  },

  /**
   * Send chat message as guest
   */
  async sendMessage(content: string, workspaceId: string, userId: string) {
    const sessionId = getSessionId();
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (sessionId) {
      headers["X-Guest-Session-Id"] = sessionId;
    }

    const response = await fetch(`${baseURL}/guest/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content, workspaceId, userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send message");
    }

    extractSessionId(response);
    return response.json();
  },

  /**
   * Get chat messages
   */
  async getMessages(chatSessionId: string) {
    const sessionId = getSessionId();
    const headers: HeadersInit = {};
    if (sessionId) {
      headers["X-Guest-Session-Id"] = sessionId;
    }

    const response = await fetch(`${baseURL}/guest/messages/${chatSessionId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Failed to get messages");
    }

    extractSessionId(response);
    return response.json();
  },
};

function getSourceType(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "MARKDOWN";
  if (name.endsWith(".txt")) return "TEXT";
  return "TEXT";
}
