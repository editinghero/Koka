import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  type LibraryEntry,
  type MediaType,
  type Note,
  type Settings,
  type WatchStatus,
} from "./types";
import {
  getBootstrap,
  logImport as logImportFn,
  removeEntry,
  removeNote,
  replaceLibrary as replaceLibraryFn,
  replaceNotes as replaceNotesFn,
  saveEntries,
  saveNotes as saveNotesFn,
  saveSettings as saveSettingsFn,
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
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset["theme"] = preset;
  } catch {
    /* ignore */
  }
}

let hydratedFromCache = false;
function hydrateFromCache() {
  if (hydratedFromCache || typeof window === "undefined") return;
  hydratedFromCache = true;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<State>;
    state = {
      ...state,
      user: parsed.user ?? null,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      mode: parsed.mode === "MANGA" ? "MANGA" : "ANIME",
      library: parsed.library ?? EMPTY_LIBRARY,
      notes: parsed.notes ?? EMPTY_NOTES,
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
      setState({
        ready: true,
        user: data.user,
        settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
        mode: data.mode,
        library: data.library,
        notes: data.notes,
      });
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
      const merged =
        idx === -1 ? entry : { ...next[idx], ...entry, updatedAt: Date.now() };
      if (idx === -1) next.push(merged);
      else next[idx] = merged as LibraryEntry;
      setState({ library: next });
      push([merged as LibraryEntry]);
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
    (id: number) => {
      setState({
        library: state.library.filter(
          (e) => !(e.media.id === id && typeOf(e) === mode),
        ),
      });
      if (signedIn()) {
        void removeEntry({ data: { mediaId: id, mediaType: mode } }).catch(
          fail,
        );
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
        const next = {
          ...existing,
          ...entry,
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
      setState({
        library: [
          ...state.library.filter((e) => !types.includes(typeOf(e))),
          ...entries,
        ],
      });
      if (signedIn())
        void replaceLibraryFn({ data: { entries, types } }).catch(fail);
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
          const newTags = [...new Set([...existing.tags, ...note.tags])];
          const exactBodyMatch = existing.body.trim() === note.body.trim();
          const tagsIncluded = newTags.length === existing.tags.length;
          if (exactBodyMatch && tagsIncluded) continue;

          const merged: Note = {
            ...existing,
            body: note.body.trim(),
            tags: newTags,
            updatedAt: Date.now(),
          };
          map.set(k, merged);
          touched.push(merged);
        } else {
          map.set(k, note);
          touched.push(note);
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

export function exportAll() {
  return {
    kind: "koka-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: { ...state.settings, geminiKey: "" },
    library: state.library,
    notes: state.notes,
  };
}
