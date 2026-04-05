import { useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useRoomStore } from "@/stores/room-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSound } from "@/hooks/useSound";
import { useBingoCaller } from "@/hooks/useBingoCaller";
import { useToast } from "@/components/ui/Toast";
import { RoomLobby } from "@/components/room/RoomLobby";
import { GameView } from "@/components/game/GameView";
import { GameFinished } from "@/components/game/GameFinished";
import { getSocket } from "@/socket";
import type { PowerUpId } from "@bingo/shared";
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
  const { announce, preload: preloadCalls } = useBingoCaller();
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

  // Clean up room on unmount (back button, navigation away) and beforeunload (tab close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const socket = getSocket();
      socket.emit("room:leave");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      joinAttempted.current = false;
      // If we still have a room when unmounting, leave it
      const currentRoom = useRoomStore.getState().room;
      if (currentRoom) {
        leaveRoom();
      }
    };
  }, [leaveRoom]);

  // Preload voice call audio files when game is in progress
  useEffect(() => {
    if (room?.state === "in_progress" && room.variant) {
      const variant = room.variant === "90" ? "90" : "75";
      preloadCalls(variant as "75" | "90");
    }
  }, [room?.state, room?.variant, preloadCalls]);

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

    const handleNumberCalled = (data: {
      number: number;
      letter?: string;
    }) => {
      play("numberCalled");
      const variant = room?.variant === "90" ? "90" : "75";
      announce(data.number, variant as "75" | "90");
    };

    socket.on("game:bingo_claimed", handleBingoClaimed);
    socket.on("game:number_called", handleNumberCalled);

    return () => {
      socket.off("game:bingo_claimed", handleBingoClaimed);
      socket.off("game:number_called", handleNumberCalled);
    };
  }, [play, announce, toast, t, user?.id, room?.variant]);

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
      const state = useRoomStore.getState();
      const cardDabs = state.myDabs[cardIndex];
      if (!cardDabs || cardDabs.has(cellIndex)) return;

      // Only allow dabbing numbers that have been called
      const card = state.myCards[cardIndex];
      if (card && state.gameState && state.room) {
        const cols = state.room.variant === "75" ? 5 : 9;
        const col = cellIndex % cols;
        const row = Math.floor(cellIndex / cols);
        const value = card.grid[col]?.[row] ?? null;
        if (value !== null && !state.gameState.calledNumbers.includes(value)) return;
      }

      play("cellDabbed");
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

  // ---- State-based rendering ----

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
    return (
      <GameFinished
        gameState={gameState}
        customPatterns={room.customPatterns}
        isHost={isHost}
        onNewRound={newRound}
        onLeave={handleLeave}
      />
    );
  }

  // In Progress
  if (!gameState) return null;

  return (
    <GameView
      room={room}
      gameState={gameState}
      myCards={myCards}
      myDabs={myDabs}
      activeCardIndex={activeCardIndex}
      myPowerUps={myPowerUps}
      peekedNumbers={peekedNumbers}
      chatMessages={chatMessages}
      reactions={reactions}
      isHost={isHost}
      onSetActiveCard={setActiveCard}
      onDab={handleDab}
      onDabMulti={handleDabMulti}
      onClaimBingo={claimBingo}
      onPauseGame={pauseGame}
      onResumeGame={resumeGame}
      onUsePowerUp={handleUsePowerUp}
      onSendChat={sendChat}
      onSendReaction={sendReaction}
      onLeave={handleLeave}
    />
  );
}
