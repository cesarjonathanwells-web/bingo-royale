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
        toast(t("errors.generic"), "error");
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
    if (code.length < 6) {
      toast(t("errors.invalidRoom"), "error");
      return;
    }
    joinRoom(code);
    setShowJoin(false);
  }, [joinRoom, roomCode, t, toast]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 bg-gradient-game">
      {/* Decorative background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full bg-[var(--color-ball-b)]/5 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-[var(--color-ball-o)]/5 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-[var(--color-ball-i)]/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-8">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-[var(--color-ball-b)] via-[var(--color-ball-i)] via-[var(--color-ball-g)] to-[var(--color-ball-o)] bg-clip-text text-transparent">
              BINGO
            </span>
            <br />
            <span className="text-[var(--color-text-primary)]">ROYALE</span>
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
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
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
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
        <div className="flex justify-center gap-3 opacity-60">
          {[
            { n: 7, c: "#2563eb" },
            { n: 22, c: "#dc2626" },
            { n: 38, c: "#9ca3af" },
            { n: 51, c: "#16a34a" },
            { n: 65, c: "#eab308" },
          ].map(({ n, c }) => (
            <div
              key={n}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${c}cc, ${c})`,
              }}
            >
              {n}
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
