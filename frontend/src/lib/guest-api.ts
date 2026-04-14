const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://vidhitts-omniscript.hf.space/api";

/**
 * Guest API Client - Handles guest user API calls
 */

export const guestApi = {
  /**
   * Get or create guest session
   */
  async getSession() {
    const response = await fetch(`${baseURL}/guest/session`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to get guest session");
    }

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

    const response = await fetch(`${baseURL}/guest/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to upload document");
    }

    return response.json();
  },

  /**
   * Send chat message as guest
   */
  async sendMessage(content: string, workspaceId: string, userId: string) {
    const response = await fetch(`${baseURL}/guest/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, workspaceId, userId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send message");
    }

    return response.json();
  },

  /**
   * Get chat messages
   */
  async getMessages(chatSessionId: string) {
    const response = await fetch(`${baseURL}/guest/messages/${chatSessionId}`, {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error("Failed to get messages");
    }

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
