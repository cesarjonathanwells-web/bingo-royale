import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GAME_EMOJIS } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface EmojiBarProps {
  onSend: (emoji: string) => void;
}

export function EmojiBar({ onSend }: EmojiBarProps) {
  const { t } = useTranslation("game");
  const [open, setOpen] = useState(false);

  const handleSend = useCallback(
    (emoji: string) => {
      onSend(emoji);
      setOpen(false);
    },
    [onSend],
  );

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-full",
          "bg-[var(--color-bg-secondary)] border border-[var(--color-border)]",
          "hover:bg-[var(--color-bg-tertiary)] transition-colors",
          "text-lg select-none cursor-pointer",
          open && "ring-2 ring-[var(--color-accent)]",
        )}
        title={t("reactions.title")}
        aria-label={t("reactions.title")}
      >
        {"\u{1F600}"}
      </button>

      {/* Emoji picker */}
      {open && (
        <div
          className={cn(
            "absolute bottom-12 left-1/2 -translate-x-1/2",
            "flex flex-wrap justify-center gap-1 p-2",
            "bg-[var(--color-bg-secondary)] border border-[var(--color-border)]",
            "rounded-xl shadow-xl",
            "max-w-[280px] w-max",
            "animate-slide-up z-50",
          )}
        >
          {GAME_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleSend(emoji)}
              className={cn(
                "w-10 h-10 flex items-center justify-center",
                "rounded-lg hover:bg-[var(--color-bg-tertiary)]",
                "transition-colors text-xl select-none cursor-pointer",
                "active:scale-90 transition-transform",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Backdrop to close */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
