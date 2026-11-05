interface CardLayoutOptions {
  width: number;
  height: number;
  count: number;
  variant: "75" | "90";
  headerHeight?: number;
}

/** Mirrors the fluid 75-ball header, including its container padding steps. */
export function getCardHeaderHeight(width: number) {
  const contentWidth = Math.max(0, width - 2);
  const fontSize = Math.min(32, Math.max(14, contentWidth * 0.048));
  const padding = contentWidth >= 350 ? 24 : contentWidth >= 250 ? 18 : 14;
  return fontSize * 1.15 + padding + 2;
}

/** Use the largest readable cards that fit the available board area. */
export function getCardLayout({ width, height, count, variant, headerHeight }: CardLayoutOptions) {
  // Keep this in sync with the rendered grid gap in GameView.
  const gap = 8;
  // At 148px, a compact 75-ball card has five 24px cells after its 28px
  // padding/gaps. A 90-ball ticket needs more width for its nine columns.
  const minimumCardWidth = variant === "75" ? 148 : 324;
  const availableWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const availableHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
  const cards = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
  const fixedHeader = headerHeight !== undefined && Number.isFinite(headerHeight)
    ? Math.max(0, headerHeight) : undefined;
  const labelHeight = cards > 1 ? 28 : 0;
  const maxColumns = Math.max(1, Math.min(cards,
    Math.floor((availableWidth + gap) / (minimumCardWidth + gap))));
  const minimumWidth = Math.min(minimumCardWidth, availableWidth);
  let best: { columns: number; rows: number; cardWidth: number } | undefined;

  for (let columns = 1; columns <= maxColumns; columns++) {
    const rows = Math.ceil(cards / columns);
    const widthPerCard = Math.max(0, (availableWidth - gap * (columns - 1)) / columns);
    const heightPerCard = (availableHeight - gap * (rows - 1)) / rows - labelHeight;
    // 90-ball's three rows retain 44px hit-area heights. Below 160px body
    // height the tickets scroll instead of pretending they can fit vertically.
    if (variant === "90" && heightPerCard < 160) continue;
    let cardWidth = Math.min(widthPerCard, (heightPerCard - 7) * 3);
    if (variant === "75") {
      if (fixedHeader !== undefined) cardWidth = Math.min(widthPerCard, heightPerCard - fixedHeader);
      else {
        // Solve against each candidate's own header. Measuring a rendered
        // header here feeds width-dependent padding back into ResizeObserver.
        let low = 0;
        let high = widthPerCard;
        for (let step = 0; step < 24; step++) {
          const candidate = (low + high) / 2;
          if (candidate + getCardHeaderHeight(candidate) <= heightPerCard) low = candidate;
          else high = candidate;
        }
        cardWidth = Math.floor(low * 100) / 100;
      }
    }
    if (cardWidth < minimumWidth) continue;
    if (!best || cardWidth > best.cardWidth + 0.5
      || (Math.abs(cardWidth - best.cardWidth) <= 0.5 && rows < best.rows)) {
      best = { columns, rows, cardWidth };
    }
  }

  if (best) {
    return { columns: best.columns, maxWidth: Math.min(availableWidth,
      best.cardWidth * best.columns + gap * (best.columns - 1)) };
  }

  // On short screens, keep one readable row when every card fits across.
  // Otherwise use at most two columns and let the board scroll vertically.
  const columns = maxColumns >= cards ? cards : Math.min(maxColumns, 2);
  return { columns, maxWidth: availableWidth };
}
