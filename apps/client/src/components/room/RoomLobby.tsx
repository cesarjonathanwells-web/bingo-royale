import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import type { Room, WinPattern } from "@bingo/shared";
import { SPEED_PRESETS, WIN_PATTERNS, MAX_CUSTOM_PATTERNS, isCustomPatternId } from "@bingo/shared";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PlayerList } from "./PlayerList";
import { PatternDisplay } from "@/components/bingo/PatternDisplay";
import { CreatePatternDialog } from "@/components/bingo/CreatePatternDialog";
import { useToast } from "@/components/ui/Toast";
import { generateRoomCode, cn } from "@/lib/utils";

const CARD_COUNT_OPTIONS = [1, 2, 3, 4];

interface RoomLobbyProps {
  room: Room;
}

export function RoomLobby({ room }: RoomLobbyProps) {
  const { t, i18n } = useTranslation("game");
  const user = useAuthStore((s) => s.user);
  const startGame = useRoomStore((s) => s.startGame);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const updateSettings = useRoomStore((s) => s.updateSettings);
  const cardCount = useRoomStore((s) => s.cardCount);
  const setCardCount = useRoomStore((s) => s.setCardCount);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleLeave = useCallback(() => {
    leaveRoom();
    navigate({ to: "/" });
  }, [leaveRoom, navigate]);

  const isHost = user?.id === room.hostId;
  const isEs = i18n.language === "es";
  const canStart = room.players.filter((p) => !p.isSpectator).length >= 1;

  const [showPatterns, setShowPatterns] = useState(false);

  const copyInviteLink = useCallback(async () => {
    const url = `${window.location.origin}/room/${room.code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("lobby.inviteCopied"), "success");
    } catch {
      toast(url, "info");
    }
  }, [room.code, t, toast]);

  const handleSpeedChange = useCallback(
    (speedId: string) => {
      const preset = SPEED_PRESETS.find((p) => p.id === speedId);
      if (preset) {
        updateSettings({ speed: preset.ms });
      }
    },
    [updateSettings],
  );

  const handlePlayerLimitChange = useCallback(
    (val: string) => {
      updateSettings({ playerLimit: parseInt(val, 10) });
    },
    [updateSettings],
  );

  // Track patterns locally to avoid race conditions on fast clicks
  const [localPatterns, setLocalPatterns] = useState<Set<string>>(
    () => new Set(room.patterns),
  );

  // Sync local patterns when server state arrives (if different)
  useEffect(() => {
    const serverSet = new Set(room.patterns);
    setLocalPatterns((prev) => {
      // Only update if server has different patterns (avoids overwriting optimistic state)
      if (prev.size !== serverSet.size || ![...prev].every((p) => serverSet.has(p))) {
        return serverSet;
      }
      return prev;
    });
  }, [room.patterns]);

  const togglePattern = useCallback(
    (patternId: string) => {
      setLocalPatterns((prev) => {
        const next = new Set(prev);
        if (next.has(patternId)) {
          next.delete(patternId);
        } else {
          next.add(patternId);
        }
        if (next.size > 0) {
          updateSettings({ patterns: Array.from(next) });
        }
        return next.size > 0 ? next : prev; // Don't allow empty
      });
    },
    [updateSettings],
  );

  const [showCreatePattern, setShowCreatePattern] = useState(false);

  const customPatterns = room.customPatterns ?? [];

  // All patterns: built-in + custom
  const allPatterns = useMemo<WinPattern[]>(
    () => [...WIN_PATTERNS, ...customPatterns],
    [customPatterns],
  );

  const handleSaveCustomPattern = useCallback(
    (pattern: WinPattern) => {
      const updatedCustom = [...customPatterns, pattern];
      const updatedActive = [...Array.from(localPatterns), pattern.id];
      setLocalPatterns(new Set(updatedActive));
      updateSettings({ customPatterns: updatedCustom, patterns: updatedActive });
      setShowCreatePattern(false);
    },
    [customPatterns, localPatterns, updateSettings],
  );

  const handleDeleteCustomPattern = useCallback(
    (patternId: string) => {
      const updatedCustom = customPatterns.filter((p) => p.id !== patternId);
      const updatedActive = Array.from(localPatterns).filter((id) => id !== patternId);
      setLocalPatterns(new Set(updatedActive.length > 0 ? updatedActive : localPatterns));
      updateSettings({
        customPatterns: updatedCustom,
        patterns: updatedActive.length > 0 ? updatedActive : Array.from(localPatterns),
      });
    },
    [customPatterns, localPatterns, updateSettings],
  );

  const currentSpeed = SPEED_PRESETS.find((p) => p.ms === room.speed);

  return (
    <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 w-full max-w-4xl mx-auto px-3 sm:p-4 animate-page-enter">
      {/* Left / Main */}
      <div className="flex-1 space-y-6">
        {/* Room Code */}
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-[0.2em]">
            {t("lobby.roomCode")}
          </p>
          <button
            onClick={copyInviteLink}
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl glass-card hover:shadow-lg transition-all duration-300 group"
          >
            <span className="text-3xl sm:text-4xl font-gaming tracking-[0.3em] sm:tracking-[0.4em] text-gold font-gaming">
              {generateRoomCode(room.code)}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t("lobby.copyInvite")}
          </p>
        </div>

        {/* Host Settings */}
        {isHost && (
          <div className="space-y-4 rounded-xl glass p-4">
            <h3 className="text-sm font-gaming tracking-wider text-gold">
              {t("lobby.settings")}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Variant (read-only after creation) */}
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("lobby.variant")}
                </label>
                <div className="px-3 py-2 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]">
                  {room.variant === "75"
                    ? t("home.variant75")
                    : t("home.variant90")}
                </div>
              </div>

              {/* Speed */}
              <Select
                label={t("lobby.speed")}
                value={currentSpeed?.id ?? "normal"}
                onValueChange={handleSpeedChange}
                options={SPEED_PRESETS.map((p) => ({
                  value: p.id,
                  label: isEs ? p.nameEs : p.name,
                }))}
              />

              {/* Player Limit */}
              <Select
                label={t("lobby.playerLimit")}
                value={String(room.playerLimit)}
                onValueChange={handlePlayerLimitChange}
                options={[10, 25, 50, 100, 200].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
              />
            </div>

            {/* Patterns (75-ball only) */}
            {room.variant === "75" && (
              <div>
                <button
                  onClick={() => setShowPatterns(!showPatterns)}
                  className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {t("lobby.patterns")}
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
                    className={cn(
                      "transition-transform",
                      showPatterns && "rotate-180",
                    )}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showPatterns && (
                  <div className="mt-3 flex flex-wrap gap-2 animate-slide-down">
                    {allPatterns.map((p) => {
                      const active = localPatterns.has(p.id);
                      const isCustom = isCustomPatternId(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePattern(p.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all inline-flex items-center gap-1.5",
                            active
                              ? "bg-[var(--color-accent)] text-white"
                              : "bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]",
                            isCustom && "border border-dashed border-[var(--color-accent)]/40",
                          )}
                        >
                          {isEs ? p.nameEs : p.name}
                          {isCustom && (
                            <span
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomPattern(p.id);
                              }}
                              className="ml-0.5 hover:text-red-400 transition-colors"
                            >
                              ×
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {customPatterns.length < MAX_CUSTOM_PATTERNS && (
                      <button
                        onClick={() => setShowCreatePattern(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border-2 border-dashed border-[var(--color-accent)]/40 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all"
                      >
                        + {t("lobby.createPattern")}
                      </button>
                    )}
                  </div>
                )}

                <CreatePatternDialog
                  open={showCreatePattern}
                  onOpenChange={setShowCreatePattern}
                  onSave={handleSaveCustomPattern}
                />

                {localPatterns.size > 0 && !showPatterns && (
                  <div className="mt-2">
                    <PatternDisplay patternIds={Array.from(localPatterns)} customPatterns={customPatterns} compact />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Non-host view */}
        {!isHost && (
          <div className="space-y-4">
            <div className="rounded-xl glass p-4 text-center">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("lobby.waitingForHost")}
              </p>
              <div className="mt-3 flex justify-center">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>

            {room.variant === "75" && localPatterns.size > 0 && (
              <PatternDisplay patternIds={Array.from(localPatterns)} customPatterns={customPatterns} />
            )}
          </div>
        )}

        {/* Card Count Selector (all players) */}
        <div className="rounded-xl glass p-4 space-y-3">
          <label className="block text-sm font-gaming tracking-wider text-gold">
            {t("cards.count")}
          </label>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t("cards.selectCount")}
          </p>
          <div className="flex gap-2">
            {CARD_COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCardCount(n)}
                className={cn(
                  "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-150 border cursor-pointer",
                  cardCount === n
                    ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-md "
                    : "bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-accent)]/30",
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {isHost && (
            <Button
              size="lg"
              onClick={startGame}
              disabled={!canStart}
              className="w-full text-lg"
            >
              {t("lobby.startGame")}
            </Button>
          )}
          {isHost && !canStart && (
            <p className="text-xs text-center text-[var(--color-text-muted)]">
              {t("lobby.needMorePlayers")}
            </p>
          )}
          <Button
            variant="ghost"
            size="md"
            onClick={handleLeave}
            className="w-full"
          >
            {t("lobby.leaveRoom")}
          </Button>
        </div>
      </div>

      {/* Right / Player list */}
      <div className="w-full lg:w-72 shrink-0 max-h-[40vh] lg:max-h-none overflow-hidden">
        <PlayerList players={room.players} />
      </div>
    </div>
  );
}
