/**
 * Two small appearance preferences, kept in localStorage only:
 *  - Auto shuffle: pick a random theme (from the current light/dark mode) each
 *    time Koka opens.
 *  - Force font: the font chosen in Settings wins over theme-specific fonts.
 */
import { setActiveCustomTheme } from "./custom-theme";
import { DARK_THEMES, LIGHT_THEMES, type ThemePreset } from "./themes";
import type { Settings } from "./types";

const AUTO_KEY = "koka:auto-shuffle";
const FORCE_KEY = "koka:font-force";
const SESSION_KEY = "koka:shuffled-session";

/** A shuffled built-in theme replaces any custom theme active for that mode. */
function leaveCustomTheme(mode: "dark" | "light"): void {
  setActiveCustomTheme(mode, null);
}

function get(key: string, storage: "local" | "session" = "local"): string | null {
  try {
    return (storage === "local" ? localStorage : sessionStorage).getItem(key);
  } catch {
    return null;
  }
}

function set(key: string, value: string | null, storage: "local" | "session" = "local") {
  try {
    const s = storage === "local" ? localStorage : sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export const getAutoShuffle = (): boolean => get(AUTO_KEY) === "1";
export const setAutoShuffle = (on: boolean): void => set(AUTO_KEY, on ? "1" : null);

export const getFontForce = (): boolean => get(FORCE_KEY) === "1";

/** Mirror the stored preference onto <html data-font-force>. */
export function applyFontForce(): void {
  if (typeof document === "undefined") return;
  if (getFontForce()) document.documentElement.dataset["fontForce"] = "true";
  else delete document.documentElement.dataset["fontForce"];
}

export function setFontForce(on: boolean): void {
  set(FORCE_KEY, on ? "1" : null);
  applyFontForce();
}

/**
 * Switch to a random theme from the pool that matches the selected mode
 * (light themes in light mode, dark themes in dark mode). Never repeats the
 * current theme. Returns the chosen preset, or null if there is nothing else.
 */
export function shuffleTheme(
  settings: Settings,
  update: (changes: Partial<Settings>) => void,
): ThemePreset | null {
  const dark = settings.theme === "dark";
  const pool = dark ? DARK_THEMES : LIGHT_THEMES;
  const currentRaw = dark ? settings.darkTheme : settings.lightTheme;
  const current = currentRaw === "coral" ? "koka" : currentRaw;
  const candidates = pool.filter((t) => t.id !== current);
  const next = candidates[Math.floor(Math.random() * candidates.length)];
  if (!next) return null;
  leaveCustomTheme(dark ? "dark" : "light");
  update(dark ? { darkTheme: next.id } : { lightTheme: next.id });
  return next;
}

/** True once per browser session, so reloads don't reshuffle. */
export function claimLaunchShuffle(): boolean {
  if (get(SESSION_KEY, "session")) return false;
  set(SESSION_KEY, "1", "session");
  return true;
}
