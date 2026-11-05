import { useCallback, useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type {
  Room,
  GameState,
  BingoCard as BingoCardType,
  BingoCard75,
  BingoCard90 as BingoCard90Type,
  PlayerPowerUp,
  PowerUpId,
  PowerUpEffects,
  PowerUpUseOptions,
  ChatMessage,
} from "@bingo/shared";
import { GAME_EMOJIS, FREE_SPACE_INDEX } from "@bingo/shared";
import { BingoCard } from "@/components/bingo/BingoCard";
import { BingoCard90 } from "@/components/bingo/BingoCard90";
import { PatternDisplay } from "@/components/bingo/PatternDisplay";
import { CardCarousel } from "@/components/bingo/CardCarousel";
import { EmojiToast } from "@/components/room/EmojiToast";
import { Button } from "@/components/ui/Button";
import { GameTopBar } from "@/components/layout/GameTopBar";
import { BallCallStrip } from "@/components/bingo/BallCallStrip";
import { ActionBar } from "@/components/layout/ActionBar";
import { GameBottomBar } from "@/components/layout/GameBottomBar";
import { ChatDrawer } from "@/components/layout/ChatDrawer";
import { PlayerDrawer } from "@/components/layout/PlayerDrawer";
import { CalledNumbersDropdown } from "@/components/layout/CalledNumbersDropdown";
import { cn } from "@/lib/utils";
import { getAvatarColor } from "@/lib/avatar";
import { PowerUpDialog } from "@/components/bingo/PowerUpDialog";
import { getCardLayout } from "@/lib/card-layout";
import { getCardProgress } from "@/lib/board-progress";
import "./game-layout.css";

interface EmojiReaction {
  emoji: string;
  playerName: string;
  id: string;
}

interface GameViewProps {
  room: Room;
  gameState: GameState;
  myCards: BingoCardType[];
  myDabs: Set<number>[];
  activeCardIndex: number;
  myPowerUps: PlayerPowerUp[];
  peekedNumbers: number[];
  chatMessages: ChatMessage[];
  reactions: EmojiReaction[];
  isHost: boolean;
  onSetActiveCard: (index: number) => void;
  onDab: (cellIndex: number) => void;
  onDabMulti: (cardIndex: number, cellIndex: number) => void;
  onClaimBingo: () => void;
  onPauseGame: () => void;
  onResumeGame: () => void;
  onUsePowerUp: (id: PowerUpId, options?: PowerUpUseOptions) => void;
  powerUpEffects?: PowerUpEffects;
  powerUpCalledCount?: number;
  pendingPowerUp?: PowerUpId | null;
  callerChoices?: number[];
  powerUpError?: string | null;
  powerupsDisabled?: boolean;
  onClearPowerUpPrompt?: () => void;
  onSendChat: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onLeave: () => void;
}

export function GameView({
  room,
  gameState,
  myCards,
  myDabs,
  activeCardIndex,
  myPowerUps,
  peekedNumbers,
  chatMessages,
  reactions,
  isHost,
  onSetActiveCard,
  onDabMulti,
  onClaimBingo,
  onPauseGame,
  onResumeGame,
  onUsePowerUp,
  powerUpEffects = { wildCells: [], blockedCells: [], shieldUntilCall: 0 },
  powerUpCalledCount = gameState.calledNumbers.length,
  pendingPowerUp = null,
  callerChoices = [],
  powerUpError = null,
  powerupsDisabled = false,
  onClearPowerUpPrompt,
  onSendChat,
  onSendReaction,
  onLeave,
}: GameViewProps) {
  const { t } = useTranslation("game");

  const gridContainerRef = useRef<HTMLDivElement>(null);
  const [gridLayout, setGridLayout] = useState({ columns: 1, maxWidth: 420 });
  const [viewAll, setViewAll] = useState(myCards.length > 1);

  useLayoutEffect(() => {
    const element = gridContainerRef.current;
    if (!element) return;
    const calculate = () => {
      // clientWidth/clientHeight include padding; measure the usable card area.
      const style = getComputedStyle(element);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const tabHeight = element.querySelector<HTMLElement>(".game-carousel-tabs")?.getBoundingClientRect().height ?? 0;
      const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - tabHeight;
      if (width <= 0 || height <= 0) return;
      const next = getCardLayout({ width, height, count: viewAll ? myCards.length : 1, variant: room.variant });
      setGridLayout(previous => previous.columns === next.columns && Math.abs(previous.maxWidth - next.maxWidth) < 1
        ? previous : next);
    };
    const observer = new ResizeObserver(calculate);
    observer.observe(element);
    const tabs = element.querySelector(".game-carousel-tabs");
    if (tabs) observer.observe(tabs);
    calculate();
    return () => observer.disconnect();
  }, [myCards.length, room.variant, viewAll]);

  useEffect(() => {
    gridContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [viewAll]);

  const [chatOpen, setChatOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [numbersOpen, setNumbersOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const prevChatLength = useRef(chatMessages.length);

  // Track unread chat messages
  useEffect(() => {
    if (chatMessages.length > prevChatLength.current && !chatOpen) {
      setUnreadChat((u) => u + (chatMessages.length - prevChatLength.current));
    }
    prevChatLength.current = chatMessages.length;
  }, [chatMessages.length, chatOpen]);

  // Clear unread when chat opens
  useEffect(() => {
    if (chatOpen) {
      setUnreadChat(0);
    }
  }, [chatOpen]);

  const myCard =
    myCards.length > 0 ? (myCards[activeCardIndex] ?? myCards[0] ?? null) : null;
  const activeDabs =
    myDabs.length > 0
      ? (myDabs[activeCardIndex] ?? myDabs[0] ?? new Set<number>())
      : new Set<number>();

  const [selectedPowerUp, setSelectedPowerUp] = useState<PowerUpId | null>(null);
  const [wildTargetCard, setWildTargetCard] = useState<number | null>(null);
  const powerupsUnavailable = powerupsDisabled || gameState.paused || myCards.length === 0;
  const closePowerUp = useCallback(() => { setSelectedPowerUp(null); onClearPowerUpPrompt?.(); }, [onClearPowerUpPrompt]);
  useEffect(() => {
    if (selectedPowerUp && myPowerUps.some(powerup => powerup.id === selectedPowerUp && powerup.used)) closePowerUp();
  }, [myPowerUps, selectedPowerUp, closePowerUp]);
  useEffect(() => {
    if (powerupsUnavailable) { setWildTargetCard(null); closePowerUp(); }
  }, [powerupsUnavailable, closePowerUp]);
  const blockedCells = myCards.map((_, ci) => new Set(powerUpEffects.blockedCells.filter(cell => cell.cardIndex === ci && cell.expiresAtCall >= powerUpCalledCount).map(cell => cell.cellIndex)));
  const wildCells = myCards.map((_, ci) => new Set(powerUpEffects.wildCells.filter(cell => cell.cardIndex === ci).map(cell => cell.cellIndex)));
  const calledNumbers = useMemo(() => new Set(gameState.calledNumbers), [gameState.calledNumbers]);
  const previousCallCount = Math.max(0, gameState.calledNumbers.length - 1);
  const previousCalledNumbers = useMemo(() => new Set(gameState.calledNumbers.slice(0, -1)), [gameState.calledNumbers]);
  // Only confirmed, eligible marks drive visual progress. Claim validation and
  // timing still belong to the server, including wildcard and ink rules.
  const cardProgress = myCards.map((card, ci) => {
    const columns = room.variant === "75" ? 5 : 9;
    const eligibleMarks = new Set(Array.from(myDabs[ci] ?? []).filter(index => {
      if (room.variant === "75" && index === FREE_SPACE_INDEX) return true;
      const value = card.grid[index % columns]?.[Math.floor(index / columns)];
      return !blockedCells[ci].has(index) && (wildCells[ci].has(index) || (value != null && calledNumbers.has(value)));
    }));
    // A previously available pattern has missed its claim window. Let the
    // next enabled pattern/stage surface instead of leaving a stale claim cue.
    const eligibleBeforeCurrent = new Set<number>();
    card.grid.forEach((column, col) => column.forEach((value, row) => {
      const index = row * columns + col;
      if (room.variant === "75" && index === FREE_SPACE_INDEX) { eligibleBeforeCurrent.add(index); return; }
      if (!value) return;
      const previouslyBlocked = powerUpEffects.blockedCells.some(cell => cell.cardIndex === ci && cell.cellIndex === index
        && cell.expiresAtCall >= previousCallCount && cell.expiresAtCall - 2 <= previousCallCount);
      if (previouslyBlocked) return;
      const previousWild = powerUpEffects.wildCells.some(cell => cell.cardIndex === ci && cell.cellIndex === index
        && cell.grantedAtCall <= previousCallCount);
      if (previousWild || previousCalledNumbers.has(value)) eligibleBeforeCurrent.add(index);
    }));
    return getCardProgress(card, eligibleMarks, room.patterns, room.customPatterns, eligibleBeforeCurrent);
  });
  const bestProgressIndex = cardProgress.reduce((best, progress, index) =>
    best < 0 || progress.remaining < cardProgress[best].remaining ? index : best, -1);
  const bestProgress = cardProgress[bestProgressIndex];
  const patternMarked = Boolean(bestProgress?.completed);
  const oneAway = bestProgress?.remaining === 1;
  const unmarkedCalls = myCards.reduce((total, card, ci) => total + card.grid.reduce((sum, column, col) =>
    sum + column.filter((value, row) => {
      const index = row * card.grid.length + col;
      return value != null && value > 0 && calledNumbers.has(value) && !myDabs[ci]?.has(index) && !blockedCells[ci].has(index);
    }).length, 0), 0);
  const targetableCells = wildTargetCard === null ? undefined : myCards.map((card, ci) => {
    const cells = new Set<number>();
    if (ci !== wildTargetCard) return cells;
    const columns = room.variant === "75" ? 5 : 9;
    card.grid.forEach((column, col) => column.forEach((value, row) => {
      const index = row * columns + col;
      if (value && !myDabs[ci]?.has(index) && !blockedCells[ci].has(index)) cells.add(index);
    }));
    return cells;
  });
  const handleCardPress = (cardIndex: number, cellIndex: number) => {
    if (wildTargetCard !== null) {
      if (powerupsUnavailable || pendingPowerUp || !targetableCells?.[cardIndex].has(cellIndex)) return;
      onUsePowerUp("wild_square", { cardIndex, targetCellIndex: cellIndex });
      setWildTargetCard(null);
    } else onDabMulti(cardIndex, cellIndex);
  };
  const selectCard = (index: number) => { onSetActiveCard(index); if (wildTargetCard !== null) setWildTargetCard(index); };
  const shieldActive = powerUpEffects.shieldUntilCall > 0 && powerUpEffects.shieldUntilCall >= powerUpCalledCount;
  const activeBlocks = powerUpEffects.blockedCells.filter(cell => cell.expiresAtCall >= powerUpCalledCount);
  const callsLabel = (until: number) => until === powerUpCalledCount ? t("powerups.untilNextCall") : t("powerups.callsRemaining", { count: until - powerUpCalledCount });

  const handleEmojiSend = useCallback(
    (emoji: string) => {
      onSendReaction(emoji);
      setEmojiOpen(false);
    },
    [onSendReaction],
  );

  return (
    <div className="game-shell fixed inset-0 h-[100dvh] flex flex-col min-h-0 bg-[var(--color-bg-primary)]" data-variant={room.variant} style={{ paddingTop: "env(safe-area-inset-top)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
      <header className="game-header">
        {/* Top bar with room code + controls */}
        <GameTopBar
          gameState={gameState}
          variant={room.variant}
          roomCode={room.code}
          onMenuPress={() => setPlayersOpen(true)}
          onLeave={onLeave}
        />

        {/* Ball call strip: current ball (25% larger) + last 3 called */}
        <BallCallStrip
          gameState={gameState}
          variant={room.variant}
          onPress={() => setNumbersOpen(!numbersOpen)}
        />
        {/* Called numbers dropdown */}
        <CalledNumbersDropdown
          open={numbersOpen}
          onClose={() => setNumbersOpen(false)}
          gameState={gameState}
          variant={room.variant}
        />

      </header>

      {/* Main area: on desktop, card left + sidebar right. On mobile, card only */}
      <div className="game-main flex-1 min-h-0 flex overflow-hidden">
        {/* Card column */}
        <div className="game-board-column flex-1 min-w-0 min-h-0 flex flex-col items-center overflow-hidden relative">
        {/* Paused overlay */}
        {gameState.paused && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--color-bg-primary)]/80 backdrop-blur-sm">
            <div className="px-6 py-4 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-center">
              <span className="text-lg font-semibold text-amber-400">
                {t("game.paused")}
              </span>
              {isHost && (
                <div className="mt-3">
                  <Button variant="secondary" size="sm" onClick={onResumeGame}>
                    {t("game.resume")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="game-board-toolbar">
          <div className="game-board-meta">
            {/* Active Pattern */}
            {room.variant === "75" && room.patterns.length > 0 && (
              <div className="game-active-pattern flex items-center gap-2 shrink-0">
                <span className="game-pattern-label text-[10px] text-[var(--color-text-muted)]">
                  {t("game.activePattern")}:
                </span>
                <PatternDisplay patternIds={room.patterns} customPatterns={room.customPatterns} compact />
              </div>
            )}

            {myCards.length > 0 && <div className="board-progress shrink-0" data-state={patternMarked ? "complete" : oneAway ? "near" : "playing"}
              role="status" aria-live={patternMarked || oneAway ? "polite" : "off"}>
              <span className="board-progress__dot" aria-hidden="true" />
              <span>{patternMarked ? t("game.patternMarked") : oneAway ? t("game.oneAway") : unmarkedCalls > 0
                ? t("game.markCalled", { count: unmarkedCalls }) : t("game.followCalls")}</span>
              {(patternMarked || oneAway) && myCards.length > 1 && <span className="opacity-70">· {t("cards.card", { n: bestProgressIndex + 1 })}</span>}
            </div>}

          </div>
          <div className="game-toolbar-controls">
            {!viewAll && myCards.length > 1 && <select className="game-card-selector" aria-label={t("game.yourCard")}
              value={activeCardIndex} onChange={event => selectCard(Number(event.target.value))}>
              {myCards.map((card, index) => <option key={card.id} value={index}>{t("cards.card", { n: index + 1 })}</option>)}
            </select>}
            {/* View toggle */}
            {myCards.length > 1 && (
              <div className="game-view-switch flex items-center justify-center gap-1 shrink-0">
                <button
                  aria-pressed={!viewAll}
                  onClick={() => setViewAll(false)}
                  className={cn(
                    "min-h-11 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                    !viewAll
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]",
                  )}
                >
                  {t("cards.singleView")}
                </button>
                <button
                  aria-pressed={viewAll}
                  onClick={() => setViewAll(true)}
                  className={cn(
                    "min-h-11 px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                    viewAll
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]",
                  )}
                >
                  {t("cards.allView")}
                </button>
              </div>
            )}

            {isHost && !gameState.paused && <button type="button" className="game-pause-control" onClick={onPauseGame} aria-label={t("game.pause")} title={t("game.pause")}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
            </button>}
          </div>
        </div>
        {/* Active power-up effects stay visible above the cards. */}
        {(shieldActive || powerUpEffects.doubleDaub || activeBlocks.length > 0) && <div role="status" className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs px-2 py-1 shrink-0 text-[var(--color-text-secondary)]">
          {shieldActive && <span>🛡️ {t("powerups.shield")}: {callsLabel(powerUpEffects.shieldUntilCall)}</span>}
          {powerUpEffects.doubleDaub && <span>✌️ {t("powerups.doubleReady", { n: powerUpEffects.doubleDaub.cardIndex + 1 })}</span>}
          {activeBlocks.map(cell => <span key={`${cell.cardIndex}-${cell.cellIndex}`}>🔒 {t("powerups.inkOnCard", { n: cell.cardIndex + 1 })}: {callsLabel(cell.expiresAtCall)}</span>)}
        </div>}
        {wildTargetCard !== null && <div role="status" className="w-full flex items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 shrink-0">
          <span className="flex-1">{t("powerups.tapSquare", { n: wildTargetCard + 1 })}</span>
          <button type="button" className="min-h-11 px-3 underline" onClick={() => setWildTargetCard(null)}>{t("powerups.cancel")}</button>
        </div>}
        {powerUpError && !selectedPowerUp && <p role="alert" className="text-xs text-red-300 py-1 shrink-0">{t(`powerups.errors.${powerUpError}`, { defaultValue: t("powerups.errors.failed") })}</p>}

        {/* Card display */}
        <div ref={gridContainerRef} className="game-card-viewport flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
          {viewAll && myCards.length > 1 ? (
            <div
              className="game-card-grid grid w-full mx-auto items-start"
              style={{ gridTemplateColumns: `repeat(${gridLayout.columns}, minmax(0, 1fr))`, maxWidth: `${gridLayout.maxWidth}px` }}
            >
              {myCards.map((card, ci) => (
                <section key={card.id} aria-label={t("cards.card", { n: ci + 1 })}
                  className="min-w-0 w-full"
                  style={myCards.length === 3 && ci === 2 && gridLayout.columns === 2
                    ? { gridColumn: "1 / -1", width: "calc((100% - 8px) / 2)", justifySelf: "center" } : undefined}>
                  <button type="button" className="game-card-label w-full min-h-7 text-xs font-semibold text-[var(--color-text-secondary)] cursor-pointer"
                    aria-label={t("cards.enlarge", { n: ci + 1 })}
                    onClick={() => { selectCard(ci); setViewAll(false); }}>
                    {t("cards.card", { n: ci + 1 })} <span aria-hidden="true">↗</span>
                  </button>
                  {room.variant === "75" ? (
                    <BingoCard
                      card={card as BingoCard75}
                      dabs={myDabs[ci] ?? new Set()}
                      onDab={(cellIndex) => handleCardPress(ci, cellIndex)}
                      blockedCells={blockedCells[ci]}
                      wildCells={wildCells[ci]}
                      targetableCells={targetableCells?.[ci]}
                      disabled={powerupsUnavailable}
                      currentNumber={gameState.currentNumber}
                      calledNumbers={calledNumbers}
                      winningCells={cardProgress[ci]?.winningCells}
                      nearWinCells={cardProgress[ci]?.nearWinCells}
                    />
                  ) : (
                    <BingoCard90
                      card={card as BingoCard90Type}
                      dabs={myDabs[ci] ?? new Set()}
                      onDab={(cellIndex) => handleCardPress(ci, cellIndex)}
                      blockedCells={blockedCells[ci]}
                      wildCells={wildCells[ci]}
                      targetableCells={targetableCells?.[ci]}
                      disabled={powerupsUnavailable}
                      currentNumber={gameState.currentNumber}
                      calledNumbers={calledNumbers}
                      winningCells={cardProgress[ci]?.winningCells}
                      nearWinCells={cardProgress[ci]?.nearWinCells}
                    />
                  )}
                </section>
              ))}
            </div>
          ) : myCards.length > 1 ? (
            <CardCarousel
              cards={myCards}
              dabs={myDabs}
              variant={room.variant}
              onDab={handleCardPress}
              blockedCells={blockedCells}
              wildCells={wildCells}
              targetableCells={targetableCells}
              disabled={powerupsUnavailable}
              activeIndex={activeCardIndex}
              onIndexChange={selectCard}
              currentNumber={gameState.currentNumber}
              calledNumbers={calledNumbers}
              progress={cardProgress}
              cardMaxWidth={gridLayout.maxWidth}
            />
          ) : (
            <div style={{ maxWidth: `${gridLayout.maxWidth}px` }} className="game-single-card w-full mx-auto">
              {myCard && (
                <>
                  {room.variant === "75" ? (
                    <BingoCard
                      card={myCard as BingoCard75}
                      dabs={activeDabs}
                      onDab={(cellIndex) => handleCardPress(activeCardIndex, cellIndex)}
                      blockedCells={blockedCells[activeCardIndex]}
                      wildCells={wildCells[activeCardIndex]}
                      targetableCells={targetableCells?.[activeCardIndex]}
                      disabled={powerupsUnavailable}
                      currentNumber={gameState.currentNumber}
                      calledNumbers={calledNumbers}
                      winningCells={cardProgress[activeCardIndex]?.winningCells}
                      nearWinCells={cardProgress[activeCardIndex]?.nearWinCells}
                    />
                  ) : (
                    <BingoCard90
                      card={myCard as BingoCard90Type}
                      dabs={activeDabs}
                      onDab={(cellIndex) => handleCardPress(activeCardIndex, cellIndex)}
                      blockedCells={blockedCells[activeCardIndex]}
                      wildCells={wildCells[activeCardIndex]}
                      targetableCells={targetableCells?.[activeCardIndex]}
                      disabled={powerupsUnavailable}
                      currentNumber={gameState.currentNumber}
                      calledNumbers={calledNumbers}
                      winningCells={cardProgress[activeCardIndex]?.winningCells}
                      nearWinCells={cardProgress[activeCardIndex]?.nearWinCells}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Number Peek Overlay */}
        {peekedNumbers.length > 0 && (
          <div className="absolute top-2 left-2 right-2 z-10 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-accent)]/40 shadow-lg">
            <p className="text-xs font-semibold text-[var(--color-accent)] text-center mb-1">
              {t("powerups.number_peek")}
            </p>
            <div className="flex justify-center gap-3">
              {peekedNumbers.map((num) => (
                <span
                  key={num}
                  className="text-lg font-bold text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] rounded-lg px-3 py-1"
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        )}

        </div>{/* end card column */}

        {/* Desktop sidebar - visible on lg+ */}
        <aside className="game-sidebar flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
          {/* Player list */}
          <div className="border-b border-[var(--color-border)] overflow-y-auto max-h-[40%]">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-gaming tracking-wider text-gold">
                {t("game.players")} ({room.players.length})
              </h3>
            </div>
            <ul className="divide-y divide-[var(--color-border)]/30">
              {room.players.map((player) => (
                <li key={player.id} className="flex items-center gap-2 px-4 py-2">
                  <div
                    className={cn(
                      "w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white",
                      !player.connected && "opacity-40",
                    )}
                    style={{ backgroundColor: getAvatarColor(player.name) }}
                  >
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className={cn(
                    "text-sm font-medium truncate",
                    player.connected ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]",
                  )}>
                    {player.name}
                  </span>
                  {player.isHost && (
                    <span className="text-[10px] text-amber-400 font-bold shrink-0">★</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Chat - fills remaining space */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="text-sm font-gaming tracking-wider text-gold">
                {t("game.chat")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2" role="log" aria-live="polite">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] text-center py-4">...</p>
              ) : (
                chatMessages.slice(-30).map((msg) => (
                  <div key={msg.id} className="flex gap-2 text-sm">
                    <span className="font-semibold text-[var(--color-accent)] shrink-0">{msg.playerName}:</span>
                    <span className="text-[var(--color-text-secondary)] break-words min-w-0">{msg.text}</span>
                  </div>
                ))
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector("input");
                if (input && input.value.trim()) {
                  onSendChat(input.value.trim());
                  input.value = "";
                }
              }}
              className="flex gap-2 px-4 py-3 border-t border-[var(--color-border)]"
            >
              <input
                type="text"
                maxLength={200}
                placeholder={t("chat.placeholder")}
                className="min-w-0 flex-1 px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)]"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 cursor-pointer"
              >
                {t("chat.send")}
              </button>
            </form>
          </div>
        </aside>
      </div>{/* end main area flex row */}

      <footer className="game-controls">
        {/* Action bar */}
        <ActionBar
          powerups={myPowerUps}
          onUsePowerUp={(id) => { onClearPowerUpPrompt?.(); setWildTargetCard(null); setSelectedPowerUp(id); }}
          disabled={powerupsUnavailable || pendingPowerUp !== null || wildTargetCard !== null}
          pendingPowerUp={pendingPowerUp}
          onToggleChat={() => setChatOpen(!chatOpen)}
          onToggleEmoji={() => setEmojiOpen(!emojiOpen)}
          onTogglePlayers={() => setPlayersOpen(true)}
          unreadChat={unreadChat}
          chatOpen={chatOpen}
        />

        {/* BINGO button (in-flow, not fixed) */}
        <GameBottomBar onClaim={onClaimBingo} disabled={powerupsUnavailable || wildTargetCard !== null} ready={patternMarked} />
      </footer>
      <PowerUpDialog powerupId={selectedPowerUp} cardCount={myCards.length} activeCardIndex={activeCardIndex} pending={pendingPowerUp !== null} disabled={powerupsUnavailable} choices={callerChoices} error={powerUpError} onUse={onUsePowerUp} onClose={closePowerUp} onTarget={cardIndex => { selectCard(cardIndex); setViewAll(false); setWildTargetCard(cardIndex); closePowerUp(); }} />

      {/* Emoji picker overlay */}
      {emojiOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setEmojiOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              "game-emoji-picker fixed left-1/2 -translate-x-1/2",
              "flex flex-wrap justify-center gap-1 p-2",
              "bg-[var(--color-bg-secondary)] border border-[var(--color-border)]",
              "rounded-xl shadow-xl",
              "max-w-[calc(100vw-2rem)] w-max",
              "animate-slide-in-up",
            )}
            style={{ zIndex: 35 }}
          >
            {GAME_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleEmojiSend(emoji)}
                className={cn(
                  "w-11 h-11 flex items-center justify-center",
                  "rounded-lg hover:bg-[var(--color-bg-tertiary)]",
                  "transition-colors text-xl select-none cursor-pointer",
                  "active:scale-90",
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Chat drawer */}
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={chatMessages}
        onSend={onSendChat}
      />

      {/* Player drawer */}
      <PlayerDrawer
        open={playersOpen}
        onClose={() => setPlayersOpen(false)}
        players={room.players}
        roomCode={room.code}
      />

      {/* Floating emoji reactions */}
      <EmojiToast reactions={reactions} />
    </div>
  );
}

