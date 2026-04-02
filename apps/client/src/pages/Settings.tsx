import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { useTheme } from "@/hooks/useTheme";
import { useSoundStore } from "@/hooks/useSound";
import { cn } from "@/lib/utils";

export function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const autoDaub = useRoomStore((s) => s.autoDaub);
  const toggleAutoDaub = useRoomStore((s) => s.toggleAutoDaub);
  const { theme, toggleTheme } = useTheme();
  const { muted, toggleMute } = useSoundStore();

  const handleLogout = useCallback(() => {
    logout();
    navigate({ to: "/" });
  }, [logout, navigate]);

  const currentLang = i18n.language === "es" ? "es" : "en";
  const setLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="flex-1 px-4 py-8 pb-24 max-w-lg mx-auto w-full animate-page-enter">
      <h1 className="font-gaming text-2xl text-gold mb-6">
        {t("settings.title")}
      </h1>

      <div className="space-y-4">
        {/* Player Section */}
        {user && (
          <section className="rounded-xl glass p-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              {t("settings.player")}
            </h2>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-amber-600 flex items-center justify-center text-base font-bold text-white shrink-0 ring-2 ring-[var(--color-neon-purple)]/30 ring-offset-2 ring-offset-[var(--color-bg-primary)]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {user.name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t("auth.playAsGuest")}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-2 rounded-lg text-sm font-medium text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors cursor-pointer"
            >
              {t("settings.logout")}
            </button>
          </section>
        )}

        {/* Language Section */}
        <section className="rounded-xl glass p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
            {t("settings.language")}
          </h2>
          <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
            <button
              onClick={() => setLanguage("en")}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer",
                currentLang === "en"
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage("es")}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer",
                currentLang === "es"
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              ES
            </button>
          </div>
        </section>

        {/* Theme Section */}
        <section className="rounded-xl glass p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
            {t("settings.theme")}
          </h2>
          <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
            <button
              onClick={() => {
                if (theme !== "dark") toggleTheme();
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer",
                theme === "dark"
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {t("settings.dark")}
            </button>
            <button
              onClick={() => {
                if (theme !== "light") toggleTheme();
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer",
                theme === "light"
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {t("settings.light")}
            </button>
          </div>
        </section>

        {/* Sound Section */}
        <section className="rounded-xl glass p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
            {t("settings.sound")}
          </h2>
          <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
            <button
              onClick={() => {
                if (muted) toggleMute();
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer",
                !muted
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {t("settings.soundOn")}
            </button>
            <button
              onClick={() => {
                if (!muted) toggleMute();
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer",
                muted
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {t("settings.soundOff")}
            </button>
          </div>
        </section>

        {/* Auto-Daub Section */}
        <section className="rounded-xl glass p-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
            {t("settings.autoDaub")}
          </h2>
          <div className="flex rounded-lg overflow-hidden border border-[var(--color-border)]">
            <button
              onClick={() => {
                if (!autoDaub) toggleAutoDaub();
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer",
                autoDaub
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {t("settings.soundOn")}
            </button>
            <button
              onClick={() => {
                if (autoDaub) toggleAutoDaub();
              }}
              className={cn(
                "flex-1 py-2.5 text-sm font-semibold transition-colors cursor-pointer",
                !autoDaub
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
            >
              {t("settings.soundOff")}
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            {t("settings.autoDaubDesc")}
          </p>
        </section>

        {/* About Section */}
        <section className="rounded-xl glass p-4">
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            {t("settings.about")} &mdash; Bingo Royale {t("settings.version")}
          </p>
        </section>
      </div>
    </div>
  );
}
