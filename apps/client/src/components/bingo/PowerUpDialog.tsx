import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { POWER_UP_MAP, type PowerUpId, type PowerUpUseOptions } from "@bingo/shared";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { BlenderIcon } from "@/components/3d/BlenderIcon";

interface PowerUpDialogProps {
  powerupId: PowerUpId | null;
  cardCount: number;
  activeCardIndex: number;
  pending: boolean;
  disabled: boolean;
  choices: number[];
  error?: string | null;
  onUse: (id: PowerUpId, options?: PowerUpUseOptions) => void;
  onTarget: (cardIndex: number) => void;
  onClose: () => void;
}

export function PowerUpDialog({ powerupId, cardCount, activeCardIndex, pending, disabled, choices, error, onUse, onTarget, onClose }: PowerUpDialogProps) {
  const { t, i18n } = useTranslation("game");
  const [cardIndex, setCardIndex] = useState(activeCardIndex);
  useEffect(() => { setCardIndex(activeCardIndex); }, [powerupId, activeCardIndex]);
  const def = powerupId ? POWER_UP_MAP[powerupId] : null;
  if (!powerupId || !def) return null;
  const choosesCard = ["wild_square", "turbo_stamp", "double_daub"].includes(powerupId);
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent title={<span className="flex items-center gap-2 pr-8"><BlenderIcon name={powerupId} className="w-7 h-7 text-2xl leading-none">{def.icon}</BlenderIcon><span>{t(`powerups.${powerupId}`)}</span></span>} description={i18n.language.startsWith("es") ? def.descriptionEs : def.description}>
        {error && <p role="alert" className="text-sm text-red-300 mb-3">{t(`powerups.errors.${error}`, { defaultValue: t("powerups.errors.failed") })}</p>}
        {choosesCard && cardCount > 1 && (
          <fieldset className="mb-4">
            <legend className="text-sm mb-2 text-[var(--color-text-secondary)]">{t("powerups.chooseCard")}</legend>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: cardCount }, (_, index) => <button key={index} type="button" disabled={pending || disabled} aria-pressed={cardIndex === index} onClick={() => setCardIndex(index)} className={`min-h-11 px-4 rounded-lg border ${cardIndex === index ? "border-amber-300 bg-amber-500/20 text-amber-200" : "border-[var(--color-border)] text-[var(--color-text-primary)]"}`}>{t("cards.card", { n: index + 1 })}</button>)}
            </div>
          </fieldset>
        )}
        {powerupId === "callers_choice" && choices.length > 0 ? <>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3" role="status">{t("powerups.chooseNumber")}</p>
          <div className="flex gap-3 justify-center">
            {choices.map(number => <Button key={number} disabled={disabled || pending} loading={pending} onClick={() => onUse(powerupId, { selectedNumber: number })} size="lg">{number}</Button>)}
          </div>
        </> : <Button className="w-full" disabled={disabled || pending} loading={pending} onClick={() => {
          if (powerupId === "wild_square") onTarget(cardIndex);
          else onUse(powerupId, choosesCard ? { cardIndex } : undefined);
        }}>{t(powerupId === "wild_square" ? "powerups.pickSquare" : powerupId === "callers_choice" ? "powerups.showChoices" : "powerups.use")}</Button>}
      </DialogContent>
    </Dialog>
  );
}
