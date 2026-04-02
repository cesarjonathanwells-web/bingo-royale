import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage } from "@bingo/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface RoomChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  className?: string;
}

export function RoomChat({ messages, onSend, className }: RoomChatProps) {
  const { t } = useTranslation("game");
  const [input, setInput] = useState("");
  const [collapsed, setCollapsed] = useState(true);
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const prevLength = useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    if (messages.length > prevLength.current && collapsed) {
      setUnread((u) => u + (messages.length - prevLength.current));
    }
    prevLength.current = messages.length;
  }, [messages.length, collapsed]);

  const handleOpen = useCallback(() => {
    setCollapsed(false);
    setUnread(0);
  }, []);

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

  // Collapsed toggle for mobile
  if (collapsed) {
    return (
      <button
        onClick={handleOpen}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl",
          "bg-[var(--color-bg-secondary)] border border-[var(--color-border)]",
          "text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] transition-colors",
          className,
        )}
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
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {t("chat.title")}
        {unread > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold">
            {t("chat.unread", { count: unread })}
          </span>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] overflow-hidden",
        "h-[150px] sm:h-[200px] md:h-[300px] lg:h-[400px] max-h-[40vh]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("chat.title")}
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] transition-colors"
        >
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
            <polyline points="18 15 12 9 6 15" />
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
        className="flex items-center gap-2 px-3 py-2 border-t border-[var(--color-border)]"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="flex-1 bg-[var(--color-bg-primary)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none border border-[var(--color-border)] focus:border-[var(--color-accent)]"
          maxLength={200}
        />
        <Button type="submit" size="sm" disabled={!input.trim()}>
          {t("chat.send")}
        </Button>
      </form>
    </div>
  );
}
