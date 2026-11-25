import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  BACKUP_VERSION,
  notesForBackup,
  readBackupExtras,
  validTime,
} from "./backup-extras";
import {
  DEFAULT_SETTINGS,
  normalizeTags,
  type FontOption,
  type LibraryEntry,
  type MediaType,
  type Note,
  type Settings,
  type UserProfile,
  type WatchStatus,
} from "./types";
import { loadFontAssets } from "./fonts";
import { applyThemeColor } from "./themes";
import { applyActiveCustomTheme } from "./custom-theme";
import { applyFontForce } from "./theme-prefs";
import {
  getBootstrap,
  logImport as logImportFn,
  removeCommunity as removeCommunityFn,
  removeEntry,
  removeEntries,
  removeNote,
  replaceLibrary as replaceLibraryFn,
  replaceNotes as replaceNotesFn,
  saveCommunities as saveCommunitiesFn,
  saveEntries,
  saveNotes as saveNotesFn,
  saveSettings as saveSettingsFn,
  saveUserProfileFn,
} from "./data.functions";

/* ------------------------------------------------------------------ *
 * Client state. The source of truth is the database behind the server
 * functions in `data.functions.ts` (Cloudflare D1 in production, a local
 * dev store otherwise). localStorage is used only as a paint-fast cache
 * and for the device PIN — never as the store of record.
 * ------------------------------------------------------------------ */

export type AppUser = { id: string; email: string; name: string };

type State = {
  ready: boolean;
  user: AppUser | null;
  settings: Settings;
  mode: MediaType;
  library: LibraryEntry[];
  notes: Note[];
  userProfile: UserProfile | null;
};

const CACHE_KEY = "koka:cache";

const EMPTY_LIBRARY: LibraryEntry[] = [];
const EMPTY_NOTES: Note[] = [];

let state: State = {
  ready: false,
  user: null,
  settings: DEFAULT_SETTINGS,
  mode: "ANIME",
  library: EMPTY_LIBRARY,
  notes: EMPTY_NOTES,
  userProfile: null,
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const emit = () => listeners.forEach((l) => l());

function writeCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        user: state.user,
        settings: state.settings,
        mode: state.mode,
        library: state.library,
        notes: state.notes,
        userProfile: state.userProfile,
      }),
    );
  } catch {
    /* quota — ignore */
  }
}

function setState(patch: Partial<State>, cache = true) {
  state = { ...state, ...patch };
  if (cache) writeCache();
  emit();
}

export function applyThemeFromSettings(settingsOverride?: Settings) {
  if (typeof window === "undefined") return;
  try {
    let settings = settingsOverride ?? state.settings;
    if (!settingsOverride) {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.settings) {
          settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
        }
      }
    }
    const dark = settings.theme === "dark";
    const preset = dark ? settings.darkTheme : settings.lightTheme;
    const rawFont =
      typeof window !== "undefined"
        ? (window.localStorage.getItem("koka:font") as FontOption | null)
        : null;
    const font =
      settingsOverride?.font ?? settings.font ?? rawFont ?? "default";
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset["theme"] = preset;
    applyThemeColor(preset, dark);
    // A custom theme (kept in localStorage only) overrides the preset.
    applyActiveCustomTheme(dark);
    root.dataset["font"] = font;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("koka:font", font);
    }
    loadFontAssets(font);
    applyFontForce();
  } catch {
    /* ignore */
  }
}

// Re-apply the built-in preset when a custom theme is switched off or deleted.
if (typeof window !== "undefined") {
  window.addEventListener("koka:theme-reapply", () =>
    applyThemeFromSettings(state.settings),
  );
}

let hydratedFromCache = false;
function hydrateFromCache() {
  if (hydratedFromCache || typeof window === "undefined") return;
  hydratedFromCache = true;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const rawFont = window.localStorage.getItem(
      "koka:font",
    ) as FontOption | null;
    if (!raw && !rawFont) return;
    const parsed = raw ? (JSON.parse(raw) as Partial<State>) : {};
    state = {
      ...state,
      user: parsed.user ?? null,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
        ...(rawFont ? { font: rawFont } : {}),
      },
      mode: parsed.mode === "MANGA" ? "MANGA" : "ANIME",
      library: parsed.library ?? EMPTY_LIBRARY,
      notes: parsed.notes ?? EMPTY_NOTES,
      userProfile: parsed.userProfile ?? null,
    };
    applyThemeFromSettings(state.settings);
  } catch {
    /* corrupt cache — ignore */
  }
}

export function clearCache() {
  if (typeof window !== "undefined") window.localStorage.removeItem(CACHE_KEY);
  state = {
    ready: true,
    user: null,
    settings: DEFAULT_SETTINGS,
    mode: "ANIME",
    library: EMPTY_LIBRARY,
    notes: EMPTY_NOTES,
    userProfile: null,
  };
  emit();
}

let bootPromise: Promise<void> | null = null;

/** Loads the signed-in user's data from the database. Safe to call often. */
export function boot(force = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  hydrateFromCache();
  if (bootPromise && !force) return bootPromise;
  bootPromise = getBootstrap()
    .then((data) => {
      if (!data.user) {
        setState({ ready: true, user: null }, false);
        return;
      }
      const fontFromData = data.settings?.font;
      const localFont =
        typeof window !== "undefined"
          ? (window.localStorage.getItem("koka:font") as FontOption | null)
          : null;
      const currentFont =
        fontFromData || localFont || state.settings.font || "default";
      if (typeof window !== "undefined" && currentFont) {
        window.localStorage.setItem("koka:font", currentFont);
      }
      const updatedSettings = {
        ...DEFAULT_SETTINGS,
        ...(data.settings ?? {}),
        font: currentFont,
      };
      setState({
        ready: true,
        user: data.user,
        settings: updatedSettings,
        mode: data.mode,
        library: data.library,
        notes: data.notes,
        userProfile: data.userProfile ?? state.userProfile ?? null,
      });
      applyThemeFromSettings(updatedSettings);

      if (data.communities && data.communities.length > 0) {
        const map = new Map<string, CommunityItem>();
        for (const c of data.communities) map.set(c.id, c);
        for (const c of communityState.communities) {
          if (!map.has(c.id)) map.set(c.id, c);
        }
        setCommunityState({ communities: [...map.values()] });
      } else if (communityState.communities.length > 0 && data.user) {
        void saveCommunitiesFn({
          data: { communities: communityState.communities },
        }).catch(fail);
      }
    })
    .catch(() => setState({ ready: true }, false));
  return bootPromise;
}

function useSnapshot(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function useSession() {
  const s = useSnapshot();
  return { user: s.user, ready: s.ready, reload: () => boot(true) };
}

const signedIn = () => state.user !== null;
const fail = (e: unknown) => console.error(e);

/* ---------------- media mode (anime / manga) ---------------- */

export function useMediaMode() {
  const s = useSnapshot();
  const setMode = useCallback((mode: MediaType) => {
    setState({ mode });
    if (signedIn()) {
      void saveSettingsFn({ data: { settings: state.settings, mode } }).catch(
        fail,
      );
    }
  }, []);
  return { mode: s.mode, setMode };
}

export function getMediaMode(): MediaType {
  return state.mode;
}

export const typeOf = (e: { media: { type?: MediaType } }): MediaType =>
  e.media.type === "MANGA" ? "MANGA" : "ANIME";

const noteType = (n: Note): MediaType =>
  n.mediaType === "MANGA" ? "MANGA" : "ANIME";

const keyOf = (type: MediaType, id: number) => `${type}:${id}`;

/* ---------------- library ---------------- */

export function useLibrary(forceMode?: MediaType) {
  const s = useSnapshot();
  const mode = forceMode ?? s.mode;
  const all = s.library;

  const library = useMemo(
    () => all.filter((e) => typeOf(e) === mode),
    [all, mode],
  );

  const push = useCallback((entries: LibraryEntry[]) => {
    if (!entries.length || !signedIn()) return;
    void saveEntries({ data: { entries } }).catch(fail);
  }, []);

  const setLibrary = useCallback(
    (next: LibraryEntry[] | ((prev: LibraryEntry[]) => LibraryEntry[])) => {
      const prev = state.library;
      const resolved = typeof next === "function" ? next(prev) : next;
      setState({ library: resolved });
      if (!signedIn()) return;
      if (!resolved.length && prev.length) {
        void replaceLibraryFn({
          data: { entries: [], types: ["ANIME", "MANGA"] },
        }).catch(fail);
        return;
      }
      const before = new Map(
        prev.map((e) => [keyOf(typeOf(e), e.media.id), e]),
      );
      const changed = resolved.filter(
        (e) => before.get(keyOf(typeOf(e), e.media.id)) !== e,
      );
      const after = new Set(resolved.map((e) => keyOf(typeOf(e), e.media.id)));
      const removed = prev.filter(
        (e) => !after.has(keyOf(typeOf(e), e.media.id)),
      );
      push(changed);
      for (const e of removed) {
        void removeEntry({
          data: { mediaId: e.media.id, mediaType: typeOf(e) },
        }).catch(fail);
      }
    },
    [push],
  );

  const upsert = useCallback(
    (entry: LibraryEntry) => {
      const type = typeOf(entry);
      const prev = state.library;
      const idx = prev.findIndex(
        (e) => e.media.id === entry.media.id && typeOf(e) === type,
      );
      const next = [...prev];
      const existing = idx === -1 ? null : next[idx];
      const tags =
        existing && existing.tags && existing.tags.length > 0
          ? entry.tags && entry.tags.length > 0
            ? normalizeTags([...existing.tags, ...entry.tags])
            : existing.tags
          : (entry.tags ?? []);
      const customLinks =
        existing?.customLinks && existing.customLinks.length > 0
          ? entry.customLinks && entry.customLinks.length > 0
            ? entry.customLinks
            : existing.customLinks
          : (entry.customLinks ?? []);

      const merged: LibraryEntry =
        idx === -1
          ? entry
          : {
              ...existing,
              ...entry,
              tags,
              customLinks,
              updatedAt: Date.now(),
            };
      if (idx === -1) next.push(merged);
      else next[idx] = merged;
      setState({ library: next });
      push([merged]);
    },
    [push],
  );

  const patch = useCallback(
    (id: number, changes: Partial<LibraryEntry>) => {
      let updated: LibraryEntry | null = null;
      const next = state.library.map((e) => {
        if (e.media.id === id && typeOf(e) === mode) {
          updated = { ...e, ...changes, updatedAt: Date.now() };
          return updated;
        }
        return e;
      });
      setState({ library: next });
      if (updated) push([updated]);
    },
    [mode, push],
  );

  const remove = useCallback(
    (id: number, explicitType?: MediaType) => {
      const targetType = explicitType ?? mode;
      setState({
        library: state.library.filter(
          (e) => !(e.media.id === id && typeOf(e) === targetType),
        ),
      });
      if (signedIn()) {
        void removeEntry({
          data: { mediaId: id, mediaType: targetType },
        }).catch(fail);
      }
    },
    [mode],
  );

  const removeMany = useCallback(
    (items: { id: number; mediaType?: MediaType }[]) => {
      if (!items.length) return;
      const set = new Set(items.map((i) => keyOf(i.mediaType ?? mode, i.id)));
      setState({
        library: state.library.filter(
          (e) => !set.has(keyOf(typeOf(e), e.media.id)),
        ),
      });
      if (signedIn()) {
        void removeEntries({
          data: {
            entries: items.map((i) => ({
              mediaId: i.id,
              mediaType: i.mediaType ?? mode,
            })),
          },
        }).catch(fail);
      }
    },
    [mode],
  );

  const mergeMany = useCallback(
    (entries: LibraryEntry[]) => {
      const map = new Map(
        state.library.map((e) => [keyOf(typeOf(e), e.media.id), e]),
      );
      const merged: LibraryEntry[] = [];
      for (const entry of entries) {
        const k = keyOf(typeOf(entry), entry.media.id);
        const existing = map.get(k);

        // Tags: existing tags must NEVER be wiped on import
        const existingTags = existing?.tags ?? [];
        const incomingTags = entry.tags ?? [];
        const tags =
          existingTags.length > 0
            ? normalizeTags([...existingTags, ...incomingTags])
            : incomingTags;

        // Custom links: existing links must NEVER be wiped on import
        const customLinks =
          existing?.customLinks && existing.customLinks.length > 0
            ? existing.customLinks
            : (entry.customLinks ?? []);

        const next = {
          ...existing,
          ...entry,
          tags,
          customLinks,
          media: { ...existing?.media, ...entry.media },
          addedAt: existing?.addedAt ?? entry.addedAt,
        } as LibraryEntry;
        map.set(k, next);
        merged.push(next);
      }
      setState({ library: [...map.values()] });
      push(merged);
    },
    [push],
  );

  /** Replace every entry of the given media types with the incoming ones. */
  const replaceMany = useCallback(
    (entries: LibraryEntry[], types: MediaType[]) => {
      const existingMap = new Map(
        state.library.map((e) => [keyOf(typeOf(e), e.media.id), e]),
      );
      const sanitizedEntries = entries.map((entry) => {
        const existing = existingMap.get(keyOf(typeOf(entry), entry.media.id));
        if (!existing) return entry;
        return {
          ...entry,
          tags:
            existing.tags && existing.tags.length > 0
              ? normalizeTags([...existing.tags, ...(entry.tags ?? [])])
              : (entry.tags ?? []),
          customLinks:
            existing.customLinks && existing.customLinks.length > 0
              ? existing.customLinks
              : (entry.customLinks ?? []),
        };
      });

      setState({
        library: [
          ...state.library.filter((e) => !types.includes(typeOf(e))),
          ...sanitizedEntries,
        ],
      });
      if (signedIn())
        void replaceLibraryFn({
          data: { entries: sanitizedEntries, types },
        }).catch(fail);
    },
    [],
  );

  return {
    library,
    all,
    setLibrary,
    upsert,
    patch,
    remove,
    removeMany,
    mergeMany,
    replaceMany,
  };
}

/* ---------------- notes ---------------- */

export function useNotes(forceMode?: MediaType) {
  const s = useSnapshot();
  const mode = forceMode ?? s.mode;
  const all = s.notes;

  const notes = useMemo(
    () => all.filter((n) => noteType(n) === mode),
    [all, mode],
  );

  const pushNotes = useCallback((incoming: Note[]) => {
    if (!incoming.length || !signedIn()) return;
    void saveNotesFn({ data: { notes: incoming } }).catch(fail);
  }, []);

  const setNotes = useCallback(
    (next: Note[] | ((prev: Note[]) => Note[])) => {
      const prev = state.notes;
      const resolved = typeof next === "function" ? next(prev) : next;
      setState({ notes: resolved });
      if (!signedIn()) return;
      if (!resolved.length && prev.length) {
        void replaceNotesFn({
          data: { notes: [], types: ["ANIME", "MANGA"] },
        }).catch(fail);
        return;
      }
      const before = new Map(
        prev.map((n) => [keyOf(noteType(n), n.animeId), n]),
      );
      pushNotes(
        resolved.filter((n) => before.get(keyOf(noteType(n), n.animeId)) !== n),
      );
      const after = new Set(resolved.map((n) => keyOf(noteType(n), n.animeId)));
      for (const n of prev) {
        if (!after.has(keyOf(noteType(n), n.animeId))) {
          void removeNote({
            data: { mediaId: n.animeId, mediaType: noteType(n) },
          }).catch(fail);
        }
      }
    },
    [pushNotes],
  );

  const saveNote = useCallback(
    (note: Note) => {
      const type = noteType(note);
      const prev = state.notes;
      const idx = prev.findIndex(
        (n) => n.animeId === note.animeId && noteType(n) === type,
      );
      const next = [...prev];
      if (idx === -1) next.push(note);
      else next[idx] = note;
      setState({ notes: next });
      pushNotes([note]);
    },
    [pushNotes],
  );

  const removeNoteLocal = useCallback(
    (animeId: number, type: MediaType = mode) => {
      setState({
        notes: state.notes.filter(
          (n) => !(n.animeId === animeId && noteType(n) === type),
        ),
      });
      if (signedIn()) {
        void removeNote({ data: { mediaId: animeId, mediaType: type } }).catch(
          fail,
        );
      }
    },
    [mode],
  );

  /** Merge imported notes without clobbering notes the user already wrote. */
  const mergeNotes = useCallback(
    (incoming: Note[]) => {
      const map = new Map(
        state.notes.map((n) => [keyOf(noteType(n), n.animeId), n]),
      );
      const touched: Note[] = [];
      for (const note of incoming) {
        const k = keyOf(noteType(note), note.animeId);
        const existing = map.get(k);
        if (existing) {
          const existingTags = existing.tags ?? [];
          const incomingTags = note.tags ?? [];
          const newTags = [...new Set([...existingTags, ...incomingTags])];
          const exactBodyMatch = existing.body.trim() === note.body.trim();
          const tagsIncluded = newTags.length === existingTags.length;
          if (exactBodyMatch && tagsIncluded) continue;

          const merged: Note = {
            ...existing,
            body: note.body.trim(),
            tags: newTags,
            // Keep the date the imported note was last edited (not the import time).
            updatedAt: validTime(note.updatedAt) ?? Date.now(),
          };
          map.set(k, merged);
          touched.push(merged);
        } else {
          const added: Note = {
            ...note,
            updatedAt: validTime(note.updatedAt) ?? Date.now(),
          };
          map.set(k, added);
          touched.push(added);
        }
      }
      setState({ notes: [...map.values()] });
      pushNotes(touched);
    },
    [pushNotes],
  );

  /** Replace all notes for the given media types. */
  const replaceNotes = useCallback((incoming: Note[], types: MediaType[]) => {
    setState({
      notes: [
        ...state.notes.filter((n) => !types.includes(noteType(n))),
        ...incoming,
      ],
    });
    if (signedIn()) {
      void replaceNotesFn({ data: { notes: incoming, types } }).catch(fail);
    }
  }, []);

  return {
    notes,
    all,
    saveNote,
    removeNote: removeNoteLocal,
    mergeNotes,
    replaceNotes,
    setNotes,
  };
}

/* ---------------- settings ---------------- */

let settingsTimer: ReturnType<typeof setTimeout> | undefined;

export function useSettings() {
  const s = useSnapshot();
  const update = useCallback((changes: Partial<Settings>) => {
    const settings = { ...state.settings, ...changes };
    if (changes.font && typeof window !== "undefined") {
      window.localStorage.setItem("koka:font", changes.font);
    }
    setState({ settings });
    applyThemeFromSettings(settings);
    if (!signedIn()) return;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => {
      void saveSettingsFn({
        data: { settings: state.settings, mode: state.mode },
      }).catch(fail);
    }, 400);
  }, []);
  return { settings: s.settings, update };
}

export function getSettings(): Settings {
  return state.settings;
}

export function recordImport(entry: {
  source: string;
  mode: string;
  count: number;
}) {
  if (signedIn()) void logImportFn({ data: entry }).catch(fail);
}

export function statusCounts(library: LibraryEntry[]) {
  const counts: Record<string, number> = {};
  for (const e of library) counts[e.status] = (counts[e.status] ?? 0) + 1;
  return counts as Record<WatchStatus, number>;
}

export function useUserProfile() {
  const s = useSnapshot();
  const profile = s.userProfile;

  const setProfile = useCallback((next: UserProfile | null) => {
    setState({ userProfile: next });
    if (signedIn() && next) {
      void saveUserProfileFn({ data: { profile: next } }).catch(fail);
    }
  }, []);

  return { profile, setProfile };
}

export function exportAll() {
  return {
    kind: "koka-backup",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    // The Gemini key never leaves the device.
    settings: { ...state.settings, geminiKey: "" },
    library: state.library,
    // Each note carries updatedAt (last edited) + a readable lastEditedAt.
    notes: notesForBackup(state.notes),
    userProfile: state.userProfile,
    // Communities, custom themes, preferences and AI chats.
    ...readBackupExtras(communityState.communities),
  };
}

/* ---------------- communities ---------------- */

import type { CommunityItem } from "./community-utils";

type CommunityState = {
  communities: CommunityItem[];
};

let communityState: CommunityState = {
  communities: [],
};

const communityListeners = new Set<() => void>();
const subscribeCommunities = (l: () => void) => {
  communityListeners.add(l);
  return () => communityListeners.delete(l);
};
const emitCommunities = () => communityListeners.forEach((l) => l());

function setCommunityState(patch: Partial<CommunityState>) {
  communityState = { ...communityState, ...patch };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        "koka:communities",
        JSON.stringify(communityState.communities),
      );
    } catch {
      /* quota — ignore */
    }
  }
  emitCommunities();
}

// Hydrate communities from localStorage
if (typeof window !== "undefined") {
  try {
    const raw = window.localStorage.getItem("koka:communities");
    if (raw) {
      communityState.communities = JSON.parse(raw);
    }
  } catch {
    /* corrupt cache — ignore */
  }
}

export function useCommunities() {
  const communities = useSyncExternalStore(
    subscribeCommunities,
    () => communityState.communities,
    () => communityState.communities,
  );

  const upsertCommunities = useCallback((items: CommunityItem[]) => {
    const map = new Map(
      communityState.communities.map((c) => [c.id, c]),
    );
    for (const item of items) {
      map.set(item.id, item);
    }
    setCommunityState({ communities: [...map.values()] });
    if (signedIn()) {
      void saveCommunitiesFn({ data: { communities: items } }).catch(fail);
    }
  }, []);

  const deleteCommunity = useCallback((id: string) => {
    setCommunityState({
      communities: communityState.communities.filter((c) => c.id !== id),
    });
    if (signedIn()) {
      void removeCommunityFn({ data: { id } }).catch(fail);
    }
  }, []);

  const togglePinCommunity = useCallback((id: string) => {
    let updated: CommunityItem | undefined;
    setCommunityState({
      communities: communityState.communities.map((c) => {
        if (c.id === id) {
          updated = { ...c, pinned: !c.pinned };
          return updated;
        }
        return c;
      }),
    });
    if (signedIn() && updated) {
      void saveCommunitiesFn({ data: { communities: [updated] } }).catch(fail);
    }
  }, []);

  const markCommunityOpened = useCallback((id: string) => {
    let updated: CommunityItem | undefined;
    setCommunityState({
      communities: communityState.communities.map((c) => {
        if (c.id === id) {
          updated = { ...c, lastOpenedAt: Date.now() };
          return updated;
        }
        return c;
      }),
    });
    if (signedIn() && updated) {
      void saveCommunitiesFn({ data: { communities: [updated] } }).catch(fail);
    }
  }, []);

  return {
    communities,
    upsertCommunities,
    deleteCommunity,
    togglePinCommunity,
    markCommunityOpened,
  };
}

/* ---------------- community popup ---------------- */

type CommunityPopupState = {
  open: boolean;
  view: "opener" | "add-custom" | "add-ai";
  media: {
    id?: number | null;
    title: string;
    type: MediaType;
    cover?: string | null;
  } | null;
  search: string;
};

let communityPopupState: CommunityPopupState = {
  open: false,
  view: "opener",
  media: null,
  search: "",
};

const communityPopupListeners = new Set<() => void>();
const subscribeCommunityPopup = (l: () => void) => {
  communityPopupListeners.add(l);
  return () => communityPopupListeners.delete(l);
};
const emitCommunityPopup = () => communityPopupListeners.forEach((l) => l());

function setCommunityPopupState(patch: Partial<CommunityPopupState>) {
  communityPopupState = { ...communityPopupState, ...patch };
  emitCommunityPopup();
}

export function useCommunityPopup() {
  const snapshot = useSyncExternalStore(
    subscribeCommunityPopup,
    () => communityPopupState,
    () => communityPopupState,
  );

  const openPopup = useCallback(
    (config: {
      view: "opener" | "add-custom" | "add-ai";
      media?: {
        id?: number | null;
        title: string;
        type: MediaType;
        cover?: string | null;
      } | null;
      search?: string;
    }) => {
      setCommunityPopupState({
        open: true,
        view: config.view,
        media: config.media ?? null,
        search: config.search ?? "",
      });
    },
    [],
  );

  const closePopup = useCallback(() => {
    setCommunityPopupState({
      open: false,
      view: "opener",
      media: null,
      search: "",
    });
  }, []);

  const setPopupView = useCallback(
    (view: "opener" | "add-custom" | "add-ai") => {
      setCommunityPopupState({ view });
    },
    [],
  );

  const setPopupMedia = useCallback(
    (
      media: {
        id?: number | null;
        title: string;
        type: MediaType;
        cover?: string | null;
      } | null,
    ) => {
      setCommunityPopupState({ media });
    },
    [],
  );

  return {
    ...snapshot,
    openPopup,
    closePopup,
    setPopupView,
    setPopupMedia,
  };
}
