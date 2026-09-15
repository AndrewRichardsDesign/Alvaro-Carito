import type { SectionStyle, ThemeContent } from '@/content/types';

/**
 * The theme is applied as CSS custom properties rather than Tailwind classes,
 * so the couple can repaint the entire site from the admin panel and see it
 * happen live — no rebuild, no class regeneration.
 */

/** "#9a7d60" → "154 125 96", the channel form Tailwind's `/opacity` needs. */
export function hexToChannels(hex: string): string | null {
  const clean = hex.trim().replace(/^#/, '');
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean.length === 6
        ? clean
        : null;
  if (!full || !/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Relative luminance, used to pick legible text over an arbitrary colour. */
export function isLight(hex: string): boolean {
  const channels = hexToChannels(hex);
  if (!channels) return true;
  const [r, g, b] = channels.split(' ').map(Number).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45;
}

const COLOR_VARS: Record<keyof ThemeContent['colors'], string> = {
  canvas: '--ac-canvas',
  surface: '--ac-surface',
  ink: '--ac-ink',
  display: '--ac-display',
  muted: '--ac-muted',
  accent: '--ac-accent',
  accentInk: '--ac-accent-ink',
  line: '--ac-line',
};

/** The `:root` declarations for a theme. */
export function themeCss(theme: ThemeContent): string {
  const lines: string[] = [];
  for (const [key, variable] of Object.entries(COLOR_VARS) as [keyof ThemeContent['colors'], string][]) {
    const channels = hexToChannels(theme.colors[key]);
    if (channels) lines.push(`${variable}: ${channels};`);
  }
  lines.push(`--ac-font-display: '${theme.fonts.display.replace(/'/g, '')}';`);
  lines.push(`--ac-font-body: '${theme.fonts.body.replace(/'/g, '')}';`);
  lines.push(`--ac-display-scale: ${theme.displayScale || 1};`);
  lines.push(`--radius: ${theme.radius ?? 0.75}rem;`);
  return `:root{${lines.join('')}}`;
}

/** Per-section colour overrides, emitted as a scoped variable block. */
export function sectionVars(style: SectionStyle): React.CSSProperties {
  const vars: Record<string, string> = {};
  const set = (name: string, hex: string) => {
    const channels = hex ? hexToChannels(hex) : null;
    if (channels) vars[name] = channels;
  };
  set('--ac-canvas', style.bg);
  set('--ac-surface', style.bg ? shade(style.bg, isLight(style.bg) ? 1.03 : 1.25) : '');
  set('--ac-ink', style.ink);
  set('--ac-display', style.display);
  set('--ac-accent', style.accent);
  // A section on a dark background needs its hairlines lightened, not darkened.
  if (style.bg) set('--ac-line', shade(style.bg, isLight(style.bg) ? 0.9 : 1.6));
  if (style.bg && !style.ink) set('--ac-ink', isLight(style.bg) ? '#3d3730' : '#d8d1c7');
  if (style.bg && !style.display) set('--ac-display', isLight(style.bg) ? '#231f1b' : '#faf7f2');
  if (style.bg && !style.ink) set('--ac-muted', isLight(style.bg) ? '#8a8074' : '#a79d90');
  return vars as React.CSSProperties;
}

/** Lighten (>1) or darken (<1) a hex colour. */
export function shade(hex: string, factor: number): string {
  const channels = hexToChannels(hex);
  if (!channels) return hex;
  const parts = channels.split(' ').map((v) => {
    const next = Math.round(Number(v) * factor);
    return Math.max(0, Math.min(255, next));
  });
  return `#${parts.map((p) => p.toString(16).padStart(2, '0')).join('')}`;
}

/** Fonts offered in the theme editor. All are on Google Fonts. */
export const DISPLAY_FONTS = [
  'Cormorant Garamond',
  'Playfair Display',
  'EB Garamond',
  'Libre Baskerville',
  'Lora',
  'Marcellus',
  'Italiana',
  'Gilda Display',
  'Tenor Sans',
  'Jost',
];

export const BODY_FONTS = [
  'Jost',
  'Inter',
  'Karla',
  'Lato',
  'Montserrat',
  'Mulish',
  'Nunito Sans',
  'Work Sans',
  'Cormorant Garamond',
  'EB Garamond',
];

/** The Google Fonts stylesheet URL for the two families in play. */
export function fontHref(display: string, body: string): string {
  const families = Array.from(new Set([display, body].filter(Boolean)));
  const params = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@300;400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
}

/** Ready-made palettes, so "make it warmer" is one click rather than eight. */
export const PALETTES: { name: string; colors: ThemeContent['colors'] }[] = [
  {
    name: 'Bone & bronze',
    colors: { canvas: '#f6f2ec', surface: '#fffdfa', ink: '#3d3730', display: '#231f1b', muted: '#8a8074', accent: '#9a7d60', accentInk: '#ffffff', line: '#dfd6ca' },
  },
  {
    name: 'Sage garden',
    colors: { canvas: '#f3f5f0', surface: '#fbfcf9', ink: '#3a423a', display: '#1f261f', muted: '#7d887b', accent: '#6f8b6a', accentInk: '#ffffff', line: '#d8ded3' },
  },
  {
    name: 'Blush & ivory',
    colors: { canvas: '#faf4f2', surface: '#fffcfb', ink: '#463a38', display: '#2a2120', muted: '#93807c', accent: '#c08878', accentInk: '#ffffff', line: '#ead9d4' },
  },
  {
    name: 'Midnight & gold',
    colors: { canvas: '#14161c', surface: '#1c1f27', ink: '#c5c8d2', display: '#f4f1ea', muted: '#8d92a1', accent: '#c9a227', accentInk: '#14161c', line: '#2c303b' },
  },
  {
    name: 'Coastal blue',
    colors: { canvas: '#f2f5f7', surface: '#fbfcfd', ink: '#374450', display: '#1c2630', muted: '#78899a', accent: '#4a7b93', accentInk: '#ffffff', line: '#d5dee5' },
  },
  {
    name: 'Terracotta',
    colors: { canvas: '#faf3ea', surface: '#fffbf5', ink: '#463b30', display: '#2b231b', muted: '#8f8071', accent: '#b5603f', accentInk: '#ffffff', line: '#e8d9c6' },
  },
];
