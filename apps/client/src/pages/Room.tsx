import { useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "@/stores/room-store";
import { useAuthStore } from "@/stores/auth-store";
import { useSound } from "@/hooks/useSound";
import { useBingoCaller } from "@/hooks/useBingoCaller";
import { useToast } from "@/components/ui/Toast";
import { RoomLobby } from "@/components/room/RoomLobby";
import { GameView } from "@/components/game/GameView";
import { GameFinished } from "@/components/game/GameFinished";
import { getSocket } from "@/socket";
import { Button } from "@/components/ui/Button";
import type { PowerUpId, PowerUpUseOptions } from "@bingo/shared";
import { POWER_UP_MAP, resolvePattern } from "@bingo/shared";

interface RoomPageProps {
  code: string;
}

export function Room({ code }: RoomPageProps) {
  const { t, i18n } = useTranslation("game");
  const room = useRoomStore((s) => s.room);
  const gameState = useRoomStore((s) => s.gameState);
  const myCards = useRoomStore((s) => s.myCards);
  const myDabs = useRoomStore((s) => s.myDabs);
  const activeCardIndex = useRoomStore((s) => s.activeCardIndex);
  const setActiveCard = useRoomStore((s) => s.setActiveCard);
  const chatMessages = useRoomStore((s) => s.chatMessages);
  const myPowerUps = useRoomStore((s) => s.myPowerUps);
  const peekedNumbers = useRoomStore((s) => s.peekedNumbers);
  const powerUpEffects = useRoomStore((s) => s.powerUpEffects);
  const powerUpCalledCount = useRoomStore((s) => s.powerUpCalledCount);
  const pendingPowerUp = useRoomStore((s) => s.pendingPowerUp);
  const callerChoices = useRoomStore((s) => s.callerChoices);
  const powerUpError = useRoomStore((s) => s.powerUpError);
  const socketReady = useRoomStore((s) => s.socketReady);
  const error = useRoomStore((s) => s.error);
  const isConnecting = useRoomStore((s) => s.isConnecting);
  const clearPowerUpPrompt = useRoomStore((s) => s.clearPowerUpPrompt);
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
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dabSnapshot = useRef<{
    key: string;
    marks: Set<number>[];
    active: boolean;
  } | null>(null);
  const lastDabSoundAt = useRef(-Infinity);

  const isHost = user?.id === room?.hostId;

  const handleLeave = useCallback(() => {
    // Clearing room state must not trigger the direct-link auto-join effect.
    joinAttempted.current = true;
    leaveRoom();
    navigate({ to: "/" });
  }, [leaveRoom, navigate]);

  // Auto-join room if navigated directly (only once)
  useEffect(() => {
    if (room?.code === code) {
      joinAttempted.current = true;
    }
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
    // React's development double-mount runs this cleanup and setup back to
    // back; cancelling the queued leave keeps the player in the room.
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      leaveTimer.current = setTimeout(() => {
        leaveTimer.current = null;
        joinAttempted.current = false;
        // If we still have a room after a real unmount, leave it
        if (useRoomStore.getState().room) leaveRoom();
      }, 0);
    };
  }, [leaveRoom]);

  // Preload voice call audio files when game is in progress
  useEffect(() => {
    if (room?.state === "in_progress" && room.variant) {
      const variant = room.variant === "90" ? "90" : "75";
      preloadCalls(variant as "75" | "90");
    }
  }, [room?.state, room?.variant, preloadCalls]);

  // Confirmed ink, including auto-daub and power-ups, gets one sound per batch.
  // Rebaseline on new cards/rounds or while inactive so reconnect snapshots and
  // already-marked cards never replay a whole board's worth of stamp sounds.
  useEffect(() => {
    const key = JSON.stringify([room?.code, gameState?.startedAt,
      myCards.map(card => [card.id, card.grid])]);
    const active = room?.state === "in_progress" && Boolean(gameState)
      && !gameState?.paused && socketReady;
    const previous = dabSnapshot.current;
    const marks = myCards.map((_, index) => new Set(myDabs[index] ?? []));
    dabSnapshot.current = { key, marks, active };
    if (!previous || previous.key !== key) {
      lastDabSoundAt.current = -Infinity;
      return;
    }
    if (!active || !previous.active || !myCards.length) return;
    const hasNewMark = marks.some((cardMarks, cardIndex) =>
      [...cardMarks].some(index => !previous.marks[cardIndex]?.has(index)),
    );
    const now = performance.now();
    // Several auto-daub acknowledgements can arrive in adjacent socket batches.
    if (hasNewMark && now - lastDabSoundAt.current >= 90) {
      lastDabSoundAt.current = now;
      play("cellDabbed");
    }
  }, [room?.code, room?.state, gameState?.startedAt, gameState?.paused,
    socketReady, myCards, myDabs, play]);

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
        // The server sends the pattern id; show its name in the player's language.
        const id = data.pattern ?? "";
        const custom = resolvePattern(id, useRoomStore.getState().room?.customPatterns);
        const pattern = id
          ? t(`patterns.${id}`, {
              defaultValue: custom ? (i18n.language.startsWith("es") ? custom.nameEs : custom.name) : id,
            })
          : "";
        toast(t("game.winnerAnnouncement", { name: data.playerName, pattern }), "success");
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
  }, [play, announce, toast, t, i18n.language, user?.id, room?.variant]);

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

    const handleBlocked = (data: { powerupId: string; byPlayer: string }) => toast(t("powerups.shieldBlocked", { powerup: t(`powerups.${data.powerupId}`), name: data.byPlayer }), "success");
    const handleScrambled = (data: { byPlayer: string; cardIndex: number }) => toast(t("powerups.scrambledCard", { name: data.byPlayer, n: data.cardIndex + 1 }), "info");
    const handleInk = (data: { byPlayer: string; cardIndex: number }) => toast(t("powerups.inkedCard", { name: data.byPlayer, n: data.cardIndex + 1 }), "info");
    socket.on("game:powerup_used", handlePowerUpUsed);
    socket.on("game:powerup_blocked", handleBlocked);
    socket.on("game:scrambled", handleScrambled);
    socket.on("game:ink_blot", handleInk);

    return () => {
      socket.off("game:powerup_used", handlePowerUpUsed);
      socket.off("game:powerup_blocked", handleBlocked);
      socket.off("game:scrambled", handleScrambled);
      socket.off("game:ink_blot", handleInk);
    };
  }, [toast, t]);

  const handleDab = useCallback(
    (cellIndex: number) => {
      dabCell(cellIndex);
    },
    [dabCell],
  );

  const handleDabMulti = useCallback((cardIndex: number, cellIndex: number) => {
    dabCell(cellIndex, cardIndex);
  }, [dabCell]);

  const handleUsePowerUp = useCallback((powerupId: PowerUpId, options?: PowerUpUseOptions) => {
    usePowerUp(powerupId, options);
  }, [usePowerUp]);

  // ---- State-based rendering ----

  const stateKey = !room ? "loading" : room.state;

  // Loading state
  if (!room) {
    return (
      <motion.div
        key="loading"
        className="flex-1 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="text-center space-y-3">
          {error && !isConnecting ? (
            <>
              <p role="alert" className="max-w-sm px-4 text-sm text-[var(--color-error)]">{t(error, { ns: "common", defaultValue: error })}</p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => joinRoom(code)}>{t("actions.retry", { ns: "common" })}</Button>
                <Button variant="secondary" onClick={handleLeave}>{t("actions.back", { ns: "common" })}</Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center"><div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" /></div>
              <p className="text-sm text-[var(--color-text-secondary)]">{t("actions.loading", { ns: "common" })}</p>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {/* Lobby */}
      {room.state === "lobby" && (
        <motion.div
          key="lobby"
          className="flex-1 flex flex-col py-4"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <RoomLobby room={room} onLeave={handleLeave} />
        </motion.div>
      )}

      {/* Finished */}
      {room.state === "finished" && gameState && (
        <motion.div
          key="finished"
          className="flex-1 flex flex-col"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <GameFinished
            gameState={gameState}
            customPatterns={room.customPatterns}
            isHost={isHost}
            onNewRound={newRound}
            onLeave={handleLeave}
          />
        </motion.div>
      )}

      {/* In Progress */}
      {room.state === "in_progress" && gameState && (
        <motion.div
          key="in_progress"
          className="flex-1 flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GameView
            room={room}
            gameState={gameState}
            myCards={myCards}
            myDabs={myDabs}
            activeCardIndex={activeCardIndex}
            myPowerUps={myPowerUps}
            peekedNumbers={peekedNumbers}
            powerUpEffects={powerUpEffects}
            powerUpCalledCount={powerUpCalledCount}
            pendingPowerUp={pendingPowerUp}
            callerChoices={callerChoices}
            powerUpError={powerUpError}
            powerupsDisabled={!socketReady}
            onClearPowerUpPrompt={clearPowerUpPrompt}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

