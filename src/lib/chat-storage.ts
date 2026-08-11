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
