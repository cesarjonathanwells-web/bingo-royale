import { useCallback, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type {
  Room,
  GameState,
  BingoCard as BingoCardType,
  BingoCard75,
  BingoCard90 as BingoCard90Type,
  PlayerPowerUp,
  PowerUpId,
  ChatMessage,
  Player,
} from "@bingo/shared";
import { GAME_EMOJIS } from "@bingo/shared";
import { BingoCard } from "@/components/bingo/BingoCard";
import { BingoCard90 } from "@/components/bingo/BingoCard90";
import { PatternDisplay } from "@/components/bingo/PatternDisplay";
import { CardCarousel } from "@/components/bingo/CardCarousel";
import { EmojiToast } from "@/components/room/EmojiToast";
import { Button } from "@/components/ui/Button";
import { GameTopBar } from "@/components/layout/GameTopBar";
import { BallCallStrip } from "@/components/bingo/BallCallStrip";
import { ActionBar } from "@/components/layout/ActionBar";
import { GameBottomBar } from "@/components/layout/GameBottomBar";
import { ChatDrawer } from "@/components/layout/ChatDrawer";
import { PlayerDrawer } from "@/components/layout/PlayerDrawer";
import { CalledNumbersDropdown } from "@/components/layout/CalledNumbersDropdown";
import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/lib/avatar";
import { getCardLayout } from "@/lib/card-layout";

interface EmojiReaction {
  emoji: string;
  playerName: string;
  id: string;
}

interface GameViewProps {
  room: Room;
  gameState: GameState;
  myCards: BingoCardType[];
  myDabs: Set<number>[];
  activeCardIndex: number;
  myPowerUps: PlayerPowerUp[];
  peekedNumbers: number[];
  chatMessages: ChatMessage[];
  reactions: EmojiReaction[];
  isHost: boolean;
  onSetActiveCard: (index: number) => void;
  onDab: (cellIndex: number) => void;
  onDabMulti: (cardIndex: number, cellIndex: number) => void;
  onClaimBingo: () => void;
  onPauseGame: () => void;
  onResumeGame: () => void;
  onUsePowerUp: (id: PowerUpId) => void;
  onSendChat: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onLeave: () => void;
}

export function GameView({
  room,
  gameState,
  myCards,
  myDabs,
  activeCardIndex,
  myPowerUps,
  peekedNumbers,
  chatMessages,
  reactions,
  isHost,
  onSetActiveCard,
  onDab,
  onDabMulti,
  onClaimBingo,
  onPauseGame,
  onResumeGame,
  onUsePowerUp,
  onSendChat,
  onSendReaction,
  onLeave,
}: GameViewProps) {
  const { t } = useTranslation("game");

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridLayout, setGridLayout] = useState({ columns: 1, maxWidth: 420 });

  useEffect(() => {
    const element = gridContainerRef.current;
    if (!element) return;
    const calculate = () => {
      // clientWidth/clientHeight include padding; measure the usable card area.
      const style = getComputedStyle(element);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      if (width <= 0 || height <= 0) return;
      const headerHeight = window.matchMedia("(min-width: 1024px)").matches ? 52
        : window.matchMedia("(min-width: 640px)").matches ? 42 : 34;
      const next = getCardLayout({ width, height, count: myCards.length, variant: room.variant, headerHeight });
      setGridLayout(previous => previous.columns === next.columns && Math.abs(previous.maxWidth - next.maxWidth) < 1
        ? previous : next);
    };
    const observer = new ResizeObserver(calculate);
    observer.observe(element);
    calculate();
    return () => observer.disconnect();
  }, [myCards.length, room.variant]);

  const [viewAll, setViewAll] = useState(myCards.length > 1);
  useEffect(() => {
    gridContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [viewAll]);

  const [chatOpen, setChatOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [numbersOpen, setNumbersOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const prevChatLength = useRef(chatMessages.length);

  // Track unread chat messages
  useEffect(() => {
    if (chatMessages.length > prevChatLength.current && !chatOpen) {
      setUnreadChat((u) => u + (chatMessages.length - prevChatLength.current));
    }
    prevChatLength.current = chatMessages.length;
  }, [chatMessages.length, chatOpen]);

  // Clear unread when chat opens
  useEffect(() => {
    if (chatOpen) {
      setUnreadChat(0);
    }
  }, [chatOpen]);

  const myCard =
    myCards.length > 0 ? (myCards[activeCardIndex] ?? myCards[0] ?? null) : null;
  const activeDabs =
    myDabs.length > 0
      ? (myDabs[activeCardIndex] ?? myDabs[0] ?? new Set<number>())
      : new Set<number>();

  const handleUsePowerUp = useCallback(
    (powerupId: PowerUpId) => {
      onUsePowerUp(powerupId);
    },
    [onUsePowerUp],
  );

  const handleEmojiSend = useCallback(
    (emoji: string) => {
      onSendReaction(emoji);
      setEmojiOpen(false);
    },
    [onSendReaction],
  );

  return (
    <div className="fixed inset-0 h-[100dvh] flex flex-col min-h-0 bg-[var(--color-bg-primary)]" style={{ paddingTop: "env(safe-area-inset-top)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      {/* Top bar with room code + controls */}
      <GameTopBar
        gameState={gameState}
        variant={room.variant}
        roomCode={room.code}
        onMenuPress={() => setPlayersOpen(true)}
        onLeave={onLeave}
      />

      {/* Ball call strip: current ball (25% larger) + last 3 called */}
      <BallCallStrip
        gameState={gameState}
        variant={room.variant}
        onPress={() => setNumbersOpen(!numbersOpen)}
      />

      {/* Called numbers dropdown */}
      <CalledNumbersDropdown
        open={numbersOpen}
        onClose={() => setNumbersOpen(false)}
        gameState={gameState}
        variant={room.variant}
      />

      {/* Main area: on desktop, card left + sidebar right. On mobile, card only */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Card column */}
        <div className="flex-1 min-w-0 min-h-0 flex flex-col items-center overflow-hidden px-2 py-1 relative">
        {/* Paused overlay */}
        {gameState.paused && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--color-bg-primary)]/80 backdrop-blur-sm">
            <div className="px-6 py-4 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-center">
              <span className="text-lg font-semibold text-amber-400">
                {t("game.paused")}
              </span>
              {isHost && (
                <div className="mt-3">
                  <Button variant="secondary" size="sm" onClick={onResumeGame}>
                    {t("game.resume")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active Pattern */}
        {room.variant === "75" && room.patterns.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-0.5 shrink-0">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {t("game.activePattern")}:
            </span>
            <PatternDisplay patternIds={room.patterns} compact />
          </div>
        )}

        {/* View toggle */}
        {myCards.length > 1 && (
          <div className="flex items-center justify-center gap-1 py-0.5 shrink-0">
            <button
              aria-pressed={!viewAll}
              onClick={() => setViewAll(false)}
              className={cn(
                "min-h-11 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                !viewAll
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]",
              )}
            >
              {t("cards.singleView")}
            </button>
            <button
              aria-pressed={viewAll}
              onClick={() => setViewAll(true)}
              className={cn(
                "min-h-11 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                viewAll
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]",
              )}
            >
              {t("cards.allView")}
            </button>
          </div>
        )}

        {/* Card display */}
        <div ref={gridContainerRef} className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
          {viewAll && myCards.length > 1 ? (
            <div
              className="grid gap-1 w-full mx-auto items-start"
              style={{ gridTemplateColumns: `repeat(${gridLayout.columns}, minmax(0, 1fr))`, maxWidth: `${gridLayout.maxWidth}px` }}
            >
              {myCards.map((card, ci) => (
                <section key={card.id} aria-label={t("cards.card", { n: ci + 1 })}
                  className="min-w-0 w-full"
                  style={myCards.length === 3 && ci === 2 && gridLayout.columns === 2
                    ? { gridColumn: "1 / -1", width: "calc((100% - 0.25rem) / 2)", justifySelf: "center" } : undefined}>
                  <button type="button" className="w-full min-h-7 mb-0.5 text-xs font-semibold text-[var(--color-text-secondary)] cursor-pointer"
                    aria-label={t("cards.enlarge", { n: ci + 1 })}
                    onClick={() => { onSetActiveCard(ci); setViewAll(false); }}>
                    {t("cards.card", { n: ci + 1 })} <span aria-hidden="true">↗</span>
                  </button>
                  {room.variant === "75" ? (
                    <BingoCard
                      card={card as BingoCard75}
                      dabs={myDabs[ci] ?? new Set()}
                      onDab={(cellIndex) => onDabMulti(ci, cellIndex)}
                    />
                  ) : (
                    <BingoCard90
                      card={card as BingoCard90Type}
                      dabs={myDabs[ci] ?? new Set()}
                      onDab={(cellIndex) => onDabMulti(ci, cellIndex)}
                    />
                  )}
                </section>
              ))}
            </div>
          ) : myCards.length > 1 ? (
            <CardCarousel
              cards={myCards}
              dabs={myDabs}
              variant={room.variant}
              onDab={onDabMulti}
              activeIndex={activeCardIndex}
              onIndexChange={onSetActiveCard}
            />
          ) : (
            <div style={{ maxWidth: `${Math.min(gridLayout.maxWidth, 420)}px` }} className="w-full mx-auto">
              {myCard && (
                <>
                  {room.variant === "75" ? (
                    <BingoCard
                      card={myCard as BingoCard75}
                      dabs={activeDabs}
                      onDab={onDab}
                    />
                  ) : (
                    <BingoCard90
                      card={myCard as BingoCard90Type}
                      dabs={activeDabs}
                      onDab={onDab}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Number Peek Overlay */}
        {peekedNumbers.length > 0 && (
          <div className="absolute top-2 left-2 right-2 z-10 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-accent)]/40 shadow-lg">
            <p className="text-xs font-semibold text-[var(--color-accent)] text-center mb-1">
              {t("powerups.number_peek")}
            </p>
            <div className="flex justify-center gap-3">
              {peekedNumbers.map((num) => (
                <span
                  key={num}
                  className="text-lg font-bold text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] rounded-lg px-3 py-1"
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Host pause control (floating, subtle) */}
        {isHost && !gameState.paused && (
          <div className="absolute top-1 right-2 z-10">
            <Button variant="ghost" size="sm" onClick={onPauseGame} className="text-[10px] px-2 py-0.5 opacity-60 hover:opacity-100">
              {t("game.pause")}
            </Button>
          </div>
        )}
        </div>{/* end card column */}

        {/* Desktop sidebar - visible on lg+ */}
        <div className="hidden lg:flex flex-col w-80 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
          {/* Player list */}
          <div className="border-b border-[var(--color-border)] overflow-y-auto max-h-[40%]">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-gaming tracking-wider text-gold">
                {t("game.players")} ({room.players.length})
              </h3>
            </div>
            <ul className="divide-y divide-[var(--color-border)]/30">
              {room.players.map((player) => (
                <li key={player.id} className="flex items-center gap-2 px-4 py-2">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white",
                      !player.connected && "opacity-40",
                    )}
                    style={{ backgroundColor: getAvatarColor(player.name) }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={cn(
                    "text-sm font-medium truncate",
                    player.connected ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]",
                  )}>
                    {player.name}
                  </span>
                  {player.isHost && (
                    <span className="text-[10px] text-amber-400 font-bold shrink-0">★</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Chat - fills remaining space */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-gaming tracking-wider text-gold">
                {t("game.chat")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2" role="log" aria-live="polite">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-4">...</p>
              ) : (
                chatMessages.slice(-30).map((msg) => (
                  <div key={msg.id} className="flex gap-2 text-sm">
                    <span className="font-semibold text-[var(--color-accent)] shrink-0">{msg.playerName}:</span>
                    <span className="text-[var(--color-text-secondary)] break-words min-w-0">{msg.text}</span>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector("input");
                if (input && input.value.trim()) {
                  onSendChat(input.value.trim());
                  input.value = "";
                }
              }}
              className="flex gap-2 px-4 py-3 border-t border-[var(--color-border)]"
            >
              <input
                type="text"
                maxLength={200}
                placeholder={t("chat.placeholder")}
                className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 cursor-pointer"
              >
                {t("chat.send")}
              </button>
            </form>
          </div>
        </div>
      </div>{/* end main area flex row */}

      {/* Action bar */}
      <ActionBar
        powerups={myPowerUps}
        onUsePowerUp={handleUsePowerUp}
        onToggleChat={() => setChatOpen(!chatOpen)}
        onToggleEmoji={() => setEmojiOpen(!emojiOpen)}
        onTogglePlayers={() => setPlayersOpen(true)}
        unreadChat={unreadChat}
        chatOpen={chatOpen}
      />

      {/* BINGO button (in-flow, not fixed) */}
      <GameBottomBar onClaim={onClaimBingo} />

      {/* Emoji picker overlay */}
      {emojiOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setEmojiOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              "fixed bottom-[100px] left-1/2 -translate-x-1/2",
              "flex flex-wrap justify-center gap-1 p-2",
              "bg-[var(--color-bg-secondary)] border border-[var(--color-border)]",
              "rounded-xl shadow-xl",
              "max-w-[calc(100vw-2rem)] w-max",
              "animate-slide-in-up",
            )}
            style={{ zIndex: 35 }}
          >
            {GAME_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSend(emoji)}
                className={cn(
                  "w-10 h-10 flex items-center justify-center",
                  "rounded-lg hover:bg-[var(--color-bg-tertiary)]",
                  "transition-colors text-xl select-none cursor-pointer",
                  "active:scale-90",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Chat drawer */}
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSend={onSendChat}
      />

      {/* Player drawer */}
      <PlayerDrawer
        open={playersOpen}
        onClose={() => setPlayersOpen(false)}
        players={room.players}
        roomCode={room.code}
      />

      {/* Floating emoji reactions */}
      <EmojiToast reactions={reactions} />
    </div>
  );
}

