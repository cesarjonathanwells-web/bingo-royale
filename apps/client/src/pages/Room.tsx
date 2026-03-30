import { useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useRoomStore } from "@/stores/room-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSound } from "@/hooks/useSound";
import { useToast } from "@/components/ui/Toast";
import { RoomLobby } from "@/components/room/RoomLobby";
import { BingoCard } from "@/components/bingo/BingoCard";
import { BingoCard90 } from "@/components/bingo/BingoCard90";
import { CalledNumbers } from "@/components/bingo/CalledNumbers";
import { PatternDisplay } from "@/components/bingo/PatternDisplay";
import { PlayerList } from "@/components/room/PlayerList";
import { RoomChat } from "@/components/room/RoomChat";
import { Button } from "@/components/ui/Button";
import { getSocket } from "@/socket";
import { cn } from "@/lib/utils";
import type {
  BingoCard75,
  BingoCard90 as BingoCard90Type,
} from "@bingo/shared";

interface RoomPageProps {
  code: string;
}

export function Room({ code }: RoomPageProps) {
  const { t } = useTranslation("game");
  const room = useRoomStore((s) => s.room);
  const gameState = useRoomStore((s) => s.gameState);
  const myCard = useRoomStore((s) => s.myCard);
  const myDabs = useRoomStore((s) => s.myDabs);
  const chatMessages = useRoomStore((s) => s.chatMessages);
  const dabCell = useRoomStore((s) => s.dabCell);
  const claimBingo = useRoomStore((s) => s.claimBingo);
  const pauseGame = useRoomStore((s) => s.pauseGame);
  const resumeGame = useRoomStore((s) => s.resumeGame);
  const sendChat = useRoomStore((s) => s.sendChat);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const joinRoom = useRoomStore((s) => s.joinRoom);
  const newRound = useRoomStore((s) => s.newRound);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { play } = useSound();
  const { toast } = useToast();
  const navigate = useNavigate();
  const joinAttempted = useRef(false);

  const isHost = user?.id === room?.hostId;

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

  const handleDab = useCallback(
    (cellIndex: number) => {
      play("cellDabbed");
      dabCell(cellIndex);
    },
    [dabCell, play],
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
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6">
        {/* Confetti-like decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: [
                  "#2563eb",
                  "#dc2626",
                  "#16a34a",
                  "#eab308",
                  "#6366f1",
                ][i % 5],
                animation: `confetti-fall ${2 + Math.random() * 3}s linear ${Math.random() * 2}s infinite`,
                opacity: 0.7,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 text-center space-y-4">
          <h2 className="text-4xl font-black text-[var(--color-ball-o)]">
            {t("game.gameOver")}
          </h2>

          {latestWinner ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
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

          <div className="flex flex-col gap-3 pt-4">
            {isHost && (
              <Button size="lg" onClick={newRound}>
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
    <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 max-w-6xl mx-auto w-full">
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

        {/* Bingo Card */}
        {myCard && (
          <>
            {room.variant === "75" ? (
              <BingoCard
                card={myCard as BingoCard75}
                dabs={myDabs}
                onDab={handleDab}
              />
            ) : (
              <BingoCard90
                card={myCard as BingoCard90Type}
                dabs={myDabs}
                onDab={handleDab}
              />
            )}
          </>
        )}

        {/* BINGO Button */}
        <button
          onClick={claimBingo}
          className={cn(
            "w-full max-w-[400px] mx-auto py-5 rounded-2xl",
            "text-3xl font-black tracking-wider text-white uppercase",
            "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500",
            "hover:from-amber-400 hover:via-orange-400 hover:to-red-400",
            "active:scale-95 transition-all duration-150",
            "shadow-xl shadow-orange-500/30",
            "select-none cursor-pointer",
          )}
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
        <RoomChat messages={chatMessages} onSend={sendChat} />
      </div>
    </div>
  );
}
