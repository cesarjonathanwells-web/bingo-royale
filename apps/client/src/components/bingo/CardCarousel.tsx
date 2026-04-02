import { useRef, useCallback, useEffect } from "react";
import type {
  BingoCard as BingoCardType,
  BingoCard75,
  BingoCard90 as BingoCard90Type,
} from "@bingo/shared";
import { BingoCard } from "./BingoCard";
import { BingoCard90 } from "./BingoCard90";
import { cn } from "@/lib/utils";

interface CardCarouselProps {
  cards: BingoCardType[];
  dabs: Set<number>[];
  variant: "75" | "90";
  onDab: (cardIndex: number, cellIndex: number) => void;
  activeIndex: number;
  onIndexChange: (index: number) => void;
}

export function CardCarousel({
  cards,
  dabs,
  variant,
  onDab,
  activeIndex,
  onIndexChange,
}: CardCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingProgrammatically = useRef(false);

  const scrollToCard = useCallback(
    (index: number) => {
      const container = scrollRef.current;
      if (!container) return;
      const cardWidth = container.offsetWidth;
      isScrollingProgrammatically.current = true;
      container.scrollTo({ left: cardWidth * index, behavior: "smooth" });
      onIndexChange(index);
      // Reset the flag after the scroll animation completes
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 400);
    },
    [onIndexChange],
  );

  const handleScroll = useCallback(() => {
    if (isScrollingProgrammatically.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const cardWidth = container.offsetWidth;
    if (cardWidth === 0) return;
    const newIndex = Math.round(container.scrollLeft / cardWidth);
    const clampedIndex = Math.max(0, Math.min(newIndex, cards.length - 1));
    if (clampedIndex !== activeIndex) {
      onIndexChange(clampedIndex);
    }
  }, [activeIndex, cards.length, onIndexChange]);

  // Sync scroll position when activeIndex changes externally (e.g. dot tap)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const cardWidth = container.offsetWidth;
    const expectedLeft = cardWidth * activeIndex;
    const currentLeft = container.scrollLeft;
    // Only scroll if we're not already near the right position
    if (Math.abs(currentLeft - expectedLeft) > 5) {
      isScrollingProgrammatically.current = true;
      container.scrollTo({ left: expectedLeft, behavior: "smooth" });
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 400);
    }
  }, [activeIndex]);

  return (
    <div className="w-full">
      {/* Dot indicators */}
      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToCard(i)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                "min-w-[44px] min-h-[44px] flex items-center justify-center",
                "bg-transparent",
              )}
              aria-label={`Card ${i + 1}`}
            >
              <span
                className={cn(
                  "block w-2.5 h-2.5 rounded-full transition-colors",
                  i === activeIndex
                    ? "bg-[var(--color-accent)]"
                    : "bg-[var(--color-bg-tertiary)]",
                )}
              />
            </button>
          ))}
        </div>
      )}

      {/* Scrollable card container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
        onScroll={handleScroll}
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {cards.map((card, i) => (
          <div key={i} className="snap-center flex-shrink-0 w-full px-2 flex items-center justify-center">
            <div className="w-full max-w-[calc(100vw-1rem)] sm:max-w-[380px] lg:max-w-[420px] max-h-full">
              {variant === "75" ? (
                <BingoCard
                  card={card as BingoCard75}
                  dabs={dabs[i] ?? new Set()}
                  onDab={(cellIndex) => onDab(i, cellIndex)}
                  className="max-h-full"
                />
              ) : (
                <BingoCard90
                  card={card as BingoCard90Type}
                  dabs={dabs[i] ?? new Set()}
                  onDab={(cellIndex) => onDab(i, cellIndex)}
                  className="max-h-full"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
