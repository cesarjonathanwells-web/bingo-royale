import { useState, useRef, useEffect, useCallback, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "@bingo/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
}

export function ChatDrawer({ open, onClose, messages, onSend }: ChatDrawerProps) {
  const { t } = useTranslation("game");
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current && open) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, open]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (input.trim()) {
        onSend(input.trim());
        setInput("");
      }
    },
    [input, onSend],
  );

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="drawer-overlay animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Chat panel */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-35",
          "flex flex-col",
          "glass-strong",
          "rounded-t-2xl",
          "animate-slide-in-up",
        )}
        style={{ height: "60%", zIndex: 35 }}
      >
        {/* Drag handle */}
        <div className="flex items-center justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border-light)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--color-border)] shrink-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("chat.title")}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] transition-colors cursor-pointer"
            aria-label={t("actions.close", { ns: "common" })}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
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

        {/* Messages */}
        <div
          ref={listRef}
          role="log"
          aria-live="polite"
          className="flex-1 overflow-y-auto px-4 py-2 space-y-2"
        >
          {messages.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] text-center py-4">
              ...
            </p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="animate-fade-in">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-[var(--color-accent)]">
                    {msg.playerName}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-primary)] break-words">
                  {msg.text}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 px-3 py-2 border-t border-[var(--color-border)] shrink-0 safe-bottom"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("chat.placeholder")}
            className="flex-1 bg-[var(--color-bg-primary)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none border border-[var(--color-border)] focus:border-[var(--color-accent)]"
            maxLength={200}
            autoFocus
          />
          <Button type="submit" size="sm" disabled={!input.trim()}>
            {t("chat.send")}
          </Button>
        </form>
      </div>
    </>
  );
}
