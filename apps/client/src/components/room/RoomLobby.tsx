import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import type { Room } from "@bingo/shared";
import { SPEED_PRESETS, WIN_PATTERNS } from "@bingo/shared";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PlayerList } from "./PlayerList";
import { PatternDisplay } from "@/components/bingo/PatternDisplay";
import { useToast } from "@/components/ui/Toast";
import { generateRoomCode, cn } from "@/lib/utils";

interface RoomLobbyProps {
  room: Room;
}

export function RoomLobby({ room }: RoomLobbyProps) {
  const { t, i18n } = useTranslation("game");
  const user = useAuthStore((s) => s.user);
  const startGame = useRoomStore((s) => s.startGame);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const updateSettings = useRoomStore((s) => s.updateSettings);
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

  const togglePattern = useCallback(
    (patternId: string) => {
      const current = new Set(room.patterns);
      if (current.has(patternId)) {
        current.delete(patternId);
      } else {
        current.add(patternId);
      }
      if (current.size > 0) {
        updateSettings({ patterns: Array.from(current) });
      }
    },
    [room.patterns, updateSettings],
  );

  const currentSpeed = SPEED_PRESETS.find((p) => p.ms === room.speed);

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-4xl mx-auto p-4">
      {/* Left / Main */}
      <div className="flex-1 space-y-6">
        {/* Room Code */}
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t("lobby.roomCode")}
          </p>
          <button
            onClick={copyInviteLink}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] transition-colors group"
          >
            <span className="text-3xl font-mono font-extrabold tracking-[0.3em] text-[var(--color-text-primary)]">
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
          <div className="space-y-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
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
                    {WIN_PATTERNS.map((p) => {
                      const active = room.patterns.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => togglePattern(p.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                            active
                              ? "bg-[var(--color-accent)] text-white"
                              : "bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]",
                          )}
                        >
                          {isEs ? p.nameEs : p.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {room.patterns.length > 0 && !showPatterns && (
                  <div className="mt-2">
                    <PatternDisplay patternIds={room.patterns} compact />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Non-host view */}
        {!isHost && (
          <div className="space-y-4">
            <div className="rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 text-center">
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

            {room.variant === "75" && room.patterns.length > 0 && (
              <PatternDisplay patternIds={room.patterns} />
            )}
          </div>
        )}

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
      <div className="w-full lg:w-72 shrink-0">
        <PlayerList players={room.players} />
      </div>
    </div>
  );
}
