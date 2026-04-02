import { useState, useCallback, useMemo, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { BingoVariant } from "@bingo/shared";

/* ------------------------------------------------------------------ */
/*  Floating particle config — generated once per mount               */
/* ------------------------------------------------------------------ */
function useParticles(count: number) {
  return useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 3 + 1,
      delay: `${Math.random() * 8}s`,
      duration: `${6 + Math.random() * 8}s`,
      opacity: Math.random() * 0.5 + 0.15,
    }));
  }, [count]);
}

export function Home() {
  const { t, i18n } = useTranslation();
  const { user, isAuthenticated, isLoading, loginAsGuest, logout } =
    useAuthStore();
  const { createRoom, joinRoom, isConnecting } = useRoomStore();
  const { toast } = useToast();

  const [guestName, setGuestName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [variant, setVariant] = useState<BingoVariant>("75");
  const [roomCode, setRoomCode] = useState("");

  const particles = useParticles(25);

  const handleGuest = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const name = guestName.trim();
      if (name.length < 2) {
        toast(t("errors.nameTooShort"), "error");
        return;
      }
      try {
        await loginAsGuest(name, i18n.language as "en" | "es");
      } catch {
        const storeError = useAuthStore.getState().error;
        toast(storeError ?? t("errors.generic"), "error");
      }
    },
    [guestName, loginAsGuest, i18n.language, t, toast],
  );

  const handleCreateRoom = useCallback(() => {
    createRoom(variant);
    setShowCreate(false);
  }, [createRoom, variant]);

  const handleJoinRoom = useCallback(() => {
    const code = roomCode.trim().replace(/-/g, "").toUpperCase();
    if (code.length < 6 || !/^[A-Z0-9]+$/.test(code)) {
      toast(t("errors.invalidRoom"), "error");
      return;
    }
    joinRoom(code);
    setShowJoin(false);
  }, [joinRoom, roomCode, t, toast]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 pb-24 bg-gradient-game relative overflow-hidden">
      {/* ── Decorative background orbs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-[var(--color-ball-b)]/8 blur-3xl animate-pulse"
          style={{ animationDuration: "6s" }}
        />
        <div
          className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-[var(--color-ball-o)]/8 blur-3xl animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full bg-[var(--color-ball-i)]/6 blur-3xl animate-pulse"
          style={{ animationDuration: "7s" }}
        />
        <div
          className="absolute bottom-1/3 left-1/5 w-56 h-56 rounded-full bg-[var(--color-ball-g)]/5 blur-3xl animate-pulse"
          style={{ animationDuration: "9s" }}
        />
      </div>

      {/* ── Main content ── */}
      <div className="relative z-10 w-full max-w-md space-y-10 animate-page-enter">
        {/* ── Title ── */}
        <div className="text-center space-y-4">
          <h1 className="font-gaming tracking-tight leading-none">
            <span
              className="text-gold block text-7xl sm:text-8xl lg:text-9xl drop-shadow-lg"
              style={{
                filter: "drop-shadow(0 4px 30px rgba(255, 215, 0, 0.4))",
              }}
            >
              BINGO
            </span>
            <span
              className="block text-4xl sm:text-5xl lg:text-6xl tracking-[0.25em] mt-1"
              style={{
                color: "transparent",
                WebkitTextStroke: "1.5px rgba(212, 162, 76, 0.7)",
              }}
            >
              ROYALE
            </span>
          </h1>

          <p className="text-sm sm:text-base text-neon-purple font-medium tracking-widest uppercase">
            The Ultimate Multiplayer Bingo Experience
          </p>
        </div>

        {/* ── Decorative bingo balls ── */}
        <div className="flex justify-center gap-4 rounded-full py-2">
          {[
            { n: 7, c: "#3b82f6", l: "B" },
            { n: 22, c: "#ef4444", l: "I" },
            { n: 38, c: "#a78bfa", l: "N" },
            { n: 51, c: "#22c55e", l: "G" },
            { n: 65, c: "#f59e0b", l: "O" },
          ].map(({ n, c, l }, idx) => (
            <div
              key={n}
              className="relative"
              style={{
                animation: `particle-float ${4 + idx * 0.6}s ease-in-out infinite`,
                animationDelay: `${idx * 0.3}s`,
              }}
            >
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-transform duration-300 hover:scale-110"
                style={{
                  background: `radial-gradient(circle at 30% 25%, ${c}ff, ${c} 60%, ${c}99 100%)`,
                  boxShadow: `0 4px 15px ${c}66, 0 0 25px ${c}33, inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)`,
                }}
              >
                <div
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex flex-col items-center justify-center"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, #ffffff, #f0f0f0 70%, #e0e0e0 100%)",
                  }}
                >
                  <span
                    style={{
                      color: c,
                      fontSize: "7px",
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    {l}
                  </span>
                  <span
                    style={{
                      color: "#0f1330",
                      fontSize: "13px",
                      fontWeight: 800,
                      lineHeight: 1,
                    }}
                  >
                    {n}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Auth / Name section ── */}
        {!isAuthenticated ? (
          <form onSubmit={handleGuest} className="space-y-5">
            <Input
              label={t("auth.guestName")}
              placeholder={t("auth.guestNamePlaceholder")}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              maxLength={20}
            />
            <Button
              type="submit"
              size="lg"
              loading={isLoading}
              className="w-full"
            >
              {t("auth.playAsGuest")}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Current player */}
            <div className="flex items-center justify-between px-5 py-4 rounded-2xl glass neon-border-purple">
              <div>
                <p className="text-xs text-[var(--color-text-muted)] tracking-wide uppercase">
                  {t("auth.orContinueAs")}
                </p>
                <p className="text-base font-bold text-gold mt-0.5">
                  {user?.name}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={logout}>
                {t("auth.logout")}
              </Button>
            </div>

            {/* Room actions */}
            <div className="grid grid-cols-2 gap-4">
              {/* Create Room button */}
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => setShowCreate(true)}
                className="glass-card rounded-2xl px-4 py-5 flex flex-col items-center gap-3 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 group cursor-pointer"
                style={{
                  boxShadow:
                    "0 0 15px rgba(168,85,247,0.1), 0 4px 20px rgba(0,0,0,0.2)",
                }}
              >
                {/* Dice icon */}
                <svg
                  className="w-8 h-8 text-neon-gold transition-transform duration-300 group-hover:rotate-12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="3" />
                  <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                  <circle cx="16" cy="8" r="1.2" fill="currentColor" />
                  <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                  <circle cx="8" cy="16" r="1.2" fill="currentColor" />
                  <circle cx="16" cy="16" r="1.2" fill="currentColor" />
                </svg>
                <span className="text-sm font-bold text-gold tracking-wide">
                  {t("home.createRoom", { ns: "game" })}
                </span>
              </button>

              {/* Join Room button */}
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => setShowJoin(true)}
                className="glass-card rounded-2xl px-4 py-5 flex flex-col items-center gap-3 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 group cursor-pointer"
                style={{
                  boxShadow:
                    "0 0 15px rgba(168,85,247,0.1), 0 4px 20px rgba(0,0,0,0.2)",
                }}
              >
                {/* Door / enter icon */}
                <svg
                  className="w-8 h-8 text-neon-gold transition-transform duration-300 group-hover:translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span className="text-sm font-bold text-gold tracking-wide">
                  {t("home.joinRoom", { ns: "game" })}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Room Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent title={t("home.createRoomTitle", { ns: "game" })}>
          <div className="space-y-4 mt-4">
            <Select
              label={t("home.selectVariant", { ns: "game" })}
              value={variant}
              onValueChange={(v) => setVariant(v as BingoVariant)}
              options={[
                {
                  value: "75",
                  label: t("home.variant75", { ns: "game" }),
                },
                {
                  value: "90",
                  label: t("home.variant90", { ns: "game" }),
                },
              ]}
            />
            <Button
              size="lg"
              onClick={handleCreateRoom}
              loading={isConnecting}
              className="w-full"
            >
              {t("home.createRoom", { ns: "game" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Join Room Dialog ── */}
      <Dialog open={showJoin} onOpenChange={setShowJoin}>
        <DialogContent title={t("home.joinRoomTitle", { ns: "game" })}>
          <div className="space-y-4 mt-4">
            <Input
              label={t("home.enterRoomCode", { ns: "game" })}
              placeholder={t("home.roomCodePlaceholder", { ns: "game" })}
              value={roomCode}
              onChange={(e) =>
                setRoomCode(e.target.value.toUpperCase().slice(0, 7))
              }
              maxLength={7}
              className="font-mono text-center text-lg tracking-widest uppercase"
            />
            <Button
              size="lg"
              onClick={handleJoinRoom}
              loading={isConnecting}
              disabled={roomCode.replace(/-/g, "").length < 6}
              className="w-full"
            >
              {t("home.joinRoom", { ns: "game" })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
