import { createServerFn } from "@tanstack/react-start";
import type { LibraryEntry, MediaType, Note, Settings } from "./types";

export type Bootstrap = {
  user: { id: string; email: string; name: string } | null;
  settings: Settings | null;
  mode: MediaType;
  library: LibraryEntry[];
  notes: Note[];
};

/** Everything the client needs after sign-in, in one round trip. */
export const getBootstrap = createServerFn({ method: "GET" }).handler(
  async (): Promise<Bootstrap> => {
    const { currentUser } = await import("@/server/session.server");
    const user = await currentUser();
    if (!user) {
      return {
        user: null,
        settings: null,
        mode: "ANIME",
        library: [],
        notes: [],
      };
    }
    const { getRepo } = await import("@/server/repo.server");
    const { decryptValue } = await import("@/server/crypto.server");
    const repo = getRepo();
    const [row, library, notes] = await Promise.all([
      repo.getSettings(user.id),
      repo.listLibrary(user.id),
      repo.listNotes(user.id),
    ]);
    return {
      user,
      settings: {
        geminiKey: await decryptValue(row.gemini_key),
        model: row.model,
        anilistUser: row.anilist_user,
        spoilerFree: row.spoiler_free === 1,
        theme: row.theme === "light" ? "light" : "dark",
        lightTheme: row.light_theme,
        darkTheme: row.dark_theme,
      },
      mode: row.media_mode === "MANGA" ? "MANGA" : "ANIME",
      library,
      notes,
    };
  },
);

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((data: { settings: Settings; mode: MediaType }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const { encryptValue } = await import("@/server/crypto.server");
    const user = await requireUser();
    await getRepo().saveSettings(user.id, {
      gemini_key: await encryptValue(data.settings.geminiKey ?? ""),
      model: data.settings.model,
      anilist_user: data.settings.anilistUser ?? "",
      spoiler_free: data.settings.spoilerFree ? 1 : 0,
      theme: data.settings.theme,
      light_theme: data.settings.lightTheme,
      dark_theme: data.settings.darkTheme,
      media_mode: data.mode === "MANGA" ? "MANGA" : "ANIME",
    });
    return { ok: true };
  });

export const saveEntries = createServerFn({ method: "POST" })
  .inputValidator((data: { entries: LibraryEntry[] }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().upsertEntries(user.id, data.entries);
    return { ok: true };
  });

export const removeEntry = createServerFn({ method: "POST" })
  .inputValidator((data: { mediaId: number; mediaType: MediaType }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().deleteEntry(user.id, data.mediaType, data.mediaId);
    return { ok: true };
  });

export const replaceLibrary = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { entries: LibraryEntry[]; types: MediaType[] }) => data,
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().replaceLibrary(user.id, data.entries, data.types);
    return { ok: true };
  });

export const saveNotes = createServerFn({ method: "POST" })
  .inputValidator((data: { notes: Note[] }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().saveNotes(user.id, data.notes);
    return { ok: true };
  });

export const removeNote = createServerFn({ method: "POST" })
  .inputValidator((data: { mediaId: number; mediaType: MediaType }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().deleteNote(user.id, data.mediaType, data.mediaId);
    return { ok: true };
  });

export const replaceNotes = createServerFn({ method: "POST" })
  .inputValidator((data: { notes: Note[]; types: MediaType[] }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().replaceNotes(user.id, data.notes, data.types);
    return { ok: true };
  });

export const logImport = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { source: string; mode: string; count: number }) => data,
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().logImport(user.id, data);
    return { ok: true };
  });
