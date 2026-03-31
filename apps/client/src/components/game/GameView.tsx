import { useCallback, useState } from "react";
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
import { BingoCard } from "@/components/bingo/BingoCard";
import { BingoCard90 } from "@/components/bingo/BingoCard90";
import { CardTabs } from "@/components/bingo/CardTabs";
import { CalledNumbers } from "@/components/bingo/CalledNumbers";
import { PatternDisplay } from "@/components/bingo/PatternDisplay";
import { PowerUpBar } from "@/components/bingo/PowerUpBar";
import { MultiCardView } from "@/components/bingo/MultiCardView";
import { PlayerList } from "@/components/room/PlayerList";
import { RoomChat } from "@/components/room/RoomChat";
import { EmojiBar } from "@/components/room/EmojiBar";
import { EmojiToast } from "@/components/room/EmojiToast";
import { Button } from "@/components/ui/Button";
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
  const [viewAll, setViewAll] = useState(myCards.length > 1);

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

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-2 sm:gap-3 px-1 sm:px-3 py-2 sm:py-3 max-w-6xl mx-auto w-full animate-page-enter">
      {/* Left: Called Numbers + Card */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Paused banner */}
        {gameState.paused && (
          <div className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-center">
            <span className="text-sm font-semibold text-amber-400">
              {t("game.paused")}
            </span>
          </div>
        )}

        {/* Called Numbers */}
        <CalledNumbers gameState={gameState} variant={room.variant} />

        {/* Active Pattern */}
        {room.variant === "75" && room.patterns.length > 0 && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">
              {t("game.activePattern")}:
            </span>
            <PatternDisplay patternIds={room.patterns} compact />
          </div>
        )}

        {/* View toggle for multi-card */}
        {myCards.length > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setViewAll(false)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-colors",
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
                "px-3 py-1 rounded-lg text-xs font-semibold transition-colors",
                viewAll
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]",
              )}
            >
              {t("cards.allView")}
            </button>
          </div>
        )}

        {/* Multi-card grid view */}
        {viewAll && myCards.length > 1 ? (
          <MultiCardView
            cards={myCards}
            dabs={myDabs}
            variant={room.variant}
            onDab={onDabMulti}
          />
        ) : (
          <>
            {/* Single card view with tabs */}
            {myCards.length > 1 && (
              <CardTabs
                count={myCards.length}
                activeIndex={activeCardIndex}
                onSelect={onSetActiveCard}
                dabs={myDabs}
              />
            )}
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
          </>
        )}

        {/* Power-Ups Bar */}
        {myPowerUps.length > 0 && (
          <PowerUpBar powerups={myPowerUps} onUse={handleUsePowerUp} />
        )}

        {/* Number Peek Overlay */}
        {peekedNumbers.length > 0 && (
          <div className="w-full max-w-[calc(100%-0.5rem)] sm:max-w-[400px] mx-auto px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-accent)]/40">
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

        {/* BINGO Button */}
        <button
          onClick={onClaimBingo}
          className={cn(
            "w-full max-w-[calc(100%-0.5rem)] sm:max-w-[400px] mx-auto py-4 sm:py-5 rounded-2xl",
            "text-2xl sm:text-3xl font-black tracking-wider text-white uppercase",
            "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500",
            "hover:from-amber-400 hover:via-orange-400 hover:to-red-400",
            "active:scale-[0.97] transition-all duration-150",
            "animate-bingo-glow",
            "select-none cursor-pointer",
            "border-t border-amber-300/30",
          )}
          style={{
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
        >
          {t("game.bingo")}
        </button>

        {/* Host controls */}
        {isHost && (
          <div className="flex justify-center gap-3">
            {gameState.paused ? (
              <Button variant="secondary" size="sm" onClick={onResumeGame}>
                {t("game.resume")}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={onPauseGame}>
                {t("game.pause")}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Right sidebar (desktop) */}
      <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3">
        <PlayerList players={room.players} className="hidden lg:block" />
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <RoomChat messages={chatMessages} onSend={onSendChat} />
          </div>
          <EmojiBar onSend={onSendReaction} />
        </div>
      </div>

      {/* Floating emoji reactions */}
      <EmojiToast reactions={reactions} />
    </div>
  );
}
