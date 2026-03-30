import { useTranslation } from "react-i18next";
import type { PlayerPowerUp, PowerUpId } from "@bingo/shared";
import { POWER_UP_MAP } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface PowerUpBarProps {
  powerups: PlayerPowerUp[];
  onUse: (id: PowerUpId, targetCellIndex?: number) => void;
}

export function PowerUpBar({ powerups, onUse }: PowerUpBarProps) {
  const { t } = useTranslation("game");

  if (powerups.length === 0) return null;

  return (
    <div className="w-full max-w-[calc(100%-0.5rem)] sm:max-w-[400px] mx-auto">
      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 text-center">
        {t("powerups.title")}
      </p>
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 justify-center">
        {powerups.map((pu) => {
          const def = POWER_UP_MAP[pu.id];
          if (!def) return null;

          return (
            <button
              key={pu.id}
              disabled={pu.used}
              onClick={() => onUse(pu.id)}
              title={def.description}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl",
                "min-w-[60px] sm:min-w-[72px] min-h-[48px] transition-all duration-200",
                "border select-none cursor-pointer",
                pu.used
                  ? "opacity-40 border-[var(--color-border)] bg-[var(--color-bg-tertiary)] cursor-not-allowed"
                  : [
                      "border-[var(--color-accent)]/50 bg-[var(--color-bg-secondary)]",
                      "hover:bg-[var(--color-accent)]/20 hover:border-[var(--color-accent)]",
                      "hover:scale-105 active:scale-95",
                      "shadow-md shadow-[var(--color-accent)]/10",
                      "animate-pulse-subtle",
                    ],
              )}
            >
              <span className="text-xl leading-none">{def.icon}</span>
              <span
                className={cn(
                  "text-[10px] font-semibold leading-tight whitespace-nowrap",
                  pu.used
                    ? "text-[var(--color-text-muted)]"
                    : "text-[var(--color-text-primary)]",
                )}
              >
                {t(`powerups.${pu.id}`)}
              </span>
              {pu.used && (
                <span className="text-[9px] text-[var(--color-text-muted)] uppercase">
                  {t("powerups.used")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
