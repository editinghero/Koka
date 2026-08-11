/**
 * Server-only data layer.
 *
 * Primary target: Cloudflare D1 (binding `DB`). See docs/cloudflare-d1.md.
 * When no D1 binding is present (local / `vite dev`), an equivalent
 * JSON-file store is used so the app behaves identically. Both implement the
 * same `Repo` interface, so switching is transparent to the rest of the app.
 */
import {
  normalizeTags,
  type LibraryEntry,
  type MediaType,
  type Note,
} from "@/lib/types";
import { getD1, type D1Database } from "./runtime.server";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: number;
};

export type SettingsRow = {
  gemini_key: string; // encrypted at rest
  model: string;
  anilist_user: string;
  spoiler_free: number;
  theme: string;
  light_theme: string;
  dark_theme: string;
  media_mode: string;
};

export type ImportLogRow = {
  id: number;
  source: string;
  mode: string;
  count: number;
  created_at: number;
};

export const DEFAULT_SETTINGS_ROW: SettingsRow = {
  gemini_key: "",
  model: "gemini-2.5-flash",
  anilist_user: "",
  spoiler_free: 1,
  theme: "dark",
  light_theme: "paper",
  dark_theme: "koka",
  media_mode: "ANIME",
};

export type Repo = {
  userByEmail(email: string): Promise<StoredUser | null>;
  userById(id: string): Promise<StoredUser | null>;
  createUser(user: StoredUser): Promise<void>;
  updateUserName(id: string, name: string): Promise<void>;
  updateUserPassword(id: string, hash: string): Promise<void>;

  getSettings(userId: string): Promise<SettingsRow>;
  saveSettings(userId: string, row: SettingsRow): Promise<void>;

  listLibrary(userId: string): Promise<LibraryEntry[]>;
  upsertEntries(userId: string, entries: LibraryEntry[]): Promise<void>;
  deleteEntry(userId: string, type: MediaType, mediaId: number): Promise<void>;
  replaceLibrary(
    userId: string,
    entries: LibraryEntry[],
    types: MediaType[],
  ): Promise<void>;

  listNotes(userId: string): Promise<Note[]>;
  saveNotes(userId: string, notes: Note[]): Promise<void>;
  deleteNote(userId: string, type: MediaType, mediaId: number): Promise<void>;
  replaceNotes(
    userId: string,
    notes: Note[],
    types: MediaType[],
  ): Promise<void>;

  logImport(
    userId: string,
    entry: { source: string; mode: string; count: number },
  ): Promise<void>;
  listImportLog(userId: string): Promise<ImportLogRow[]>;
};

const typeOf = (e: LibraryEntry): MediaType =>
  e.media.type === "MANGA" ? "MANGA" : "ANIME";
const noteTypeOf = (n: Note): MediaType =>
  n.mediaType === "MANGA" ? "MANGA" : "ANIME";

/* ============================== D1 backend ============================== */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     password_hash TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS settings (
     user_id TEXT PRIMARY KEY,
     gemini_key TEXT,
     model TEXT,
     anilist_user TEXT,
     spoiler_free INTEGER NOT NULL DEFAULT 1,
     theme TEXT NOT NULL DEFAULT 'dark',
     light_theme TEXT NOT NULL DEFAULT 'paper',
     dark_theme TEXT NOT NULL DEFAULT 'kuro',
     media_mode TEXT NOT NULL DEFAULT 'ANIME',
     updated_at INTEGER
   )`,
  `CREATE TABLE IF NOT EXISTS library_entries (
     user_id TEXT NOT NULL,
     media_type TEXT NOT NULL,
     media_id INTEGER NOT NULL,
     status TEXT NOT NULL,
     progress INTEGER NOT NULL DEFAULT 0,
     score REAL,
     favorite INTEGER NOT NULL DEFAULT 0,
     started_at TEXT,
     completed_at TEXT,
     repeat_count INTEGER,
     tags TEXT NOT NULL DEFAULT '[]',
     media TEXT NOT NULL,
     updated_at INTEGER NOT NULL,
     added_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, media_type, media_id)
   )`,
  `CREATE TABLE IF NOT EXISTS notes (
     user_id TEXT NOT NULL,
     media_type TEXT NOT NULL,
     media_id INTEGER NOT NULL,
     title TEXT NOT NULL,
     body TEXT NOT NULL DEFAULT '',
     tags TEXT NOT NULL DEFAULT '[]',
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (user_id, media_type, media_id)
   )`,
  `CREATE TABLE IF NOT EXISTS import_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id TEXT NOT NULL,
     source TEXT NOT NULL,
     mode TEXT NOT NULL,
     count INTEGER NOT NULL,
     created_at INTEGER NOT NULL
   )`,
];

let schemaReady = false;

async function ensureSchema(db: D1Database) {
  if (schemaReady) return;
  for (const sql of SCHEMA) await db.prepare(sql).run();
  try {
    await db
      .prepare(
        "ALTER TABLE library_entries ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'",
      )
      .run();
  } catch {
    /* column already exists */
  }
  schemaReady = true;
}

function d1Repo(db: D1Database): Repo {
  const ready = () => ensureSchema(db);

  return {
    async userByEmail(email) {
      await ready();
      return db
        .prepare("SELECT * FROM users WHERE email = ?")
        .bind(email.toLowerCase())
        .first<StoredUser>();
    },
    async userById(id) {
      await ready();
      return db
        .prepare("SELECT * FROM users WHERE id = ?")
        .bind(id)
        .first<StoredUser>();
    },
    async createUser(user) {
      await ready();
      await db
        .prepare(
          "INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          user.id,
          user.email,
          user.name,
          user.password_hash,
          user.created_at,
        )
        .run();
    },
    async updateUserName(id, name) {
      await ready();
      await db
        .prepare("UPDATE users SET name = ? WHERE id = ?")
        .bind(name, id)
        .run();
    },
    async updateUserPassword(id, hash) {
      await ready();
      await db
        .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(hash, id)
        .run();
    },

    async getSettings(userId) {
      await ready();
      const row = await db
        .prepare("SELECT * FROM settings WHERE user_id = ?")
        .bind(userId)
        .first<SettingsRow>();
      return { ...DEFAULT_SETTINGS_ROW, ...(row ?? {}) };
    },
    async saveSettings(userId, row) {
      await ready();
      await db
        .prepare(
          `INSERT INTO settings (user_id, gemini_key, model, anilist_user, spoiler_free, theme, light_theme, dark_theme, media_mode, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
             gemini_key = excluded.gemini_key, model = excluded.model,
             anilist_user = excluded.anilist_user, spoiler_free = excluded.spoiler_free,
             theme = excluded.theme, light_theme = excluded.light_theme,
             dark_theme = excluded.dark_theme, media_mode = excluded.media_mode,
             updated_at = excluded.updated_at`,
        )
        .bind(
          userId,
          row.gemini_key,
          row.model,
          row.anilist_user,
          row.spoiler_free,
          row.theme,
          row.light_theme,
          row.dark_theme,
          row.media_mode,
          Date.now(),
        )
        .run();
    },

    async listLibrary(userId) {
      await ready();
      const { results } = await db
        .prepare("SELECT * FROM library_entries WHERE user_id = ?")
        .bind(userId)
        .all<Record<string, unknown>>();
      return results.map((r) => ({
        media: JSON.parse(String(r["media"])) as LibraryEntry["media"],
        status: r["status"] as LibraryEntry["status"],
        progress: Number(r["progress"] ?? 0),
        score: r["score"] === null ? null : Number(r["score"]),
        favorite: Number(r["favorite"] ?? 0) === 1,
        startedAt: (r["started_at"] as string | null) ?? null,
        completedAt: (r["completed_at"] as string | null) ?? null,
        repeat: r["repeat_count"] === null ? null : Number(r["repeat_count"]),
        tags: normalizeTags(JSON.parse(String(r["tags"] ?? "[]")) as string[]),
        updatedAt: Number(r["updated_at"] ?? Date.now()),
        addedAt: Number(r["added_at"] ?? Date.now()),
      }));
    },
    async upsertEntries(userId, entries) {
      await ready();
      for (const e of entries) {
        await db
          .prepare(
            `INSERT INTO library_entries (user_id, media_type, media_id, status, progress, score, favorite, started_at, completed_at, repeat_count, tags, media, updated_at, added_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, media_type, media_id) DO UPDATE SET
               status = excluded.status, progress = excluded.progress, score = excluded.score,
               favorite = excluded.favorite, started_at = excluded.started_at,
               completed_at = excluded.completed_at, repeat_count = excluded.repeat_count,
               tags = excluded.tags,
               media = excluded.media, updated_at = excluded.updated_at`,
          )
          .bind(
            userId,
            typeOf(e),
            e.media.id,
            e.status,
            e.progress ?? 0,
            e.score ?? null,
            e.favorite ? 1 : 0,
            e.startedAt ?? null,
            e.completedAt ?? null,
            e.repeat ?? null,
            JSON.stringify(normalizeTags(e.tags)),
            JSON.stringify(e.media),
            e.updatedAt ?? Date.now(),
            e.addedAt ?? Date.now(),
          )
          .run();
      }
    },
    async deleteEntry(userId, type, mediaId) {
      await ready();
      await db
        .prepare(
          "DELETE FROM library_entries WHERE user_id = ? AND media_type = ? AND media_id = ?",
        )
        .bind(userId, type, mediaId)
        .run();
    },
    async replaceLibrary(userId, entries, types) {
      await ready();
      for (const t of types) {
        await db
          .prepare(
            "DELETE FROM library_entries WHERE user_id = ? AND media_type = ?",
          )
          .bind(userId, t)
          .run();
      }
      await this.upsertEntries(userId, entries);
    },

    async listNotes(userId) {
      await ready();
      const { results } = await db
        .prepare("SELECT * FROM notes WHERE user_id = ?")
        .bind(userId)
        .all<Record<string, unknown>>();
      return results.map((r) => ({
        animeId: Number(r["media_id"]),
        mediaType: r["media_type"] as MediaType,
        title: String(r["title"]),
        body: String(r["body"] ?? ""),
        tags: normalizeTags(JSON.parse(String(r["tags"] ?? "[]")) as string[]),
        updatedAt: Number(r["updated_at"] ?? Date.now()),
      }));
    },
    async saveNotes(userId, notes) {
      await ready();
      for (const n of notes) {
        await db
          .prepare(
            `INSERT INTO notes (user_id, media_type, media_id, title, body, tags, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, media_type, media_id) DO UPDATE SET
               title = excluded.title, body = excluded.body,
               tags = excluded.tags, updated_at = excluded.updated_at`,
          )
          .bind(
            userId,
            noteTypeOf(n),
            n.animeId,
            n.title,
            n.body,
            JSON.stringify(normalizeTags(n.tags)),
            n.updatedAt ?? Date.now(),
          )
          .run();
      }
    },
    async deleteNote(userId, type, mediaId) {
      await ready();
      await db
        .prepare(
          "DELETE FROM notes WHERE user_id = ? AND media_type = ? AND media_id = ?",
        )
        .bind(userId, type, mediaId)
        .run();
    },
    async replaceNotes(userId, notes, types) {
      await ready();
      for (const t of types) {
        await db
          .prepare("DELETE FROM notes WHERE user_id = ? AND media_type = ?")
          .bind(userId, t)
          .run();
      }
      await this.saveNotes(userId, notes);
    },

    async logImport(userId, entry) {
      await ready();
      await db
        .prepare(
          "INSERT INTO import_log (user_id, source, mode, count, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(userId, entry.source, entry.mode, entry.count, Date.now())
        .run();
    },
    async listImportLog(userId) {
      await ready();
      const { results } = await db
        .prepare(
          "SELECT id, source, mode, count, created_at FROM import_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
        )
        .bind(userId)
        .all<ImportLogRow>();
      return results;
    },
  };
}

/* ===================== local fallback (no D1 binding) ==================== */

type LocalShape = {
  users: StoredUser[];
  settings: Record<string, SettingsRow>;
  library: Record<string, LibraryEntry[]>;
  notes: Record<string, Note[]>;
  log: Record<string, ImportLogRow[]>;
};

const LOCAL_FILE = ".data/koka-dev-db.json";
let localState: LocalShape | null = null;

async function loadLocal(): Promise<LocalShape> {
  if (localState) return localState;
  localState = { users: [], settings: {}, library: {}, notes: {}, log: {} };
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(LOCAL_FILE, "utf8");
    localState = { ...localState, ...(JSON.parse(raw) as LocalShape) };
  } catch {
    /* first run, or no filesystem — memory only */
  }
  return localState;
}

async function persistLocal() {
  if (!localState) return;
  try {
    const fs = await import("node:fs/promises");
    await fs.mkdir(".data", { recursive: true });
    await fs.writeFile(LOCAL_FILE, JSON.stringify(localState), "utf8");
  } catch {
    /* memory only */
  }
}

function localRepo(): Repo {
  const key = (t: MediaType, id: number) => `${t}:${id}`;
  return {
    async userByEmail(email) {
      const s = await loadLocal();
      return s.users.find((u) => u.email === email.toLowerCase()) ?? null;
    },
    async userById(id) {
      const s = await loadLocal();
      return s.users.find((u) => u.id === id) ?? null;
    },
    async createUser(user) {
      const s = await loadLocal();
      s.users.push(user);
      await persistLocal();
    },
    async updateUserName(id, name) {
      const s = await loadLocal();
      const u = s.users.find((x) => x.id === id);
      if (u) u.name = name;
      await persistLocal();
    },
    async updateUserPassword(id, hash) {
      const s = await loadLocal();
      const u = s.users.find((x) => x.id === id);
      if (u) u.password_hash = hash;
      await persistLocal();
    },

    async getSettings(userId) {
      const s = await loadLocal();
      return { ...DEFAULT_SETTINGS_ROW, ...(s.settings[userId] ?? {}) };
    },
    async saveSettings(userId, row) {
      const s = await loadLocal();
      s.settings[userId] = row;
      await persistLocal();
    },

    async listLibrary(userId) {
      const s = await loadLocal();
      return s.library[userId] ?? [];
    },
    async upsertEntries(userId, entries) {
      const s = await loadLocal();
      const map = new Map(
        (s.library[userId] ?? []).map((e) => [key(typeOf(e), e.media.id), e]),
      );
      for (const e of entries) map.set(key(typeOf(e), e.media.id), e);
      s.library[userId] = [...map.values()];
      await persistLocal();
    },
    async deleteEntry(userId, type, mediaId) {
      const s = await loadLocal();
      s.library[userId] = (s.library[userId] ?? []).filter(
        (e) => !(e.media.id === mediaId && typeOf(e) === type),
      );
      await persistLocal();
    },
    async replaceLibrary(userId, entries, types) {
      const s = await loadLocal();
      s.library[userId] = [
        ...(s.library[userId] ?? []).filter((e) => !types.includes(typeOf(e))),
        ...entries,
      ];
      await persistLocal();
    },

    async listNotes(userId) {
      const s = await loadLocal();
      return s.notes[userId] ?? [];
    },
    async saveNotes(userId, notes) {
      const s = await loadLocal();
      const map = new Map(
        (s.notes[userId] ?? []).map((n) => [key(noteTypeOf(n), n.animeId), n]),
      );
      for (const n of notes) map.set(key(noteTypeOf(n), n.animeId), n);
      s.notes[userId] = [...map.values()];
      await persistLocal();
    },
    async deleteNote(userId, type, mediaId) {
      const s = await loadLocal();
      s.notes[userId] = (s.notes[userId] ?? []).filter(
        (n) => !(n.animeId === mediaId && noteTypeOf(n) === type),
      );
      await persistLocal();
    },
    async replaceNotes(userId, notes, types) {
      const s = await loadLocal();
      s.notes[userId] = [
        ...(s.notes[userId] ?? []).filter(
          (n) => !types.includes(noteTypeOf(n)),
        ),
        ...notes,
      ];
      await persistLocal();
    },

    async logImport(userId, entry) {
      const s = await loadLocal();
      const list = s.log[userId] ?? [];
      list.unshift({ id: Date.now(), created_at: Date.now(), ...entry });
      s.log[userId] = list.slice(0, 20);
      await persistLocal();
    },
    async listImportLog(userId) {
      const s = await loadLocal();
      return s.log[userId] ?? [];
    },
  };
}

export function getRepo(): Repo {
  const db = getD1();
  return db ? d1Repo(db) : localRepo();
}

export function usingD1(): boolean {
  return getD1() !== null;
}
