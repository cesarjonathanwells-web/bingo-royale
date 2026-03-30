import type { User, UserStats } from "@bingo/shared";

const API_BASE = import.meta.env.MODE === "production" ? "" : "http://localhost:3000";

/**
 * Custom error class for API responses.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Generic fetch wrapper that adds auth token and handles errors.
 */
export async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem("bingo-token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(res.status, body.message ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

// ============================================================
// Auth API
// ============================================================

interface AuthResponse {
  user: User;
  token: string;
}

export async function loginAsGuest(
  name: string,
  locale: "en" | "es" = "en",
): Promise<AuthResponse> {
  return fetchApi<AuthResponse>("/api/auth/guest", {
    method: "POST",
    body: JSON.stringify({ name, locale }),
  });
}

export async function register(
  name: string,
  email: string,
  password: string,
  locale: "en" | "es" = "en",
): Promise<AuthResponse> {
  return fetchApi<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, locale }),
  });
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return fetchApi<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ============================================================
// Stats API
// ============================================================

export async function getStats(): Promise<UserStats> {
  return fetchApi<UserStats>("/api/stats");
}
