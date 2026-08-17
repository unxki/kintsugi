/// <reference types="vite/client" />

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL;

  // If frontend is on HTTPS (e.g. Vercel) and backend is insecure HTTP without SSL,
  // use relative path so requests flow through Vercel's rewrite proxy without Mixed Content blocking.
  if (typeof window !== "undefined" && window.location.protocol === "https:" && envUrl && envUrl.startsWith("http://")) {
    return "";
  }

  if (envUrl && typeof envUrl === "string" && envUrl.trim() !== "") {
    return envUrl.replace(/\/$/, "");
  }
  return "";
};

export const apiUrl = (path: string): string => {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};
