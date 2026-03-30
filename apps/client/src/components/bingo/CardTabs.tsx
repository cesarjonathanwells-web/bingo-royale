import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface CardTabsProps {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  dabs: Set<number>[];
}

export function CardTabs({ count, activeIndex, onSelect, dabs }: CardTabsProps) {
  const { t } = useTranslation("game");

  if (count <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 w-full max-w-[400px] mx-auto">
      {Array.from({ length: count }, (_, i) => {
        const isActive = i === activeIndex;
        const dabCount = dabs[i]?.size ?? 0;

        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-150",
              "border select-none cursor-pointer",
              isActive
                ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-md shadow-[var(--color-accent)]/30"
                : "bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]",
            )}
            aria-label={t("cards.card", { n: i + 1 })}
            aria-current={isActive ? "true" : undefined}
          >
            <span>{t("cards.card", { n: i + 1 })}</span>
            {dabCount > 0 && (
              <span
                className={cn(
                  "ml-1.5 inline-flex items-center justify-center text-xs rounded-full w-5 h-5",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]",
                )}
              >
                {dabCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
