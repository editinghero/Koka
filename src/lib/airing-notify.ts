/**
 * Airing alerts: tell the user the moment an episode of a show in their
 * library has aired.
 *
 * - Works on Android / installed PWAs by showing notifications through a
 *   service worker (`new Notification()` throws there).
 * - Remembers upcoming episodes in localStorage, so an episode is still
 *   announced even if AniList has already flipped to the next episode, or the
 *   app was closed for a while (episodes aired < 12h ago are still announced).
 * - De-duplicates across tabs / reloads with a persisted "already notified" list.
 */
import type { LibraryEntry } from "./types";

const PENDING_KEY = "koka_airing_pending";
const NOTIFIED_KEY = "koka_aired_notified";
/** Episodes that aired longer ago than this are dropped without a notification. */
const MAX_AGE_SEC = 12 * 3600;
const MAX_NOTIFIED = 400;

type Pending = {
  id: number;
  episode: number;
  airingAt: number;
  title: string;
  cover?: string;
};
type PendingMap = Record<string, Pending>;

const memoryNotified = new Set<string>();

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function notificationPermission():
  | NotificationPermission
  | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

async function ensureServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    await navigator.serviceWorker.register("/sw.js");
    const ready = navigator.serviceWorker.ready;
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 4000),
    );
    return await Promise.race([ready, timeout]);
  } catch {
    return null;
  }
}

/** Register the worker early when alerts are already allowed. */
export function warmUpNotifications(): void {
  if (notificationPermission() === "granted") void ensureServiceWorker();
}

export async function showAppNotification(
  title: string,
  opts: {
    body: string;
    icon?: string | undefined;
    tag?: string | undefined;
    url?: string | undefined;
  },
): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const options: NotificationOptions = {
    body: opts.body,
    icon: opts.icon ?? "/icon-192.png",
    badge: "/favicon-32x32.png",
    data: { url: opts.url ?? "/" },
    ...(opts.tag ? { tag: opts.tag } : {}),
  };

  const reg = await ensureServiceWorker();
  if (reg) {
    try {
      await reg.showNotification(title, options);
      return true;
    } catch {
      /* fall through to the constructor */
    }
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

/** True the first time a key is claimed; false if it was already notified. */
function claimNotified(key: string): boolean {
  if (memoryNotified.has(key)) return false;
  const list = readJson<string[]>(NOTIFIED_KEY, []);
  if (list.includes(key)) {
    memoryNotified.add(key);
    return false;
  }
  memoryNotified.add(key);
  list.push(key);
  writeJson(NOTIFIED_KEY, list.slice(-MAX_NOTIFIED));
  return true;
}

function isTracked(entry: LibraryEntry): boolean {
  return (
    entry.media.type !== "MANGA" &&
    (entry.status === "CURRENT" || entry.status === "PLANNING")
  );
}

/** Remember each tracked show's next episode so it can be announced later. */
export function syncPending(library: LibraryEntry[]): void {
  if (typeof window === "undefined" || library.length === 0) return;
  const pending = readJson<PendingMap>(PENDING_KEY, {});
  const notified = new Set(readJson<string[]>(NOTIFIED_KEY, []));
  const nowSec = Math.floor(Date.now() / 1000);
  const trackedIds = new Set<number>();
  let changed = false;

  for (const entry of library) {
    if (!isTracked(entry)) continue;
    trackedIds.add(entry.media.id);
    const next = entry.media.nextEpisode;
    if (!next?.airingAt) continue;
    const key = `${entry.media.id}:${next.episode}`;
    if (notified.has(key) || nowSec - next.airingAt > MAX_AGE_SEC) continue;
    const prev = pending[key];
    if (
      !prev ||
      prev.airingAt !== next.airingAt ||
      prev.title !== entry.media.title
    ) {
      pending[key] = {
        id: entry.media.id,
        episode: next.episode,
        airingAt: next.airingAt,
        title: entry.media.title,
        ...(entry.media.cover ? { cover: entry.media.cover } : {}),
      };
      changed = true;
    }
  }

  // Forget shows the user no longer tracks.
  for (const [key, p] of Object.entries(pending)) {
    if (!trackedIds.has(p.id)) {
      delete pending[key];
      changed = true;
    }
  }
  if (changed) writeJson(PENDING_KEY, pending);
}

function agoText(seconds: number): string {
  if (seconds < 90) return "just aired";
  const mins = Math.round(seconds / 60);
  if (mins < 90) return `aired ${mins} min ago`;
  return `aired ${Math.round(mins / 60)}h ago`;
}

/**
 * Notify for every remembered episode that has now aired.
 * Returns the airing time (seconds) of the soonest episode still to come,
 * so the caller can schedule the next check.
 */
export function scanAired(nowSec = Math.floor(Date.now() / 1000)): number | null {
  if (typeof window === "undefined") return null;
  const pending = readJson<PendingMap>(PENDING_KEY, {});
  let nextAt: number | null = null;
  let changed = false;

  for (const [key, p] of Object.entries(pending)) {
    if (p.airingAt > nowSec) {
      if (nextAt === null || p.airingAt < nextAt) nextAt = p.airingAt;
      continue;
    }
    delete pending[key];
    changed = true;
    const age = nowSec - p.airingAt;
    if (age > MAX_AGE_SEC || !claimNotified(key)) continue;
    void showAppNotification(p.title, {
      body: `Episode ${p.episode} ${agoText(age)}`,
      icon: p.cover,
      tag: `aired:${key}`,
      url: `/anime/${p.id}`,
    });
  }
  if (changed) writeJson(PENDING_KEY, pending);
  return nextAt;
}
