import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useRoomStore } from "@/stores/room-store";
import { generateRoomCode, cn } from "@/lib/utils";

export function Header() {
  const { t } = useTranslation(["common", "game"]);
  const room = useRoomStore((s) => s.room);
  const navigate = useNavigate();
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const [copied, setCopied] = useState(false);

  const goHome = useCallback(() => {
    if (room) {
      leaveRoom();
    }
    navigate({ to: "/" });
  }, [room, leaveRoom, navigate]);

  const copyRoomCode = useCallback(() => {
    if (!room) return;
    navigator.clipboard.writeText(room.code.toUpperCase()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [room]);

  return (
    <header className="sticky top-0 z-30 bg-[var(--color-bg-primary)]/70 backdrop-blur-xl border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 max-w-5xl mx-auto">
        {/* Logo - clickable to go home */}
        <button
          onClick={goHome}
          className="text-sm sm:text-lg font-extrabold tracking-tight text-gold hover:opacity-80 transition-opacity cursor-pointer"
        >
          {t("app.title")}
        </button>

        {/* Room controls - visible when in a room */}
        {room && (
          <div className="flex items-center gap-2">
            {/* Room code with copy */}
            <button
              onClick={copyRoomCode}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--color-bg-tertiary)] text-xs font-mono font-bold transition-colors cursor-pointer",
                copied
                  ? "text-[var(--color-accent)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]",
              )}
              title={copied ? t("actions.copied") : t("actions.copy")}
            >
              {generateRoomCode(room.code)}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>

            {/* Leave room button */}
            <button
              onClick={goHome}
              className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer"
              title={t("actions.close")}
              aria-label={t("actions.close")}
            >
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
