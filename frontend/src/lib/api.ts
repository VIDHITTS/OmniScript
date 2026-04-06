export const apiClient = async (url: string, options: RequestInit = {}) => {
  const baseURL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

  const defaultOptions: RequestInit = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    // Allows sending and receiving cross-origin cookies in Next.js + Express
    credentials: "include",
  };

  const response = await fetch(`${baseURL}${url}`, defaultOptions);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || "Something went wrong with the request.",
    );
  }

  return response.json();
};
