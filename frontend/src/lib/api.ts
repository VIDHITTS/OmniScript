import { useStore } from "@/store/useStore";

const baseURL = process.env.NEXT_PUBLIC_API_URL || "https://vidhitts-omniscript.hf.space/api";

type ApiOptions = RequestInit & {
  token?: string | null;
};

const parseApiError = async (response: Response, fallback: string) => {
  const errorData = await response.json().catch(() => ({}));
  // Zod validation errors return details array — surface the first field message
  if (errorData.details?.length > 0) {
    const firstDetail = errorData.details[0];
    const fieldLabel = firstDetail.field
      ? `${firstDetail.field.charAt(0).toUpperCase() + firstDetail.field.slice(1)}: `
      : '';
    return new Error(fieldLabel + firstDetail.message);
  }
  return new Error(errorData.message || errorData.error || fallback);
};

/**
 * Attempt to silently refresh the access token using the HttpOnly refresh
 * token cookie. Updates the Zustand store on success.
 * Returns the new access token, or null if refresh failed.
 */
async function tryRefreshToken(): Promise<string | null> {
  try {
    const response = await fetch(`${baseURL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) return null;
    const data = await response.json();
    const newToken: string | null = data.accessToken ?? null;
    if (newToken) {
      const { user, setAuth } = useStore.getState();
      if (user) setAuth(newToken, user);
    }
    return newToken;
  } catch {
    return null;
  }
}

/**
 * Core JSON API client with automatic 401 → token refresh → retry.
 */
export const apiClient = async (url: string, options: ApiOptions = {}) => {
  const { token, headers, ...requestOptions } = options;

  const doFetch = (authToken: string | null | undefined) =>
    fetch(`${baseURL}${url}`, {
      ...requestOptions,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
      credentials: "include",
    });

  let response = await doFetch(token);

  // On 401 — try refreshing the access token once then retry
  if (response.status === 401 && token) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      response = await doFetch(newToken);
    } else {
      // Refresh failed — force logout
      useStore.getState().logout();
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    throw await parseApiError(response, "Something went wrong with the request.");
  }

  return response.json();
};

/**
 * Multipart file upload client with automatic 401 → token refresh → retry.
 */
export const uploadClient = async (
  url: string,
  formData: FormData,
  token?: string | null,
) => {
  const doUpload = (authToken: string | null | undefined) =>
    fetch(`${baseURL}${url}`, {
      method: "POST",
      body: formData,
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      credentials: "include",
    });

  let response = await doUpload(token);

  // On 401 — try refreshing the access token once then retry
  if (response.status === 401 && token) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      response = await doUpload(newToken);
    } else {
      useStore.getState().logout();
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    throw await parseApiError(response, "Upload failed. Please try again.");
  }

  return response.json();
};
