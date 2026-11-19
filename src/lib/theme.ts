import type { Theme } from './storage';

const THEME_COLORS: Record<Theme, string> = { light: '#f4f5f7', dark: '#0e1014' };

export function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Reflect the theme on <html>. `null` removes the override so CSS follows the system.
 * Kept in sync with the pre-paint script in index.html.
 */
export function applyTheme(theme: Theme | null): void {
  const root = document.documentElement;
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;

  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    // Restore each tag's own colour (they carry prefers-color-scheme media queries).
    const own = meta.media.includes('dark') ? THEME_COLORS.dark : THEME_COLORS.light;
    meta.content = theme ? THEME_COLORS[theme] : own;
  });
}

/** The theme a click on the toggle should switch to. */
export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark';
}
