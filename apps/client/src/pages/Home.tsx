import { useState, useCallback, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth-store";
import { useRoomStore } from "@/stores/room-store";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { BingoVariant } from "@bingo/shared";

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
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 pb-20 bg-gradient-game relative">
      {/* Decorative background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[var(--color-ball-b)]/8 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-[var(--color-ball-o)]/8 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/4 right-1/4 w-56 h-56 rounded-full bg-[var(--color-ball-i)]/6 blur-3xl animate-pulse" style={{ animationDuration: '7s' }} />
        <div className="absolute bottom-1/3 left-1/5 w-48 h-48 rounded-full bg-[var(--color-ball-g)]/5 blur-3xl animate-pulse" style={{ animationDuration: '9s' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8 animate-page-enter">
        {/* Title */}
        <div className="text-center space-y-3">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight">
            <span
              className="text-gold drop-shadow-lg"
              style={{ color: 'var(--color-gold)', filter: 'drop-shadow(0 4px 24px rgba(255, 215, 0, 0.3))' }}
            >
              BINGO
            </span>
            <br />
            <span className="text-white tracking-widest text-3xl sm:text-4xl lg:text-5xl" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>ROYALE</span>
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] font-medium tracking-wide">
            {t("app.tagline")}
          </p>
        </div>

        {/* Auth / Name section */}
        {!isAuthenticated ? (
          <form onSubmit={handleGuest} className="space-y-4">
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
          <div className="space-y-4">
            {/* Current player */}
            <div className="flex items-center justify-between px-4 py-3 rounded-xl glass">
              <div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {t("auth.orContinueAs")}
                </p>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {user?.name}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={logout}>
                {t("auth.logout")}
              </Button>
            </div>

            {/* Room actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                size="lg"
                loading={isConnecting}
                onClick={() => setShowCreate(true)}
                className="w-full"
              >
                {t("home.createRoom", { ns: "game" })}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                loading={isConnecting}
                onClick={() => setShowJoin(true)}
                className="w-full"
              >
                {t("home.joinRoom", { ns: "game" })}
              </Button>
            </div>
          </div>
        )}

        {/* Decorative bingo balls */}
        <div className="flex justify-center gap-3">
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
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg"
                style={{
                  background: `radial-gradient(circle at 30% 25%, ${c}ff, ${c} 60%, ${c}99 100%)`,
                  boxShadow: `0 3px 10px ${c}55, inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.3)`,
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex flex-col items-center justify-center"
                  style={{
                    background: "radial-gradient(circle at 50% 40%, #ffffff, #f0f0f0 70%, #e0e0e0 100%)",
                  }}
                >
                  <span style={{ color: c, fontSize: '6px', fontWeight: 700, lineHeight: 1 }}>{l}</span>
                  <span style={{ color: '#0f1330', fontSize: '11px', fontWeight: 800, lineHeight: 1 }}>{n}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Room Dialog */}
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

      {/* Join Room Dialog */}
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
