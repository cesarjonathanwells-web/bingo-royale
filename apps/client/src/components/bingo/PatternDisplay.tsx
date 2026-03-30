import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { WIN_PATTERNS } from "@bingo/shared";
import { cn } from "@/lib/utils";

interface PatternDisplayProps {
  /** Pattern IDs or 90-ball win stages */
  patternIds: string[];
  /** If true, shows as a compact single pattern. Otherwise shows a grid of patterns. */
  compact?: boolean;
  className?: string;
}

export function PatternDisplay({
  patternIds,
  compact = false,
  className,
}: PatternDisplayProps) {
  const { t } = useTranslation("game");

  const patterns = useMemo(() => {
    return patternIds
      .map((id) => {
        const pattern = WIN_PATTERNS.find((p) => p.id === id);
        if (pattern) {
          return { id: pattern.id, name: t(`patterns.${pattern.id}`), cells: pattern.cells };
        }
        // 90-ball stages
        if (id === "one_line" || id === "two_lines" || id === "full_house") {
          return { id, name: t(`patterns.${id}`), cells: [] };
        }
        return null;
      })
      .filter(Boolean) as { id: string; name: string; cells: number[] }[];
  }, [patternIds, t]);

  if (compact && patterns.length > 0) {
    const first = patterns[0]!;
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {first.cells.length > 0 && <MiniGrid cells={first.cells} />}
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
          {first.name}
          {patterns.length > 1 && ` +${patterns.length - 1}`}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-3 justify-center", className)}>
      {patterns.map((p) => (
        <div
          key={p.id}
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
        >
          {p.cells.length > 0 ? (
            <MiniGrid cells={p.cells} />
          ) : (
            <div className="w-[50px] h-[30px] flex items-center justify-center">
              <span className="text-xs text-[var(--color-accent)]">90</span>
            </div>
          )}
          <span className="text-xs font-medium text-[var(--color-text-secondary)] text-center max-w-[80px]">
            {p.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function MiniGrid({ cells }: { cells: number[] }) {
  const cellSet = useMemo(() => new Set(cells), [cells]);

  return (
    <div className="grid grid-cols-5 gap-[2px] w-[50px]">
      {Array.from({ length: 25 }, (_, i) => (
        <div
          key={i}
          className={cn(
            "w-[8px] h-[8px] rounded-[2px] transition-colors",
            cellSet.has(i)
              ? "bg-[var(--color-accent)] shadow-[0_0_3px_var(--color-accent)]"
              : "bg-[var(--color-bg-tertiary)]/60",
          )}
        />
      ))}
    </div>
  );
}
