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
} from "@bingo/shared";
import { GAME_EMOJIS } from "@bingo/shared";
import { BingoCard } from "@/components/bingo/BingoCard";
import { BingoCard90 } from "@/components/bingo/BingoCard90";
import { CardTabs } from "@/components/bingo/CardTabs";
import { PatternDisplay } from "@/components/bingo/PatternDisplay";
import { MultiCardView } from "@/components/bingo/MultiCardView";
import { CardCarousel } from "@/components/bingo/CardCarousel";
import { EmojiToast } from "@/components/room/EmojiToast";
import { Button } from "@/components/ui/Button";
import { GameTopBar } from "@/components/layout/GameTopBar";
import { ActionBar } from "@/components/layout/ActionBar";
import { GameBottomBar } from "@/components/layout/GameBottomBar";
import { ChatDrawer } from "@/components/layout/ChatDrawer";
import { PlayerDrawer } from "@/components/layout/PlayerDrawer";
import { CalledNumbersDropdown } from "@/components/layout/CalledNumbersDropdown";
import { cn } from "@/lib/utils";

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
}: GameViewProps) {
  const { t } = useTranslation("game");
  const [chatOpen, setChatOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [numbersOpen, setNumbersOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [viewAll, setViewAll] = useState(myCards.length > 1);
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
    <div className="fixed inset-0 flex flex-col bg-[var(--color-bg-primary)]">
      {/* Top bar with current ball + room code */}
      <GameTopBar
        gameState={gameState}
        variant={room.variant}
        roomCode={room.code}
        onBallPress={() => setNumbersOpen(!numbersOpen)}
        onMenuPress={() => setPlayersOpen(true)}
      />

      {/* Called numbers dropdown */}
      <CalledNumbersDropdown
        open={numbersOpen}
        onClose={() => setNumbersOpen(false)}
        gameState={gameState}
        variant={room.variant}
      />

      {/* Card area - fills remaining space */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden px-2 py-1 relative">
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

        {/* View toggle for multi-card */}
        {myCards.length > 1 && (
          <div className="flex items-center justify-center gap-2 py-0.5 shrink-0">
            <button
              onClick={() => setViewAll(false)}
              className={cn(
                "px-3 py-0.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer",
                !viewAll
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]",
              )}
            >
              {t("cards.singleView")}
            </button>
            <button
              onClick={() => setViewAll(true)}
              className={cn(
                "px-3 py-0.5 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer",
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
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          {viewAll && myCards.length > 1 ? (
            <div className="w-full overflow-y-auto max-h-full px-1">
              <MultiCardView
                cards={myCards}
                dabs={myDabs}
                variant={room.variant}
                onDab={onDabMulti}
              />
            </div>
          ) : myCards.length > 1 ? (
            /* Swipeable carousel for multi-card single view */
            <CardCarousel
              cards={myCards}
              dabs={myDabs}
              variant={room.variant}
              onDab={onDabMulti}
              activeIndex={activeCardIndex}
              onIndexChange={onSetActiveCard}
            />
          ) : (
            <div className="w-full max-w-[400px]">
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
      </div>

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

      {/* Spacer for fixed BINGO button */}
      <div className="shrink-0" style={{ height: "52px" }} />

      {/* Fixed BINGO button */}
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
