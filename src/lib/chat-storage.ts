import type { ChatMessage } from "./types";

const GLOBAL_CHAT_KEY = "koka:chat:global";
const ANIME_CHAT_PREFIX = "koka:chat:anime:";

export function getGlobalChatHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GLOBAL_CHAT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGlobalChatHistory(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GLOBAL_CHAT_KEY, JSON.stringify(messages));
  } catch {
    /* quota */
  }
}

export function clearGlobalChatHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GLOBAL_CHAT_KEY);
  } catch {
    /* ignore */
  }
}

export function getAnimeChatHistory(animeId: number): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${ANIME_CHAT_PREFIX}${animeId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAnimeChatHistory(animeId: number, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${ANIME_CHAT_PREFIX}${animeId}`,
      JSON.stringify(messages),
    );
  } catch {
    /* quota */
  }
}

export function clearAnimeChatHistory(animeId: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(`${ANIME_CHAT_PREFIX}${animeId}`);
  } catch {
    /* ignore */
  }
}

/** Clears global chat and ALL per-anime chat histories from localStorage. */
export function clearAllChatHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GLOBAL_CHAT_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(ANIME_CHAT_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** All chat histories, keyed "global" or "anime:<id>", for the full backup. */
export function exportAllChats(): Record<string, ChatMessage[]> {
  const out: Record<string, ChatMessage[]> = {};
  if (typeof window === "undefined") return out;
  try {
    const global = getGlobalChatHistory();
    if (global.length) out["global"] = global;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(ANIME_CHAT_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(parsed) && parsed.length) {
        out[`anime:${key.slice(ANIME_CHAT_PREFIX.length)}`] =
          parsed as ChatMessage[];
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Restore chats from a backup, never overwriting a chat that already exists here. */
export function restoreChatsIfMissing(
  chats: Record<string, ChatMessage[]>,
): number {
  if (typeof window === "undefined") return 0;
  let restored = 0;
  for (const [name, messages] of Object.entries(chats)) {
    if (!Array.isArray(messages) || !messages.length) continue;
    const key =
      name === "global"
        ? GLOBAL_CHAT_KEY
        : /^anime:\d+$/.test(name)
          ? `${ANIME_CHAT_PREFIX}${name.slice("anime:".length)}`
          : null;
    if (!key) continue;
    try {
      if (localStorage.getItem(key)) continue;
      localStorage.setItem(key, JSON.stringify(messages));
      restored++;
    } catch {
      /* quota */
    }
  }
  return restored;
}
