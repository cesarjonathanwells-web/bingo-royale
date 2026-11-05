import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "../../public/locales/en/common.json";
import enGame from "../../public/locales/en/game.json";
import "@/app.css";
import { BingoCard } from "@/components/bingo/BingoCard";
import { BingoCard90 } from "@/components/bingo/BingoCard90";
import { BallCall3D } from "@/components/3d/BallCall3D";
import { GameView } from "@/components/game/GameView";
import { getCardProgress } from "@/lib/board-progress";
import type { BingoCard75, BingoCard90 as Card90, BingoVariant, GameState, Room } from "@bingo/shared";

// This local fixture uses the production board components with deterministic
// cards. It never connects to a room or sends multiplayer events.
void i18n.use(initReactI18next).init({
  lng: "en", fallbackLng: "en", defaultNS: "common", ns: ["common", "game"],
  resources: { en: { common: enCommon, game: enGame } },
  interpolation: { escapeValue: false },
});

const base75 = [
  [7, 3, 9, 11, 15], [22, 18, 25, 27, 30], [38, 34, 41, 43, 45],
  [51, 47, 54, 56, 60], [65, 62, 68, 71, 75],
];
const rows90 = [
  [1, 0, 21, 0, 43, 0, 61, 0, 81],
  [0, 14, 25, 32, 0, 55, 0, 72, 0],
  [7, 19, 0, 38, 48, 0, 0, 0, 89],
];
const cards75: BingoCard75[] = Array.from({ length: 4 }, (_, cardIndex) => ({
  id: `review-75-${cardIndex}`,
  grid: base75.map((column, col) => column.map((_, row) =>
    col === 2 && row === 2 ? null : column[(row + cardIndex) % 5])),
}));
const cards90: Card90[] = Array.from({ length: 4 }, (_, cardIndex) => ({
  id: `review-90-${cardIndex}`,
  grid: Array.from({ length: 9 }, (_, col) => rows90.map((_, row) => rows90[(row + cardIndex) % 3][col])),
}));
const initialMarks = () => Array.from({ length: 4 }, () => new Set<number>());
const buttonClass = "min-h-11 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-tertiary)] px-3 py-2 text-xs font-semibold hover:border-[var(--color-gold)] focus-visible:outline-2 focus-visible:outline-[var(--color-gold)] cursor-pointer";
const reviewParams = new URLSearchParams(location.search);
const fullReview = reviewParams.get("full") === "1";
const initialVariant: BingoVariant = reviewParams.get("variant") === "90" ? "90" : "75";
const initialCount = reviewParams.get("count") === "4" ? 4 : 1;

function Review() {
  const [variant, setVariant] = useState<BingoVariant>(initialVariant);
  const [count, setCount] = useState(initialCount);
  const [dabs, setDabs] = useState(initialMarks);
  const [calls, setCalls] = useState<number[]>(() => fullReview
    ? (initialVariant === "75" ? cards75[0] : cards90[0]).grid.map(column => column[0] ?? 0).filter(value => value > 0)
    : [initialVariant === "75" ? 7 : 1]);
  const [activeCard, setActiveCard] = useState(0);
  const [paused, setPaused] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [targetMode, setTargetMode] = useState(false);
  const [wilds, setWilds] = useState(initialMarks);
  const [message, setMessage] = useState("Call a number, then tap its square to feel the daub.");
  const reducedMotion = usePrefersReducedMotion();
  const cards = variant === "75" ? cards75 : cards90;
  const calledNumbers = useMemo(() => new Set(calls), [calls]);
  const currentNumber = calls.at(-1) ?? null;
  const columns = variant === "75" ? 5 : 9;
  const blockedIndex = variant === "75" ? 6 : 11;
  const valueAt = (cardIndex: number, cell: number) => cards[cardIndex].grid[cell % columns]?.[Math.floor(cell / columns)] ?? 0;
  const lineAt = (cardIndex: number) => Array.from({ length: columns }, (_, i) => i).filter(i => valueAt(cardIndex, i) > 0);
  const sequence = cards[0].grid[0].map((_, row) =>
    Array.from({ length: columns }, (_, col) => valueAt(0, row * columns + col))).flat().filter(n => n > 0);

  function switchVariant(next: BingoVariant) {
    setVariant(next); setCalls([next === "75" ? 7 : 1]); setDabs(initialMarks()); setWilds(initialMarks());
    setActiveCard(0); setPaused(false);
    setBlocked(false); setTargetMode(false); setMessage(`Ready for ${next}-ball. No multiplayer connection.`);
  }

  function nextCall() {
    const next = sequence.find(n => !calledNumbers.has(n));
    if (!next) { setMessage("Every number on this test card has been called. Reset to repeat."); return; }
    setCalls(previous => [...previous, next]); setMessage(`Number ${next} called. Its unmarked square should stand out.`);
  }

  function mark(cardIndex: number, index: number) {
    const value = valueAt(cardIndex, index);
    if (!value || (variant === "75" && index === 12) || (blocked && index === blockedIndex)) return;
    if (dabs[cardIndex].has(index)) { setMessage(`Number ${value} is already marked; no repeated splash.`); return; }
    if (!targetMode && !calledNumbers.has(value)) { setMessage(`Number ${value} has not been called. The card stays unchanged.`); return; }
    setDabs(previous => previous.map((marks, i) => i === cardIndex ? new Set([...marks, index]) : marks));
    if (targetMode) {
      setWilds(previous => previous.map((marks, i) => i === cardIndex ? new Set([...marks, index]) : marks));
      setTargetMode(false);
    }
    setMessage(`Card ${cardIndex + 1}: ${value} marked.`);
  }

  function markCalled() {
    setDabs(previous => previous.map((marks, cardIndex) => {
      const next = new Set(marks);
      cards[cardIndex].grid.forEach((column, col) => column.forEach((value, row) => {
        const index = row * columns + col;
        if (value && calledNumbers.has(value) && !(blocked && index === blockedIndex) && !next.has(index)) {
          next.add(index);
        }
      }));
      return next;
    }));
    setMessage("Called squares are marked together. Existing marks do not repeat their splash.");
  }

  function preset(complete: boolean) {
    setTargetMode(false); setBlocked(false);
    const lineValues = cards.slice(0, count).flatMap((_, i) => lineAt(i).map(cell => valueAt(i, cell)));
    setCalls(previous => [...new Set([...previous, ...lineValues])]);
    setDabs(cards.map((_, i) => new Set(complete ? lineAt(i) : lineAt(i).slice(0, -1))));
    setMessage(complete ? "Top row is complete. Watch the winning cells and card finish." : "One mark left in the top row. Tap the highlighted last square.");
  }

  if (fullReview) {
    const room: Room = {
      code: "REVIEW", hostId: "host", variant, state: "in_progress", speed: 5000,
      patterns: [variant === "75" ? "top_row" : "one_line"], customPatterns: [], playerLimit: 20,
      players: [{ id: "local", name: "Local player", isHost: false, connected: true, isSpectator: false }],
      createdAt: 0,
    };
    const gameState: GameState = {
      calledNumbers: calls, currentNumber,
      currentLetter: variant === "75" && currentNumber ? "BINGO"[Math.floor((currentNumber - 1) / 15)] : null,
      paused, startedAt: 0, winners: [],
    };
    return <GameView room={room} gameState={gameState} myCards={cards.slice(0, count)}
      myDabs={dabs.slice(0, count)} activeCardIndex={activeCard} myPowerUps={[]}
      peekedNumbers={[]} chatMessages={[]} reactions={[]} isHost={false}
      onSetActiveCard={setActiveCard} onDab={cell => mark(activeCard, cell)} onDabMulti={mark}
      onClaimBingo={() => setMessage("Local review only: a claim is never sent to the server.")}
      onPauseGame={() => setPaused(true)} onResumeGame={() => setPaused(false)}
      onUsePowerUp={() => {}} onSendChat={() => {}} onSendReaction={() => {}}
      onLeave={() => { const destination = new URL(location.href); destination.searchParams.delete("full"); location.href = destination.href; }} />;
  }

  return <main className="mx-auto w-full max-w-5xl space-y-4 p-3 sm:p-6">
    <header className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-text-secondary)]">Bingo Royale · local interaction review</p>
      <h1 className="font-gaming text-2xl text-gold">Make every mark count</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">Production board components. No room, account, audio, or server connection.</p>
    </header>
    <section aria-label="Review controls" className="glass-card rounded-xl p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className={buttonClass} aria-pressed={variant === "75"} onClick={() => switchVariant("75")}>75-ball</button>
        <button className={buttonClass} aria-pressed={variant === "90"} onClick={() => switchVariant("90")}>90-ball</button>
        <button className={buttonClass} aria-pressed={count === 4} onClick={() => setCount(c => c === 1 ? 4 : 1)}>{count === 1 ? "Show four cards" : "Show one card"}</button>
        <button className={buttonClass} onClick={() => { document.documentElement.classList.toggle("light"); }}>Switch light/dark</button>
        <button className={buttonClass} onClick={() => switchVariant(variant)}>Reset marks</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={buttonClass} onClick={nextCall}>Next call</button>
        <button className={buttonClass} onClick={markCalled}>Daub called numbers</button>
        <button className={buttonClass} onClick={() => preset(false)}>Set one mark away</button>
        <button className={buttonClass} onClick={() => preset(true)}>Complete top row</button>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-secondary)]">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={blocked} onChange={event => setBlocked(event.target.checked)} />Block one square</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={targetMode} onChange={event => setTargetMode(event.target.checked)} />Wild target mode</label>
        <span className="flex min-h-11 items-center">{reducedMotion ? "Reduced motion active" : "Standard motion active"} · follows the browser/OS preference</span>
      </div>
    </section>
    <section className="flex items-center gap-4 rounded-xl border border-[var(--color-border-light)] px-4 py-3" aria-label="Current call">
      <BallCall3D number={currentNumber} is75={variant === "75"} />
      <div className="min-w-0"><p className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)]">Current call · {calls.length} called</p><p className="mt-1 text-sm" role="status" aria-live="polite">{message}</p></div>
    </section>
    <section className={`grid items-start gap-2 sm:gap-4 ${count === 4 ? variant === "75" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`} aria-label="Interactive cards">
      {cards.slice(0, count).map((card, cardIndex) => {
        const progress = getCardProgress(card, dabs[cardIndex], variant === "75" ? "top_row" : "one_line");
        const { winningCells, nearWinCells } = progress;
        const targetableCells = targetMode ? new Set(Array.from({ length: columns * (variant === "75" ? 5 : 3) }, (_, i) => i)
          .filter(i => valueAt(cardIndex, i) > 0 && !dabs[cardIndex].has(i) && !(blocked && i === blockedIndex))) : undefined;
        const props = { dabs: dabs[cardIndex], onDab: (cell: number) => mark(cardIndex, cell),
          currentNumber, calledNumbers, winningCells, nearWinCells, wildCells: wilds[cardIndex],
          blockedCells: blocked ? new Set([blockedIndex]) : undefined, targetableCells };
        return <article key={card.id} className="mx-auto w-full max-w-[420px] space-y-2">
          <div className="flex items-center justify-between px-1 text-xs text-[var(--color-text-secondary)]"><span>Card {cardIndex + 1} · {variant === "75" ? "Top Row" : "One Line"}</span><span>{progress.completed ? "Pattern ready" : `${progress.remaining} marks left`}</span></div>
          {variant === "75" ? <BingoCard card={card as BingoCard75} {...props} /> : <BingoCard90 card={card as Card90} {...props} />}
        </article>;
      })}
    </section>
    <p className="pb-4 text-xs leading-relaxed text-[var(--color-text-secondary)]">For accessibility review, use the browser’s Rendering panel to emulate prefers-reduced-motion: reduce. Marks, called-square cues, and pattern state should remain clear while splashes and movement stop.</p>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Review />);
