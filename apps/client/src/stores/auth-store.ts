import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@bingo/shared";
import * as api from "@/lib/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  loginAsGuest: (name: string, locale?: "en" | "es") => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    locale?: "en" | "es",
  ) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

/**
 * Wraps an auth API call with loading state, token persistence, and error handling.
 */
async function performAuth(
  set: (partial: Partial<AuthState>) => void,
  apiFn: () => Promise<{ user: User; token: string }>,
  fallbackMessage: string,
): Promise<void> {
  set({ isLoading: true, error: null });
  try {
    const { user, token } = await apiFn();
    localStorage.setItem("bingo-token", token);
    set({ user, token, isAuthenticated: true, isLoading: false });
  } catch (err) {
    const message =
      err instanceof api.ApiError ? err.message : fallbackMessage;
    set({ error: message, isLoading: false });
    throw err;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      loginAsGuest: (name, locale = "en") =>
        performAuth(
          set,
          () => api.loginAsGuest(name, locale),
          "Login failed",
        ),

      register: (name, email, password, locale = "en") =>
        performAuth(
          set,
          () => api.register(name, email, password, locale),
          "Registration failed",
        ),

      login: (email, password) =>
        performAuth(
          set,
          () => api.login(email, password),
          "Login failed",
        ),

      logout: () => {
        localStorage.removeItem("bingo-token");
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "bingo-auth",
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
