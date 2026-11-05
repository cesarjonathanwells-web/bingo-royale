import { useRef, useCallback, useEffect, useLayoutEffect } from "react";
import type {
  BingoCard as BingoCardType,
  BingoCard75,
  BingoCard90 as BingoCard90Type,
} from "@bingo/shared";
import { BingoCard } from "./BingoCard";
import { BingoCard90 } from "./BingoCard90";
import { CardTabs } from "./CardTabs";
import type { CardProgress } from "@/lib/board-progress";

interface CardCarouselProps {
  cards: BingoCardType[];
  dabs: Set<number>[];
  variant: "75" | "90";
  onDab: (cardIndex: number, cellIndex: number) => void;
  activeIndex: number;
  onIndexChange: (index: number) => void;
  blockedCells?: Set<number>[];
  wildCells?: Set<number>[];
  targetableCells?: Set<number>[];
  disabled?: boolean;
  currentNumber?: number | null;
  calledNumbers?: ReadonlySet<number>;
  progress?: CardProgress[];
  /** Width fitted to the available board area by the parent layout. */
  cardMaxWidth?: number;
}

export function CardCarousel({
  cards,
  dabs,
  variant,
  onDab,
  activeIndex,
  onIndexChange,
  blockedCells,
  wildCells,
  targetableCells,
  disabled,
  currentNumber,
  calledNumbers,
  progress,
  cardMaxWidth,
}: CardCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchingRef = useRef(false);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  const scrollToCard = useCallback((index: number) => {
    onIndexChange(index);
  }, [onIndexChange]);

  // Read the selected card only after a swipe settles, without interrupting it.
  const handleScroll = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      if (touchingRef.current) return;
      const container = scrollRef.current;
      if (!container || container.clientWidth === 0) return;
      const index = Math.max(0, Math.min(Math.round(container.scrollLeft / container.clientWidth), cards.length - 1));
      if (index !== activeIndexRef.current) onIndexChange(index);
    }, 150);
  }, [cards.length, onIndexChange]);

  // A phone rotation changes the page width. Keep the same card in view.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const alignSelectedCard = () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      container.scrollTo({ left: container.clientWidth * activeIndexRef.current, behavior: "auto" });
    };
    const observer = new ResizeObserver(alignSelectedCard);
    observer.observe(container);
    alignSelectedCard();
    return () => {
      observer.disconnect();
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const expectedLeft = container.clientWidth * activeIndex;
    if (Math.abs(container.scrollLeft - expectedLeft) > 5) {
      container.scrollTo({ left: expectedLeft, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [activeIndex]);

  return (
    <div className="flex min-w-0 w-full flex-col">
      <div className="game-carousel-tabs sticky top-0 z-10 shrink-0 pb-1 bg-[var(--color-bg-primary)]">
        <CardTabs count={cards.length} activeIndex={activeIndex} onSelect={scrollToCard} dabs={dabs} />
      </div>

      {/* Scrollable card container */}
      <div
        ref={scrollRef}
        className="flex min-w-0 w-full overflow-x-auto snap-x snap-mandatory scrollbar-none"
        onScroll={handleScroll}
        onTouchStart={() => { touchingRef.current = true; }}
        onTouchEnd={() => { touchingRef.current = false; handleScroll(); }}
        onTouchCancel={() => { touchingRef.current = false; handleScroll(); }}
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {cards.map((card, i) => (
          <div key={card.id} inert={i !== activeIndex} aria-hidden={i !== activeIndex} className="snap-center flex-shrink-0 min-w-0 w-full flex items-start justify-center">
            <div className="min-w-0 w-full" style={cardMaxWidth !== undefined && Number.isFinite(cardMaxWidth) ? { maxWidth: Math.max(0, cardMaxWidth) } : undefined}>
              {variant === "75" ? (
                <BingoCard
                  card={card as BingoCard75}
                  dabs={dabs[i] ?? new Set()}
                  onDab={(cellIndex) => onDab(i, cellIndex)}
                  blockedCells={blockedCells?.[i]}
                  wildCells={wildCells?.[i]}
                  targetableCells={targetableCells?.[i]}
                  disabled={disabled}
                  currentNumber={currentNumber}
                  calledNumbers={calledNumbers}
                  winningCells={progress?.[i]?.winningCells}
                  nearWinCells={progress?.[i]?.nearWinCells}
                />
              ) : (
                <BingoCard90
                  card={card as BingoCard90Type}
                  dabs={dabs[i] ?? new Set()}
                  onDab={(cellIndex) => onDab(i, cellIndex)}
                  blockedCells={blockedCells?.[i]}
                  wildCells={wildCells?.[i]}
                  targetableCells={targetableCells?.[i]}
                  disabled={disabled}
                  currentNumber={currentNumber}
                  calledNumbers={calledNumbers}
                  winningCells={progress?.[i]?.winningCells}
                  nearWinCells={progress?.[i]?.nearWinCells}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

