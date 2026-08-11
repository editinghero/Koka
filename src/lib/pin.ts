/**
 * Device PIN lock logic following AniStash pattern.
 * PIN lives in localStorage on this device. When a PIN is configured,
 * the app automatically requires PIN entry on every page open or refresh.
 */

const PIN_KEY = "koka:pin";
const LOCK_KEY = "koka:locked";
const TRIES_KEY = "koka:pin-tries";

export const MAX_TRIES = 6;

// In-memory unlock flag: resets to false on every JS initialization / page refresh / tab open
let inMemoryUnlocked = false;

async function digest(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`koka:${pin}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPin(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(PIN_KEY));
}

export async function setPin(pin: string) {
  window.localStorage.setItem(PIN_KEY, await digest(pin));
  window.localStorage.removeItem(TRIES_KEY);
  window.localStorage.removeItem(LOCK_KEY);
  inMemoryUnlocked = true;
}

export function clearPin() {
  inMemoryUnlocked = false;
  window.localStorage.removeItem(PIN_KEY);
  window.localStorage.removeItem(TRIES_KEY);
  window.localStorage.removeItem(LOCK_KEY);
}

export async function checkPin(pin: string): Promise<boolean> {
  const stored = window.localStorage.getItem(PIN_KEY);
  return Boolean(stored) && stored === (await digest(pin));
}

export function isLocked(): boolean {
  if (typeof window === "undefined") return false;
  if (!hasPin()) return false;
  // Locked if inMemoryUnlocked is false OR explicitly locked
  const isExplicitlyLocked = window.localStorage.getItem(LOCK_KEY) === "1";
  return isExplicitlyLocked || !inMemoryUnlocked;
}

export function lockNow() {
  if (!hasPin()) return;
  inMemoryUnlocked = false;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCK_KEY, "1");
    window.dispatchEvent(new Event("koka:lock"));
  }
}

export function unlock() {
  inMemoryUnlocked = true;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LOCK_KEY);
    window.localStorage.removeItem(TRIES_KEY);
  }
}

export function triesLeft(): number {
  const used = Number(window.localStorage.getItem(TRIES_KEY) ?? 0);
  return Math.max(0, MAX_TRIES - used);
}

export function recordFailedTry(): number {
  const used = Number(window.localStorage.getItem(TRIES_KEY) ?? 0) + 1;
  window.localStorage.setItem(TRIES_KEY, String(used));
  return Math.max(0, MAX_TRIES - used);
}
