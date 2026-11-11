/**
 * Custom themes — created in Settings, stored ONLY in this browser's
 * localStorage (never sent to the database).
 *
 * The user picks four colours (background, cards, text, accent) and a corner
 * radius. Everything else (chips, borders, muted text, hover, destructive,
 * charts, sidebar…) is derived so that it keeps a readable contrast.
 */
import { useSyncExternalStore } from "react";

export type ThemeMode = "dark" | "light";

export type CustomTheme = {
  id: string;
  name: string;
  mode: ThemeMode;
  bg: string;
  surface: string;
  text: string;
  primary: string;
  /** corner radius in rem */
  radius: number;
  /** optional advanced overrides */
  chip?: string | undefined;
  muted?: string | undefined;
  border?: string | undefined;
};

export const RADIUS_CHOICES: { label: string; value: number }[] = [
  { label: "Sharp", value: 0.375 },
  { label: "Soft", value: 0.625 },
  { label: "Round", value: 0.875 },
  { label: "Pill", value: 1.25 },
];

/* ---------------------------------------------------------------- colour */

const HEX = /^#[0-9a-fA-F]{6}$/;
export const isHex = (v: unknown): v is string =>
  typeof v === "string" && HEX.test(v);

type RGB = [number, number, number];

function hexToRgb(h: string): RGB {
  return [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
}
const toLin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const toGamma = (x: number) =>
  x <= 0.0031308 ? 12.92 * x : 1.055 * Math.max(x, 0) ** (1 / 2.4) - 0.055;

function luminance(h: string): number {
  const [r, g, b] = hexToRgb(h);
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function toOklch(h: string): [number, number, number] {
  const [r, g, b] = hexToRgb(h).map(toLin) as RGB;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const H = (Math.atan2(bb, a) * 180) / Math.PI;
  return [L, Math.hypot(a, bb), (H + 360) % 360];
}

function oklchToLinear(L: number, C: number, H: number): RGB {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function fromOklch(L: number, C: number, H: number): string {
  const lightness = Math.min(1, Math.max(0, L));
  let chroma = Math.max(0, C);
  let lin = oklchToLinear(lightness, chroma, H);
  // Pull chroma in until the colour fits inside sRGB.
  for (let i = 0; i < 24 && lin.some((v) => v < -0.0004 || v > 1.0004); i++) {
    chroma *= 0.92;
    lin = oklchToLinear(lightness, chroma, H);
  }
  return (
    "#" +
    lin
      .map((v) =>
        Math.round(255 * Math.min(1, Math.max(0, toGamma(v))))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

function shiftL(h: string, dL: number): string {
  const [L, C, H] = toOklch(h);
  return fromOklch(L + dL, C, H);
}

function retint(h: string, minChroma: number): string {
  const [L, C, H] = toOklch(h);
  return fromOklch(L, Math.max(C, minChroma), H);
}

function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round((A[i] ?? 0) + ((B[i] ?? 0) - (A[i] ?? 0)) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** Move a colour's lightness in `dir` until `ok(colour)` is true. */
function nudge(
  h: string,
  dir: 1 | -1,
  ok: (c: string) => boolean,
  step = 0.004,
  limit = 0.9,
): string {
  let c = h;
  for (let moved = 0; !ok(c) && moved < limit; moved += step) {
    c = shiftL(c, dir * step);
  }
  return c;
}

function bestInk(on: string, candidates: string[]): string {
  return candidates.reduce((best, c) =>
    contrastRatio(c, on) > contrastRatio(best, on) ? c : best,
  );
}

const css = (hex: string): string => {
  const [L, C, H] = toOklch(hex);
  return C < 0.004
    ? `oklch(${L.toFixed(3)} 0 0)`
    : `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${Math.round(H)})`;
};

/* ---------------------------------------------------------------- derive */

export type ContrastCheck = {
  id: string;
  label: string;
  hint: string;
  ratio: number;
  min: number;
  pass: boolean;
};

export type Derived = {
  vars: Record<string, string>;
  checks: ContrastCheck[];
  swatch: [string, string, string];
  css: string;
  bg: string;
  chip: string;
  muted: string;
  border: string;
};

export function deriveTheme(t: CustomTheme): Derived {
  const dark = t.mode === "dark";
  const dir: 1 | -1 = dark ? 1 : -1; // direction that moves away from the surface
  const { bg, surface, text, primary } = t;

  const chip =
    t.chip ??
    nudge(retint(surface, 0.014), dir, (c) => contrastRatio(c, surface) >= 1.26);
  const border =
    t.border ?? nudge(surface, dir, (c) => contrastRatio(c, surface) >= 1.32);
  const input = nudge(border, dir, (c) => contrastRatio(c, surface) >= 1.5);
  const surface2 = mixHex(surface, chip, 0.55);

  let muted = t.muted;
  if (!muted) {
    muted = text;
    for (let k = 0.5; k >= 0; k -= 0.03) {
      const c = mixHex(text, bg, k);
      if (contrastRatio(c, chip) >= 4.6 && contrastRatio(c, bg) >= 4.6) {
        muted = c;
        break;
      }
    }
  }

  const hover = nudge(
    mixHex(chip, primary, 0.12),
    dir,
    (c) => contrastRatio(c, surface) >= 1.28,
  );
  const primaryFg = bestInk(primary, [bg, "#ffffff", "#000000"]);

  const destructive = nudge(
    "#e5484d",
    dark ? 1 : -1,
    (c) => contrastRatio(c, surface) >= 4.5,
  );
  const destructiveFg = bestInk(destructive, ["#ffffff", "#000000", bg]);
  const success = nudge(
    dark ? "#7de1ab" : "#1f8a5b",
    dark ? 1 : -1,
    (c) => contrastRatio(c, surface) >= 4.5,
  );
  const successFg = bestInk(success, ["#ffffff", "#000000", bg]);
  const warning = nudge(
    dark ? "#f0b84f" : "#b87400",
    dark ? 1 : -1,
    (c) => contrastRatio(c, surface) >= 4.5,
  );
  const warningFg = bestInk(warning, ["#ffffff", "#000000", bg]);

  const [pL, pC, pH] = toOklch(primary);
  const chartL = dark ? Math.max(0.7, pL) : Math.min(0.58, pL);
  const charts = [0, 72, 144, 216, 288].map((rot) =>
    rot === 0
      ? primary
      : nudge(
          fromOklch(chartL, Math.max(0.11, pC), (pH + rot) % 360),
          dark ? 1 : -1,
          (c) => contrastRatio(c, surface) >= 3,
        ),
  );

  const sidebarAccentFg =
    contrastRatio(primary, chip) >= 4.5 ? primary : text;

  const vars: Record<string, string> = {
    radius: `${t.radius}rem`,
    background: css(bg),
    foreground: css(text),
    surface: css(surface),
    "surface-2": css(surface2),
    card: css(surface),
    "card-foreground": css(text),
    popover: css(surface),
    "popover-foreground": css(text),
    primary: css(primary),
    "primary-foreground": css(primaryFg),
    secondary: css(chip),
    "secondary-foreground": css(text),
    muted: css(chip),
    "muted-foreground": css(muted),
    accent: css(hover),
    "accent-foreground": css(text),
    destructive: css(destructive),
    "destructive-foreground": css(destructiveFg),
    success: css(success),
    "success-foreground": css(successFg),
    warning: css(warning),
    "warning-foreground": css(warningFg),
    border: css(border),
    input: css(input),
    ring: css(primary),
    "chart-1": css(charts[0] ?? primary),
    "chart-2": css(charts[1] ?? primary),
    "chart-3": css(charts[2] ?? primary),
    "chart-4": css(charts[3] ?? primary),
    "chart-5": css(charts[4] ?? primary),
    sidebar: css(surface),
    "sidebar-foreground": css(text),
    "sidebar-primary": css(primary),
    "sidebar-primary-foreground": css(primaryFg),
    "sidebar-accent": css(chip),
    "sidebar-accent-foreground": css(sidebarAccentFg),
    "sidebar-border": css(border),
    "sidebar-ring": css(primary),
  };

  const mk = (
    id: string,
    label: string,
    hint: string,
    a: string,
    b: string,
    min: number,
  ): ContrastCheck => {
    const ratio = contrastRatio(a, b);
    return { id, label, hint, ratio, min, pass: ratio >= min - 0.005 };
  };
  const checks = [
    mk("text-bg", "Text on background", "Body text", text, bg, 4.5),
    mk("text-card", "Text on cards", "Titles and labels", text, surface, 4.5),
    mk("muted-chip", "Muted text on chips", "Captions, hints", muted, chip, 4.5),
    mk("btn", "Button text on accent", "Primary buttons", primaryFg, primary, 4.5),
    mk("accent-card", "Accent on cards", "Links, icons, focus ring", primary, surface, 3),
    mk("chip-card", "Chips stand out from cards", "Icon backgrounds, tags", chip, surface, 1.2),
    mk("border-card", "Borders visible on cards", "Dividers, inputs", border, surface, 1.3),
  ];

  const cssText = `html[data-theme="custom"]{${Object.entries(vars)
    .map(([k, v]) => `--${k}:${v}`)
    .join(";")}}`;

  return { vars, checks, swatch: [bg, surface, primary], css: cssText, bg, chip, muted, border };
}

/** Nudge text and accent just enough to meet the thresholds. */
export function autoFixTheme(t: CustomTheme): CustomTheme {
  const dir: 1 | -1 = t.mode === "dark" ? 1 : -1;
  const chip = deriveTheme({ ...t, chip: t.chip }).chip;
  const text = nudge(
    t.text,
    dir,
    (c) =>
      contrastRatio(c, t.bg) >= 4.5 &&
      contrastRatio(c, t.surface) >= 4.5 &&
      contrastRatio(c, chip) >= 4.6,
  );
  const primary = nudge(
    t.primary,
    dir,
    (c) => contrastRatio(c, t.surface) >= 3 && contrastRatio(c, t.bg) >= 3,
  );
  return { ...t, text, primary, muted: undefined, chip: t.chip, border: t.border };
}

/* --------------------------------------------------------------- storage */

const THEMES_KEY = "koka:custom-themes";
const ACTIVE_KEY = "koka:custom-active";
const CSS_KEY = (m: ThemeMode) => `koka:custom-css:${m}`;
const BG_KEY = (m: ThemeMode) => `koka:custom-bg:${m}`;
const STYLE_ID = "koka-custom-theme";
const MAX_THEMES = 24;

type Active = { dark: string | null; light: string | null };
type Snapshot = { themes: CustomTheme[]; active: Active };

const EMPTY: Snapshot = { themes: [], active: { dark: null, light: null } };
let snapshot: Snapshot = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function sanitizeTheme(raw: unknown): CustomTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    !isHex(r["bg"]) ||
    !isHex(r["surface"]) ||
    !isHex(r["text"]) ||
    !isHex(r["primary"])
  ) {
    return null;
  }
  const mode: ThemeMode = r["mode"] === "light" ? "light" : "dark";
  const radius =
    typeof r["radius"] === "number" && r["radius"] >= 0 && r["radius"] <= 2
      ? r["radius"]
      : 0.75;
  const name =
    typeof r["name"] === "string" && r["name"].trim()
      ? r["name"].trim().slice(0, 40)
      : "Custom theme";
  const id =
    typeof r["id"] === "string" && /^[a-z0-9-]{4,40}$/.test(r["id"])
      ? r["id"]
      : newId();
  return {
    id,
    name,
    mode,
    bg: r["bg"].toLowerCase(),
    surface: r["surface"].toLowerCase(),
    text: r["text"].toLowerCase(),
    primary: r["primary"].toLowerCase(),
    radius,
    chip: isHex(r["chip"]) ? r["chip"].toLowerCase() : undefined,
    muted: isHex(r["muted"]) ? r["muted"].toLowerCase() : undefined,
    border: isHex(r["border"]) ? r["border"].toLowerCase() : undefined,
  };
}

export function newId(): string {
  return `t-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

function read(): Snapshot {
  try {
    const rawThemes = JSON.parse(localStorage.getItem(THEMES_KEY) ?? "[]") as unknown;
    const themes = (Array.isArray(rawThemes) ? rawThemes : [])
      .map(sanitizeTheme)
      .filter((x): x is CustomTheme => x !== null)
      .slice(0, MAX_THEMES);
    const rawActive = JSON.parse(localStorage.getItem(ACTIVE_KEY) ?? "{}") as Partial<Active>;
    const has = (id: unknown) => typeof id === "string" && themes.some((t) => t.id === id);
    return {
      themes,
      active: {
        dark: has(rawActive.dark) ? (rawActive.dark as string) : null,
        light: has(rawActive.light) ? (rawActive.light as string) : null,
      },
    };
  } catch {
    return EMPTY;
  }
}

function ensureLoaded(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  snapshot = read();
}

function activeTheme(mode: ThemeMode): CustomTheme | null {
  ensureLoaded();
  const id = snapshot.active[mode];
  return snapshot.themes.find((t) => t.id === id && t.mode === mode) ?? null;
}

/** Apply (or remove) the active custom theme for a mode. Returns true if applied. */
export function applyActiveCustomTheme(dark: boolean): boolean {
  if (typeof document === "undefined") return false;
  const theme = activeTheme(dark ? "dark" : "light");
  const existing = document.getElementById(STYLE_ID);
  if (!theme) {
    existing?.remove();
    return false;
  }
  const derived = deriveTheme(theme);
  const el = existing ?? document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = derived.css;
  if (!existing) document.head.appendChild(el);
  document.documentElement.dataset["theme"] = "custom";
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = derived.bg;
  return true;
}

function persist(): void {
  try {
    localStorage.setItem(THEMES_KEY, JSON.stringify(snapshot.themes));
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(snapshot.active));
    // Pre-built CSS so the boot script can theme the page before React loads.
    (["dark", "light"] as const).forEach((m) => {
      const t = activeTheme(m);
      if (t) {
        const d = deriveTheme(t);
        localStorage.setItem(CSS_KEY(m), d.css);
        localStorage.setItem(BG_KEY(m), d.bg);
      } else {
        localStorage.removeItem(CSS_KEY(m));
        localStorage.removeItem(BG_KEY(m));
      }
    });
  } catch {
    /* storage full / private mode: themes just won't persist */
  }
}

function commit(next: Snapshot, reapply: boolean): void {
  snapshot = next;
  persist();
  listeners.forEach((l) => l());
  if (reapply && typeof document !== "undefined") {
    const dark = document.documentElement.classList.contains("dark");
    if (!applyActiveCustomTheme(dark)) {
      // Fall back to the built-in preset the app has selected.
      window.dispatchEvent(new Event("koka:theme-reapply"));
    }
  }
}

export function saveCustomTheme(theme: CustomTheme): void {
  ensureLoaded();
  const clean = sanitizeTheme(theme);
  if (!clean) return;
  const exists = snapshot.themes.some((t) => t.id === clean.id);
  const themes = exists
    ? snapshot.themes.map((t) => (t.id === clean.id ? clean : t))
    : [...snapshot.themes, clean].slice(0, MAX_THEMES);
  // If the edited theme changed mode, drop stale active pointers.
  const active: Active = { ...snapshot.active };
  (["dark", "light"] as const).forEach((m) => {
    if (active[m] === clean.id && clean.mode !== m) active[m] = null;
  });
  commit({ themes, active }, true);
}

export function deleteCustomTheme(id: string): void {
  ensureLoaded();
  const active: Active = {
    dark: snapshot.active.dark === id ? null : snapshot.active.dark,
    light: snapshot.active.light === id ? null : snapshot.active.light,
  };
  commit({ themes: snapshot.themes.filter((t) => t.id !== id), active }, true);
}

export function setActiveCustomTheme(mode: ThemeMode, id: string | null): void {
  ensureLoaded();
  commit({ ...snapshot, active: { ...snapshot.active, [mode]: id } }, true);
}

export function exportCustomTheme(t: CustomTheme): string {
  const { id: _id, ...rest } = t;
  void _id;
  return JSON.stringify({ koka: "theme", v: 1, ...rest });
}

export function parseCustomTheme(text: string): CustomTheme | null {
  try {
    const raw = JSON.parse(text.trim()) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const withoutId = { ...(raw as Record<string, unknown>), id: newId() };
    return sanitizeTheme(withoutId);
  } catch {
    return null;
  }
}

export function useCustomThemes(): Snapshot {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      ensureLoaded();
      return snapshot;
    },
    () => EMPTY,
  );
}

/** Read the four base colours of whatever theme is showing right now. */
export function readCurrentThemeColors(): Pick<
  CustomTheme,
  "bg" | "surface" | "text" | "primary" | "mode"
> {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const ctx = document.createElement("canvas").getContext("2d");
  const toHex = (name: string, fallback: string): string => {
    const raw = cs.getPropertyValue(name).trim();
    if (!raw || !ctx) return fallback;
    try {
      ctx.fillStyle = "#010203";
      ctx.fillStyle = raw;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return (
        "#" +
        [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("")
      );
    } catch {
      return fallback;
    }
  };
  return {
    mode: root.classList.contains("dark") ? "dark" : "light",
    bg: toHex("--background", "#141414"),
    surface: toHex("--card", "#1c1c1c"),
    text: toHex("--foreground", "#f2f2f2"),
    primary: toHex("--primary", "#6fd6dc"),
  };
}

export function blankTheme(mode: ThemeMode = "dark"): CustomTheme {
  return mode === "dark"
    ? {
        id: newId(),
        name: "My theme",
        mode,
        bg: "#14121c",
        surface: "#1d1a29",
        text: "#f1eefb",
        primary: "#b79cff",
        radius: 0.75,
      }
    : {
        id: newId(),
        name: "My theme",
        mode,
        bg: "#f4f0e8",
        surface: "#fbf8f2",
        text: "#2a2622",
        primary: "#2f7f86",
        radius: 0.75,
      };
}
