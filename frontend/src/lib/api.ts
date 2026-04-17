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
 * Core JSON API client with automatic 401 → logout.
 */
export const apiClient = async (url: string, options: ApiOptions = {}) => {
  const { token, headers, ...requestOptions } = options;

  const response = await fetch(`${baseURL}${url}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  // On 401 — token expired, force logout
  if (response.status === 401) {
    useStore.getState().logout();
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    throw await parseApiError(response, "Something went wrong with the request.");
  }

  return response.json();
};

/**
 * Multipart file upload client with automatic 401 → logout.
 */
export const uploadClient = async (
  url: string,
  formData: FormData,
  token?: string | null,
) => {
  const response = await fetch(`${baseURL}${url}`, {
    method: "POST",
    body: formData,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // On 401 — token expired, force logout
  if (response.status === 401) {
    useStore.getState().logout();
    throw new Error("Session expired. Please log in again.");
  }

  if (!response.ok) {
    throw await parseApiError(response, "Upload failed. Please try again.");
  }

  return response.json();
};
