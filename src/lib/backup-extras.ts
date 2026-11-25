/**
 * Everything that is not in the library / notes / settings / profile but is
 * still the user's data, so a full backup really contains it all:
 *  - communities
 *  - custom themes (stored in localStorage only)
 *  - appearance + news preferences
 *  - AI chat histories (stored in localStorage only)
 *
 * Deliberately NOT exported: the Gemini API key, the app-lock PIN, and
 * caches / transient state (news feed cache, notification bookkeeping).
 */
import type { CommunityItem } from "./community-utils";
import {
  exportAllChats,
  restoreChatsIfMissing,
} from "./chat-storage";
import { getCustomThemeData, restoreCustomThemes } from "./custom-theme";
import {
  getAutoShuffle,
  getFontForce,
  setAutoShuffle,
  setFontForce,
} from "./theme-prefs";
import type { ChatMessage, Note } from "./types";

export const BACKUP_VERSION = 2;

const NEWS_SOURCES_KEY = "koka:news:sources";

export type BackupExtras = {
  communities?: CommunityItem[];
  customThemes?: {
    themes: unknown[];
    active: { dark: string | null; light: string | null };
  };
  preferences?: {
    forceFont?: boolean;
    autoShuffle?: boolean;
    newsSources?: string[];
  };
  chats?: Record<string, ChatMessage[]>;
};

/** A usable timestamp, or null (very old backups may lack one). */
export function validTime(t: unknown): number | null {
  return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null;
}

/**
 * Notes as written to a backup. `updatedAt` (ms) is the date the note was last
 * edited; `lastEditedAt` is the same moment as a readable ISO date.
 */
export function notesForBackup(
  notes: Note[],
): (Note & { lastEditedAt: string })[] {
  return notes.map((n) => {
    const updatedAt = validTime(n.updatedAt) ?? Date.now();
    return { ...n, updatedAt, lastEditedAt: new Date(updatedAt).toISOString() };
  });
}

/** Notes read from a backup: keep each note's own last-edited date. */
export function normalizeBackupNotes(raw: unknown): Note[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (n): n is Record<string, unknown> =>
        !!n && typeof n === "object" && typeof (n as Note).animeId === "number",
    )
    .map((n) => {
      const fromIso =
        typeof n["lastEditedAt"] === "string"
          ? Date.parse(n["lastEditedAt"])
          : NaN;
      const { lastEditedAt: _drop, ...rest } = n;
      void _drop;
      return {
        ...(rest as unknown as Note),
        updatedAt: validTime(n["updatedAt"]) ?? validTime(fromIso) ?? Date.now(),
      };
    });
}

export function readBackupExtras(communities: CommunityItem[]): BackupExtras {
  let newsSources: string[] | undefined;
  try {
    const raw = localStorage.getItem(NEWS_SOURCES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(parsed)) {
      newsSources = parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* ignore */
  }
  const themes = getCustomThemeData();
  return {
    communities,
    customThemes: { themes: themes.themes, active: themes.active },
    preferences: {
      forceFont: getFontForce(),
      autoShuffle: getAutoShuffle(),
      ...(newsSources ? { newsSources } : {}),
    },
    chats: exportAllChats(),
  };
}

/** Pick the extras out of a parsed backup file (anything malformed is skipped). */
export function parseBackupExtras(json: Record<string, unknown>): BackupExtras {
  const extras: BackupExtras = {};
  const communities = json["communities"];
  if (Array.isArray(communities)) {
    extras.communities = communities.filter(
      (c): c is CommunityItem =>
        !!c &&
        typeof c === "object" &&
        typeof (c as CommunityItem).id === "string" &&
        typeof (c as CommunityItem).handle === "string",
    );
  }
  const ct = json["customThemes"] as BackupExtras["customThemes"] | undefined;
  if (ct && Array.isArray(ct.themes)) {
    extras.customThemes = {
      themes: ct.themes,
      active: {
        dark: typeof ct.active?.dark === "string" ? ct.active.dark : null,
        light: typeof ct.active?.light === "string" ? ct.active.light : null,
      },
    };
  }
  const p = json["preferences"] as Record<string, unknown> | undefined;
  if (p && typeof p === "object") {
    extras.preferences = {
      ...(typeof p["forceFont"] === "boolean" ? { forceFont: p["forceFont"] } : {}),
      ...(typeof p["autoShuffle"] === "boolean" ? { autoShuffle: p["autoShuffle"] } : {}),
      ...(Array.isArray(p["newsSources"])
        ? {
            newsSources: (p["newsSources"] as unknown[]).filter(
              (x): x is string => typeof x === "string",
            ),
          }
        : {}),
    };
  }
  const chats = json["chats"];
  if (chats && typeof chats === "object" && !Array.isArray(chats)) {
    extras.chats = Object.fromEntries(
      Object.entries(chats as Record<string, unknown>).filter(([, v]) =>
        Array.isArray(v),
      ),
    ) as Record<string, ChatMessage[]>;
  }
  return extras;
}

/**
 * Put the extras back. Never deletes local data: communities are upserted,
 * themes and chats are only added when missing; preferences are restored.
 */
export function restoreBackupExtras(
  extras: BackupExtras | undefined,
  upsertCommunities: (items: CommunityItem[]) => void,
): { communities: number; themes: number; chats: number } {
  const done = { communities: 0, themes: 0, chats: 0 };
  if (!extras) return done;
  if (extras.communities?.length) {
    upsertCommunities(extras.communities);
    done.communities = extras.communities.length;
  }
  if (extras.customThemes) {
    done.themes = restoreCustomThemes(
      extras.customThemes.themes,
      extras.customThemes.active,
    );
  }
  if (extras.preferences) {
    const { forceFont, autoShuffle, newsSources } = extras.preferences;
    if (forceFont !== undefined) setFontForce(forceFont);
    if (autoShuffle !== undefined) setAutoShuffle(autoShuffle);
    if (newsSources?.length) {
      try {
        localStorage.setItem(NEWS_SOURCES_KEY, JSON.stringify(newsSources));
      } catch {
        /* ignore */
      }
    }
  }
  if (extras.chats) done.chats = restoreChatsIfMissing(extras.chats);
  return done;
}
