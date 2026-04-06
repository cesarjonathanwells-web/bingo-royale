import { useState, useCallback, useMemo, lazy, Suspense, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { PageTransition, StaggerContainer, StaggerItem } from "@/components/fx/PageTransition";
import type { BingoVariant } from "@bingo/shared";

const BingoBallScene = lazy(() =>
  import("@/components/3d/BingoBallScene").then((m) => ({ default: m.BingoBallScene })),
);

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
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 sm:py-6 pb-20 sm:pb-24 bg-gradient-game relative overflow-y-auto overflow-x-hidden">
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
      <PageTransition className="relative z-10 w-full max-w-md space-y-3 sm:space-y-5 lg:space-y-6">
        {/* ── Title ── */}
        <div className="text-center space-y-2 sm:space-y-4">
          <motion.h1
            className="font-gaming tracking-tight leading-none"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span
              className="text-gold block text-5xl sm:text-6xl lg:text-8xl drop-shadow-lg"
              style={{
                filter: "drop-shadow(0 4px 30px rgba(255, 215, 0, 0.4))",
              }}
            >
              BINGO
            </span>
            <span
              className="block text-2xl sm:text-3xl lg:text-5xl tracking-[0.25em] mt-1"
              style={{
                color: "transparent",
                WebkitTextStroke: "1.5px rgba(212, 162, 76, 0.7)",
              }}
            >
              ROYALE
            </span>
          </motion.h1>

          <motion.p
            className="text-xs sm:text-base text-neon-purple font-medium tracking-widest uppercase"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            The Ultimate Multiplayer Bingo Experience
          </motion.p>
        </div>

        {/* ── 3D Bingo Balls ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <Suspense
            fallback={
              <div className="flex justify-center gap-3 items-center w-[90vw] max-w-3xl mx-auto" style={{ aspectRatio: "5 / 2" }}>
                {[
                  { n: 7, c: "#3b82f6", l: "B" },
                  { n: 22, c: "#ef4444", l: "I" },
                  { n: 38, c: "#a78bfa", l: "N" },
                  { n: 51, c: "#22c55e", l: "G" },
                  { n: 65, c: "#f59e0b", l: "O" },
                ].map(({ n, c, l }) => (
                  <div
                    key={n}
                    className="w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white shadow-lg animate-pulse"
                    style={{
                      background: `radial-gradient(circle at 30% 25%, ${c}ff, ${c} 60%, ${c}99 100%)`,
                    }}
                  >
                    <div
                      className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex flex-col items-center justify-center"
                      style={{ background: "radial-gradient(circle at 50% 40%, #ffffff, #e0e0e0 100%)" }}
                    >
                      <span style={{ color: c, fontSize: "6px", fontWeight: 700 }}>{l}</span>
                      <span style={{ color: "#0f1330", fontSize: "11px", fontWeight: 800 }}>{n}</span>
                    </div>
                  </div>
                ))}
              </div>
            }
          >
            <BingoBallScene />
          </Suspense>
        </motion.div>

        {/* ── Auth / Name section ── */}
        {!isAuthenticated ? (
          <motion.form
            onSubmit={handleGuest}
            className="space-y-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
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
          </motion.form>
        ) : (
          <StaggerContainer className="space-y-6">
            {/* Current player */}
            <StaggerItem>
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
            </StaggerItem>

            {/* Room actions */}
            <StaggerItem>
              <div className="grid grid-cols-2 gap-4">
                {/* Create Room button */}
                <motion.button
                  type="button"
                  disabled={isConnecting}
                  onClick={() => setShowCreate(true)}
                  className="glass-card rounded-2xl px-4 py-5 flex flex-col items-center gap-3 disabled:opacity-50 group cursor-pointer"
                  style={{
                    boxShadow:
                      "0 0 15px rgba(168,85,247,0.1), 0 4px 20px rgba(0,0,0,0.2)",
                  }}
                  whileHover={{ scale: 1.04, boxShadow: "0 0 25px rgba(212,162,76,0.2), 0 8px 30px rgba(0,0,0,0.3)" }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  {/* Dice icon */}
                  <motion.svg
                    className="w-8 h-8 text-neon-gold"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    whileHover={{ rotate: 15 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <rect x="2" y="2" width="20" height="20" rx="3" />
                    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                    <circle cx="16" cy="8" r="1.2" fill="currentColor" />
                    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
                    <circle cx="8" cy="16" r="1.2" fill="currentColor" />
                    <circle cx="16" cy="16" r="1.2" fill="currentColor" />
                  </motion.svg>
                  <span className="text-sm font-bold text-gold tracking-wide">
                    {t("home.createRoom", { ns: "game" })}
                  </span>
                </motion.button>

                {/* Join Room button */}
                <motion.button
                  type="button"
                  disabled={isConnecting}
                  onClick={() => setShowJoin(true)}
                  className="glass-card rounded-2xl px-4 py-5 flex flex-col items-center gap-3 disabled:opacity-50 group cursor-pointer"
                  style={{
                    boxShadow:
                      "0 0 15px rgba(168,85,247,0.1), 0 4px 20px rgba(0,0,0,0.2)",
                  }}
                  whileHover={{ scale: 1.04, boxShadow: "0 0 25px rgba(212,162,76,0.2), 0 8px 30px rgba(0,0,0,0.3)" }}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
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
                </motion.button>
              </div>
            </StaggerItem>
          </StaggerContainer>
        )}
      </PageTransition>

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
