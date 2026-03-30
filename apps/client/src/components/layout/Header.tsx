import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { useTheme } from "@/hooks/useTheme";
import { useSoundStore } from "@/hooks/useSound";
import { generateRoomCode } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function Header() {
  const { t, i18n } = useTranslation(["common", "game"]);
  const user = useAuthStore((s) => s.user);
  const room = useRoomStore((s) => s.room);
  const autoDaub = useRoomStore((s) => s.autoDaub);
  const toggleAutoDaub = useRoomStore((s) => s.toggleAutoDaub);
  const { theme, toggleTheme } = useTheme();
  const { muted, toggleMute } = useSoundStore();

  const toggleLanguage = () => {
    const next = i18n.language === "en" ? "es" : "en";
    i18n.changeLanguage(next);
  };

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-bg-primary)]/80 backdrop-blur-lg border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 max-w-5xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <h1 className="text-sm sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-[var(--color-ball-b)] via-[var(--color-ball-i)] to-[var(--color-ball-o)] bg-clip-text text-transparent">
            {t("app.title")}
          </h1>
          {room && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--color-bg-tertiary)] text-xs font-mono font-bold text-[var(--color-text-secondary)]">
              {generateRoomCode(room.code)}
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className={cn(
              "p-2 rounded-lg text-xs font-bold transition-colors",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]",
            )}
            title={t("settings.language")}
          >
            {i18n.language === "en" ? "EN" : "ES"}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              "p-2 rounded-lg transition-colors",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]",
            )}
            title={t("settings.theme")}
          >
            {theme === "dark" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleMute}
            className={cn(
              "p-2 rounded-lg transition-colors",
              "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]",
            )}
            title={t("settings.sound")}
          >
            {muted ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
          </button>

          {/* Auto-Daub Toggle - only visible during a game */}
          {room?.state === "in_progress" && (
            <button
              onClick={toggleAutoDaub}
              className={cn(
                "p-2 rounded-lg text-xs font-bold transition-colors",
                autoDaub
                  ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]",
              )}
              title={t("autoDaub.toggle", { ns: "game" })}
            >
              AD
            </button>
          )}

          {/* Player Name */}
          {user && (
            <span className="ml-2 px-2.5 py-1 rounded-lg bg-[var(--color-bg-tertiary)] text-xs font-medium text-[var(--color-text-secondary)] max-w-[100px] truncate">
              {user.name}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
