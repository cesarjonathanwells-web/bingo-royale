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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      loginAsGuest: async (name, locale = "en") => {
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await api.loginAsGuest(name, locale);
          localStorage.setItem("bingo-token", token);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (err) {
          const message =
            err instanceof api.ApiError ? err.message : "Login failed";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (name, email, password, locale = "en") => {
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await api.register(
            name,
            email,
            password,
            locale,
          );
          localStorage.setItem("bingo-token", token);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (err) {
          const message =
            err instanceof api.ApiError ? err.message : "Registration failed";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await api.login(email, password);
          localStorage.setItem("bingo-token", token);
          set({ user, token, isAuthenticated: true, isLoading: false });
        } catch (err) {
          const message =
            err instanceof api.ApiError ? err.message : "Login failed";
          set({ error: message, isLoading: false });
          throw err;
        }
      },

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
