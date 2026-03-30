import { cn } from "@/lib/utils";

interface Reaction {
  emoji: string;
  playerName: string;
  id: string;
}

interface EmojiToastProps {
  reactions: Reaction[];
}

export function EmojiToast({ reactions }: EmojiToastProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center gap-2">
      {reactions.map((reaction) => (
        <div
          key={reaction.id}
          className={cn(
            "flex flex-col items-center animate-emoji-float",
            "pointer-events-none",
          )}
        >
          <span className="text-4xl">{reaction.emoji}</span>
          <span className="text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)]/80 px-2 py-0.5 rounded-full backdrop-blur-sm">
            {reaction.playerName}
          </span>
        </div>
      ))}
    </div>
  );
}
