import { createServerFn } from "@tanstack/react-start";
import type {
  FontOption,
  LibraryEntry,
  MediaType,
  Note,
  Settings,
  UserProfile,
} from "./types";
import type { CommunityItem } from "./community-utils";

export type Bootstrap = {
  user: { id: string; email: string; name: string } | null;
  settings: Settings | null;
  mode: MediaType;
  library: LibraryEntry[];
  notes: Note[];
  userProfile?: UserProfile | null;
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
        userProfile: null,
      };
    }
    const { getRepo } = await import("@/server/repo.server");
    const { decryptValue } = await import("@/server/crypto.server");
    const repo = getRepo();
    const [row, library, notes, userProfile] = await Promise.all([
      repo.getSettings(user.id),
      repo.listLibrary(user.id),
      repo.listNotes(user.id),
      repo.getUserProfile(user.id),
    ]);
    return {
      user,
      settings: {
        geminiKey: row.gemini_key ? "••••••••" : "",
        model: row.model,
        anilistUser: row.anilist_user,
        spoilerFree: row.spoiler_free === 1,
        theme: row.theme === "light" ? "light" : "dark",
        lightTheme: row.light_theme,
        darkTheme: row.dark_theme,
        font: (row.font as FontOption) || "default",
      },
      mode: row.media_mode === "MANGA" ? "MANGA" : "ANIME",
      library,
      notes,
      userProfile,
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
    const repo = getRepo();
    const existing = await repo.getSettings(user.id);
    let keyToSave = existing.gemini_key;
    const incomingKey = data.settings.geminiKey?.trim();
    if (incomingKey && incomingKey !== "••••••••") {
      keyToSave = await encryptValue(incomingKey);
    } else if (incomingKey === "") {
      keyToSave = "";
    }

    await repo.saveSettings(user.id, {
      gemini_key: keyToSave,
      model: data.settings.model,
      anilist_user: data.settings.anilistUser ?? "",
      spoiler_free: data.settings.spoilerFree ? 1 : 0,
      theme: data.settings.theme,
      light_theme: data.settings.lightTheme,
      dark_theme: data.settings.darkTheme,
      font: data.settings.font ?? "default",
      media_mode: data.mode === "MANGA" ? "MANGA" : "ANIME",
    });
    return { ok: true };
  });

export const callGeminiServer = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { model: string; body: Record<string, unknown> }) => data,
  )
  .handler(async ({ data }) => {
    const { currentUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const { decryptValue } = await import("@/server/crypto.server");

    let apiKey = "";
    const user = await currentUser();
    if (user) {
      const settings = await getRepo().getSettings(user.id);
      if (settings.gemini_key) {
        apiKey = await decryptValue(settings.gemini_key);
      }
    }

    if (!apiKey) {
      throw new Error(
        "No Gemini API key configured. Please add one in Settings to use AI features.",
      );
    }

    const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
    const res = await fetch(
      `${BASE}/${encodeURIComponent(data.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.body),
      },
    );

    const json = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) {
      throw new Error(json.error?.message ?? `Gemini error ${res.status}`);
    }
    return json;
  });

export const listGeminiModelsServer = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const { currentUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const { decryptValue } = await import("@/server/crypto.server");

    let apiKey = "";
    const user = await currentUser();
    if (user) {
      const settings = await getRepo().getSettings(user.id);
      if (settings.gemini_key) {
        apiKey = await decryptValue(settings.gemini_key);
      }
    }

    if (!apiKey) {
      return [];
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      );
      if (!res.ok) return [];
      const data = (await res.json()) as {
        models?: Array<{
          name: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      return (data.models || [])
        .filter((m) =>
          m.supportedGenerationMethods?.includes("generateContent"),
        )
        .map((m) => m.name.replace(/^models\//, ""))
        .filter((name) => name.startsWith("gemini"));
    } catch {
      return [];
    }
  },
);

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

export const removeEntries = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { entries: { mediaId: number; mediaType: MediaType }[] }) => data,
  )
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().deleteEntries(user.id, data.entries);
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

export const saveCommunities = createServerFn({ method: "POST" })
  .inputValidator((data: { communities: CommunityItem[] }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().upsertCommunities(user.id, data.communities);
    return { ok: true };
  });

export const removeCommunity = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().deleteCommunity(user.id, data.id);
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

export const clearLibraryAndNotes = createServerFn({ method: "POST" }).handler(
  async () => {
    const { currentUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await currentUser();
    if (!user) return { ok: true };
    await getRepo().clearLibraryAndNotes(user.id);
    return { ok: true };
  },
);

export const saveUserProfileFn = createServerFn({ method: "POST" })
  .inputValidator((data: { profile: UserProfile }) => data)
  .handler(async ({ data }) => {
    const { requireUser } = await import("@/server/session.server");
    const { getRepo } = await import("@/server/repo.server");
    const user = await requireUser();
    await getRepo().saveUserProfile(user.id, data.profile);
    return { ok: true };
  });
