import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { WinPattern } from "@bingo/shared";
import { MIN_PATTERN_CELLS } from "@bingo/shared";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface CreatePatternDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (pattern: WinPattern) => void;
}

function generateCustomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "custom_";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function CreatePatternDialog({
  open,
  onOpenChange,
  onSave,
}: CreatePatternDialogProps) {
  const { t, i18n } = useTranslation("game");
  const isEs = i18n.language === "es";

  const [name, setName] = useState("");
  const [nameEs, setNameEs] = useState("");
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set());

  const toggleCell = useCallback((index: number) => {
    setSelectedCells((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const canSave = name.trim().length > 0 && selectedCells.size >= MIN_PATTERN_CELLS;

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const pattern: WinPattern = {
      id: generateCustomId(),
      name: name.trim(),
      nameEs: nameEs.trim() || name.trim(),
      cells: Array.from(selectedCells).sort((a, b) => a - b),
    };
    onSave(pattern);
    // Reset state
    setName("");
    setNameEs("");
    setSelectedCells(new Set());
  }, [canSave, name, nameEs, selectedCells, onSave]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setName("");
        setNameEs("");
        setSelectedCells(new Set());
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );

  const HEADERS = ["B", "I", "N", "G", "O"];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        title={t("lobby.customPatternTitle")}
        description={t("lobby.customPatternDesc")}
      >
        <div className="space-y-4">
          {/* Name inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={t("lobby.patternName")}
              placeholder={t("lobby.patternNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 30))}
              maxLength={30}
            />
            <Input
              label={t("lobby.patternNameEs")}
              placeholder={t("lobby.patternNameEsPlaceholder")}
              value={nameEs}
              onChange={(e) => setNameEs(e.target.value.slice(0, 30))}
              maxLength={30}
            />
          </div>

          {/* Interactive 5x5 grid */}
          <div className="flex flex-col items-center gap-2">
            {/* Column headers */}
            <div className="grid grid-cols-5 gap-1.5 w-fit">
              {HEADERS.map((h) => (
                <div
                  key={h}
                  className="w-11 h-6 flex items-center justify-center text-xs font-bold text-[var(--color-accent)]"
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Grid cells */}
            <div className="grid grid-cols-5 gap-1.5 w-fit">
              {Array.from({ length: 25 }, (_, i) => {
                const active = selectedCells.has(i);
                const isFree = i === 12;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleCell(i)}
                    className={cn(
                      "w-11 h-11 rounded-lg text-xs font-bold transition-all duration-150 border-2 cursor-pointer",
                      active
                        ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-md shadow-[var(--color-accent)]/30"
                        : "bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-bg-tertiary)]",
                      isFree && !active && "text-[var(--color-accent)]/60",
                    )}
                  >
                    {isFree ? "F" : ""}
                  </button>
                );
              })}
            </div>

            {/* Cell count */}
            <p
              className={cn(
                "text-xs",
                selectedCells.size < MIN_PATTERN_CELLS
                  ? "text-[var(--color-text-muted)]"
                  : "text-[var(--color-accent)]",
              )}
            >
              {selectedCells.size} / 25 {selectedCells.size < MIN_PATTERN_CELLS && `— ${t("lobby.minCells")}`}
            </p>
          </div>

          {/* Preview */}
          {selectedCells.size > 0 && (
            <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-[var(--color-bg-primary)]">
              <div className="grid grid-cols-5 gap-[2px] w-[50px]">
                {Array.from({ length: 25 }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-[8px] h-[8px] rounded-[2px] transition-colors",
                      selectedCells.has(i)
                        ? "bg-[var(--color-accent)] shadow-[0_0_3px_var(--color-accent)]"
                        : "bg-[var(--color-bg-tertiary)]/60",
                    )}
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                {name || (isEs ? "Mi Patrón" : "My Pattern")}
              </span>
            </div>
          )}

          {/* Save button */}
          <Button
            size="lg"
            onClick={handleSave}
            disabled={!canSave}
            className="w-full"
          >
            {t("lobby.savePattern")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
