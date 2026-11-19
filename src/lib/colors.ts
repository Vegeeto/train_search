const FALLBACK = '#6b7280';

/** `"3dbfc3"` / `"#3DBFC3"` → `"#3dbfc3"`; anything else → neutral grey. */
export function normalizeColor(value: string | null | undefined): string {
  const hex = value?.trim().replace(/^#/, '') ?? '';
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toLowerCase()}` : FALLBACK;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/**
 * Pick black or white text for a line colour. The feed's own `route_text_color` is
 * white even on light colours such as R6 `#b3b3b3`, which fails contrast.
 */
export function readableTextColor(background: string): string {
  const l = luminance(normalizeColor(background));
  const contrastWhite = 1.05 / (l + 0.05);
  const contrastBlack = (l + 0.05) / 0.05;
  return contrastWhite >= contrastBlack ? '#ffffff' : '#111111';
}
