interface CardLayoutOptions {
  width: number;
  height: number;
  count: number;
  variant: "75" | "90";
  headerHeight: number;
}

/** Match the rendered columns, but prefer scrolling over shrinking tap targets. */
export function getCardLayout({ width, height, count, variant, headerHeight }: CardLayoutOptions) {
  const gap = 4;
  const minimumCardWidth = variant === "75" ? 150 : 324;
  const columns = count > 1 && width >= minimumCardWidth * 2 + gap ? 2 : 1;
  const availableWidth = Math.max(0, (width - gap * (columns - 1)) / columns);
  const rows = Math.ceil(Math.max(1, count) / columns);
  const labelHeight = count > 1 ? 28 : 0;
  const availableHeight = (height - gap * (rows - 1)) / rows - labelHeight;
  const widthFromHeight = variant === "75"
    ? availableHeight - headerHeight
    : availableHeight * 3;
  const cardWidth = columns === 1 && count > 1 ? Math.min(availableWidth, 420) : Math.min(
    availableWidth,
    Math.max(Math.min(minimumCardWidth, availableWidth), Math.min(widthFromHeight, 420)),
  );

  return { columns, maxWidth: cardWidth * columns + gap * (columns - 1) };
}
