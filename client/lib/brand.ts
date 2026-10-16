/**
 * Brand colour system.
 *
 * The shop's `settings.primaryColor` can be a legacy preset name ("pink") or a
 * hex value ("#FF5A79"). Whichever it is, we normalise it to a hex, derive the
 * light/dark brand tokens the design system expects, and write them onto the
 * document root so every `brand`-prefixed Tailwind utility follows along.
 *
 * The derived token map is also cached in localStorage so the pre-paint script
 * in `app/layout.tsx` can restore the chosen colour before first paint.
 */

export const BRAND_CACHE_KEY = "amare.brand.vars.v2";

export const DEFAULT_BRAND = "#FF5A79";

/** Legacy preset names that older settings documents may still use. */
const PRESET_MAP: Record<string, string> = {
  pink: "#FF5A79",
  rose: "#F43F5E",
  red: "#EF4444",
  orange: "#F97316",
  amber: "#F59E0B",
  yellow: "#EAB308",
  lime: "#84CC16",
  green: "#22C55E",
  emerald: "#10B981",
  teal: "#14B8A6",
  cyan: "#06B6D4",
  sky: "#0EA5E9",
  blue: "#4A90E2",
  indigo: "#6366F1",
  violet: "#8B5CF6",
  purple: "#9333EA",
  fuchsia: "#D946EF",
  slate: "#64748B",
};

/** Curated swatches offered in Settings. */
export const PRESET_COLORS = [
  "#FF5A79", "#F43F5E", "#EF4444", "#DC2626",
  "#FB7185", "#F97316", "#EA580C", "#FB923C",
  "#F59E0B", "#EAB308", "#FBBF24",
  "#84CC16", "#65A30D", "#22C55E", "#16A34A",
  "#059669", "#10B981", "#14B8A6", "#0D9488",
  "#0EA5E9", "#06B6D4", "#0891B2", "#0284C7",
  "#3B82F6", "#4A90E2", "#2563EB", "#1D4ED8",
  "#6366F1", "#4F46E5", "#4338CA",
  "#7C3AED", "#8B5CF6", "#9333EA", "#A855F7",
  "#D946EF", "#C026D3", "#DB2777", "#E11D48",
  "#FF6B9D", "#FFA07A", "#FFB347", "#FFD700",
  "#7ED957", "#4ADE80", "#34D399", "#38BDF8",
  "#64748B", "#475569", "#334155", "#0F172A",
];

type Rgb = [number, number, number];

export function isValidHex(value: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

function ensureHash(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

/** Accepts a preset name or hex and always returns a `#rrggbb` string. */
export function normalizePrimaryColor(value?: string | null): string {
  if (!value) return DEFAULT_BRAND;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_BRAND;
  if (isValidHex(trimmed)) return expandHex(ensureHash(trimmed));
  return PRESET_MAP[trimmed.toLowerCase()] ?? DEFAULT_BRAND;
}

function expandHex(hex: string): string {
  const body = hex.slice(1);
  if (body.length === 3) {
    return `#${body
      .split("")
      .map((char) => char + char)
      .join("")}`;
  }
  return `#${body}`;
}

function hexToRgb(hex: string): Rgb {
  const body = expandHex(ensureHash(hex)).slice(1);
  const int = parseInt(body, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb: Rgb;
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = ln - c / 2;
  return rgb.map((value) => Math.round((value + m) * 255)) as Rgb;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function hexToHsl(hex: string): Hsl {
  const [r255, g255, b255] = hexToRgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Picks white or near-black for text sitting on the given colour. */
function bestForeground(rgb: Rgb): string {
  // Prefer white; switch to near-black only on genuinely light fills (amber,
  // lime, pastels) where white would lose too much contrast.
  return luminance(rgb) > 0.5 ? "#141018" : "#ffffff";
}

/** The accent lightness used for both themes, matching HeroUI's default. */
const ACCENT_LIGHTNESS = 58;

/**
 * Derives the HeroUI accent tokens for a colour. HeroUI keeps `--accent`
 * constant across light and dark, deriving hover/soft variants with
 * `color-mix()` — so a single pair of values is all we need to set.
 */
export function brandVariables(hex: string): Record<string, string> {
  const base = normalizePrimaryColor(hex);
  const { h, s } = hexToHsl(base);
  const sat = Math.round(Math.min(100, Math.max(45, s)));

  return {
    "--accent": `hsl(${h.toFixed(1)} ${sat}% ${ACCENT_LIGHTNESS}%)`,
    "--accent-foreground": bestForeground(hslToRgb(h, sat, ACCENT_LIGHTNESS)),
  };
}

/** Writes the derived tokens onto the root element and caches them. */
export function applyBrand(primaryColor?: string | null): void {
  if (typeof document === "undefined") return;
  const variables = brandVariables(normalizePrimaryColor(primaryColor));
  const root = document.documentElement;
  for (const [key, value] of Object.entries(variables)) {
    root.style.setProperty(key, value);
  }
  try {
    window.localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(variables));
  } catch {
    /* storage can be unavailable in private mode */
  }
}

/** The best foreground colour for text on the brand fill (used for previews). */
export function brandForeground(hex: string): string {
  const base = normalizePrimaryColor(hex);
  const { h, s } = hexToHsl(base);
  const sat = Math.round(Math.min(100, Math.max(45, s)));
  return bestForeground(hslToRgb(h, sat, ACCENT_LIGHTNESS));
}
