import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "bingo-theme" },
  ),
);

/**
 * Hook that syncs the theme class on documentElement.
 * Call this once at the app root.
 */
export function useThemeEffect(): void {
  const theme = useThemeStore((s) => s.theme);

  // Apply immediately (no useEffect needed since Zustand is synchronous)
  // But we still need to handle it in an effect for SSR safety
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }
}

/**
 * Convenience hook that returns theme + toggle.
 */
export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  useThemeEffect();
  return { theme, toggleTheme };
}
