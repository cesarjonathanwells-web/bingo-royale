import { useEffect, useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useRoomStore } from "@/stores/room-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSound } from "@/hooks/useSound";
import { useToast } from "@/components/ui/Toast";
import { RoomLobby } from "@/components/room/RoomLobby";
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
import { getSocket } from "@/socket";
import { cn } from "@/lib/utils";
import type {
  BingoCard75,
  BingoCard90 as BingoCard90Type,
  PowerUpId,
} from "@bingo/shared";
import { POWER_UP_MAP } from "@bingo/shared";

interface RoomPageProps {
  code: string;
}

export function Room({ code }: RoomPageProps) {
  const { t } = useTranslation("game");
  const room = useRoomStore((s) => s.room);
  const gameState = useRoomStore((s) => s.gameState);
  const myCards = useRoomStore((s) => s.myCards);
  const myDabs = useRoomStore((s) => s.myDabs);
  const activeCardIndex = useRoomStore((s) => s.activeCardIndex);
  const setActiveCard = useRoomStore((s) => s.setActiveCard);
  const chatMessages = useRoomStore((s) => s.chatMessages);
  const myPowerUps = useRoomStore((s) => s.myPowerUps);
  const peekedNumbers = useRoomStore((s) => s.peekedNumbers);
  const dabCell = useRoomStore((s) => s.dabCell);
  const claimBingo = useRoomStore((s) => s.claimBingo);
  const pauseGame = useRoomStore((s) => s.pauseGame);
  const resumeGame = useRoomStore((s) => s.resumeGame);
  const sendChat = useRoomStore((s) => s.sendChat);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const newRound = useRoomStore((s) => s.newRound);
  const usePowerUp = useRoomStore((s) => s.usePowerUp);
  const reactions = useRoomStore((s) => s.reactions);
  const sendReaction = useRoomStore((s) => s.sendReaction);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { play } = useSound();
  const { toast } = useToast();
  const navigate = useNavigate();
  const joinAttempted = useRef(false);

  const isHost = user?.id === room?.hostId;
  const myCard = myCards.length > 0 ? (myCards[activeCardIndex] ?? myCards[0] ?? null) : null;
  const activeDabs = myDabs.length > 0 ? (myDabs[activeCardIndex] ?? myDabs[0] ?? new Set<number>()) : new Set<number>();
  const [viewAll, setViewAll] = useState(myCards.length > 1);

  const handleLeave = useCallback(() => {
    leaveRoom();
    navigate({ to: "/" });
  }, [leaveRoom, navigate]);

  // Auto-join room if navigated directly (only once)
  useEffect(() => {
    if (isAuthenticated && !room && code && !joinAttempted.current) {
      joinAttempted.current = true;
      joinRoom(code);
    }
  }, [isAuthenticated, room, code, joinRoom]);

  // Reset join attempt flag when leaving
  useEffect(() => {
    return () => {
      joinAttempted.current = false;
    };
  }, []);

  // Listen for sound-triggering events
  useEffect(() => {
    const socket = getSocket();

    const handleBingoClaimed = (data: {
      valid: boolean;
      playerId: string;
      playerName: string;
      pattern?: string;
    }) => {
      if (data.valid) {
        play("bingoWin");
        toast(
          t("game.winnerAnnouncement", {
            name: data.playerName,
            pattern: data.pattern ?? "",
          }),
          "success",
        );
      } else if (data.playerId === user?.id) {
        play("bingoInvalid");
        toast(t("game.bingoInvalid"), "error");
      }
    };

    const handleNumberCalled = () => {
      play("numberCalled");
    };

    socket.on("game:bingo_claimed", handleBingoClaimed);
    socket.on("game:number_called", handleNumberCalled);

    return () => {
      socket.off("game:bingo_claimed", handleBingoClaimed);
      socket.off("game:number_called", handleNumberCalled);
    };
  }, [play, toast, t, user?.id]);

  // Listen for power-up used events
  useEffect(() => {
    const socket = getSocket();

    const handlePowerUpUsed = (data: {
      playerId: string;
      playerName: string;
      powerupId: string;
    }) => {
      const def = POWER_UP_MAP[data.powerupId as PowerUpId];
      if (def) {
        toast(
          t("powerups.activated", {
            name: data.playerName,
            powerup: t(`powerups.${data.powerupId}`),
          }),
          "info",
        );
      }
    };

    socket.on("game:powerup_used", handlePowerUpUsed);

    return () => {
      socket.off("game:powerup_used", handlePowerUpUsed);
    };
  }, [toast, t]);

  const handleDab = useCallback(
    (cellIndex: number) => {
      play("cellDabbed");
      dabCell(cellIndex);
    },
    [dabCell, play],
  );

  // For multi-card view: dab on a specific card by index
  const handleDabMulti = useCallback(
    (cardIndex: number, cellIndex: number) => {
      play("cellDabbed");
      const state = useRoomStore.getState();
      const cardDabs = state.myDabs[cardIndex];
      if (!cardDabs || cardDabs.has(cellIndex)) return;

      const newCardDabs = new Set(cardDabs);
      newCardDabs.add(cellIndex);
      const newDabs = [...state.myDabs];
      newDabs[cardIndex] = newCardDabs;
      useRoomStore.setState({ myDabs: newDabs });

      const socket = getSocket();
      socket.emit("game:dab", { cellIndex, cardIndex });
    },
    [play],
  );

  const handleUsePowerUp = useCallback(
    (powerupId: PowerUpId) => {
      usePowerUp(powerupId);
    },
    [usePowerUp],
  );

  // Loading state
  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("actions.loading", { ns: "common" })}
          </p>
        </div>
      </div>
    );
  }

  // Lobby
  if (room.state === "lobby") {
    return <RoomLobby room={room} />;
  }

  // Finished
  if (room.state === "finished" && gameState) {
    const latestWinner = gameState.winners[gameState.winners.length - 1];
    const confettiShapes = ['rounded-full', 'rounded-sm', 'rounded-none'];
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6 relative">
        {/* Confetti decoration - more pieces, varied shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 40 }, (_, i) => (
            <div
              key={i}
              className={cn("absolute", confettiShapes[i % 3])}
              style={{
                left: `${Math.random() * 100}%`,
                width: `${6 + Math.random() * 10}px`,
                height: `${6 + Math.random() * 10}px`,
                backgroundColor: [
                  "#3b82f6",
                  "#ef4444",
                  "#22c55e",
                  "#f59e0b",
                  "#a78bfa",
                  "#ec4899",
                  "#06b6d4",
                ][i % 7],
                animation: `confetti-fall ${2.5 + Math.random() * 4}s linear ${Math.random() * 3}s infinite`,
                opacity: 0.8,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center space-y-5 animate-page-enter">
          <h2
            className="text-5xl sm:text-6xl font-black text-[var(--color-ball-o)] animate-winner-glow"
          >
            {t("game.gameOver")}
          </h2>

          {latestWinner ? (
            <div className="space-y-3">
              <p className="text-2xl sm:text-3xl font-extrabold text-[var(--color-text-primary)]">
                {t("game.winnerAnnouncement", {
                  name: latestWinner.playerName,
                  pattern: latestWinner.pattern,
                })}
              </p>
            </div>
          ) : (
            <p className="text-lg text-[var(--color-text-secondary)]">
              {t("game.noWinner")}
            </p>
          )}

          <p className="text-sm text-[var(--color-text-muted)]">
            {t("game.numbersCalled", {
              count: gameState.calledNumbers.length,
            })}
          </p>

          <div className="flex flex-col gap-3 pt-6">
            {isHost && (
              <Button size="lg" onClick={newRound} className="text-lg">
                {t("game.playAgain")}
              </Button>
            )}
            <Button variant="secondary" onClick={handleLeave}>
              {t("game.leaveGame")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // In Progress
  if (!gameState) return null;

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
            onDab={handleDabMulti}
          />
        ) : (
          <>
            {/* Single card view with tabs */}
            {myCards.length > 1 && (
              <CardTabs
                count={myCards.length}
                activeIndex={activeCardIndex}
                onSelect={setActiveCard}
                dabs={myDabs}
              />
            )}
            {myCard && (
              <>
                {room.variant === "75" ? (
                  <BingoCard
                    card={myCard as BingoCard75}
                    dabs={activeDabs}
                    onDab={handleDab}
                  />
                ) : (
                  <BingoCard90
                    card={myCard as BingoCard90Type}
                    dabs={activeDabs}
                    onDab={handleDab}
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
          onClick={claimBingo}
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
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
        >
          {t("game.bingo")}
        </button>

        {/* Host controls */}
        {isHost && (
          <div className="flex justify-center gap-3">
            {gameState.paused ? (
              <Button variant="secondary" size="sm" onClick={resumeGame}>
                {t("game.resume")}
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={pauseGame}>
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
            <RoomChat messages={chatMessages} onSend={sendChat} />
          </div>
          <EmojiBar onSend={sendReaction} />
        </div>
      </div>

      {/* Floating emoji reactions */}
      <EmojiToast reactions={reactions} />
    </div>
  );
}
