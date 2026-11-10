import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useState } from "react";
import "@/i18n";
import "@/app.css";
import { GameView } from "@/components/game/GameView";
import { generateCard75, generateCard90, type BingoVariant, type Room, type GameState } from "@bingo/shared";

// Local review of the call stage with a caller that runs without a server.
// ?variant=90, ?count=1-4, ?speed=ms between calls, ?start=numbers already called, ?paused=1, ?theme=light
const params = new URLSearchParams(location.search);
if (params.get("theme") === "light") document.documentElement.classList.add("light");
else document.documentElement.classList.add("dark");
const variant: BingoVariant = params.get("variant") === "90" ? "90" : "75";
const count = Math.max(1, Math.min(4, Number(params.get("count")) || 1));
const speed = Math.max(400, Number(params.get("speed")) || 2500);
const start = Math.max(0, Number(params.get("start")) || 0);
const total = variant === "75" ? 75 : 90;
const letterFor = (n: number) => variant === "75" ? "BINGO"[Math.floor((n - 1) / 15)]! : null;
const room: Room = { code: "REVIEW", hostId: "local", variant, state: "in_progress", speed, patterns: variant === "75" ? ["top_row", "four_corners"] : ["one_line"], customPatterns: [], playerLimit: 20, players: [{ id: "local", name: "Local player", isHost: true, connected: true, isSpectator: false }, { id: "two", name: "Dennis", isHost: false, connected: true, isSpectator: false }], createdAt: 0 };

function CallStageReview() {
  const order = useMemo(() => {
    const numbers = Array.from({ length: total }, (_, i) => i + 1);
    let seed = 20261109;
    for (let i = numbers.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [numbers[i], numbers[j]] = [numbers[j]!, numbers[i]!];
    }
    return numbers;
  }, []);
  const [called, setCalled] = useState(start);
  const [paused, setPaused] = useState(params.get("paused") === "1");
  const [cards] = useState(() => Array.from({ length: count }, () => variant === "75" ? generateCard75() : generateCard90()));
  const [dabs, setDabs] = useState(() => cards.map(() => new Set<number>()));
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setCalled(n => Math.min(total, n + 1)), speed);
    return () => clearInterval(timer);
  }, [paused]);
  const numbers = order.slice(0, called);
  const current = numbers[numbers.length - 1] ?? null;
  const gameState: GameState = { calledNumbers: numbers, currentNumber: current, currentLetter: current ? letterFor(current) : null, paused, startedAt: 0, winners: [] };
  const dab = (ci: number, cell: number) => setDabs(previous => previous.map((marks, i) => i === ci ? new Set([...marks, cell]) : marks));
  return <GameView room={room} gameState={gameState} myCards={cards} myDabs={dabs} activeCardIndex={active}
    myPowerUps={[{ id: "wild_square", used: false }, { id: "shield", used: false }]} peekedNumbers={[]} chatMessages={[]} reactions={[]} isHost
    onSetActiveCard={setActive} onDab={cell => dab(active, cell)} onDabMulti={dab} onClaimBingo={() => {}}
    onPauseGame={() => setPaused(true)} onResumeGame={() => setPaused(false)} onUsePowerUp={() => {}} onSendChat={() => {}} onSendReaction={() => {}} onLeave={() => {}} />;
}
createRoot(document.getElementById("root")!).render(<CallStageReview />);
