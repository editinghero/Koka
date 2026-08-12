export type MediaType = "ANIME" | "MANGA";

export type WatchStatus =
  "CURRENT" | "PLANNING" | "COMPLETED" | "PAUSED" | "DROPPED" | "REPEATING";

export const STATUS_LABEL: Record<WatchStatus, string> = {
  CURRENT: "Watching",
  PLANNING: "Planned",
  COMPLETED: "Completed",
  PAUSED: "On hold",
  DROPPED: "Dropped",
  REPEATING: "Rewatching",
};

export const MANGA_STATUS_LABEL: Record<WatchStatus, string> = {
  CURRENT: "Reading",
  PLANNING: "Planned",
  COMPLETED: "Completed",
  PAUSED: "On hold",
  DROPPED: "Dropped",
  REPEATING: "Rereading",
};

export function statusLabel(status: WatchStatus, type: MediaType = "ANIME") {
  return type === "MANGA" ? MANGA_STATUS_LABEL[status] : STATUS_LABEL[status];
}

/** Wording that changes between the anime and manga sides of the app. */
export const MODE_COPY: Record<
  MediaType,
  {
    noun: string;
    nounPlural: string;
    verb: string;
    verbPast: string;
    unit: string;
    unitShort: string;
    timeLabel: string;
  }
> = {
  ANIME: {
    noun: "anime",
    nounPlural: "anime",
    verb: "watch",
    verbPast: "watched",
    unit: "episodes",
    unitShort: "eps",
    timeLabel: "Hours watched",
  },
  MANGA: {
    noun: "manga",
    nounPlural: "manga",
    verb: "read",
    verbPast: "read",
    unit: "chapters",
    unitShort: "ch",
    timeLabel: "Hours read",
  },
};

export const STATUS_ORDER: WatchStatus[] = [
  "CURRENT",
  "REPEATING",
  "PLANNING",
  "COMPLETED",
  "PAUSED",
  "DROPPED",
];

export type AnimeMedia = {
  id: number;
  malId?: number | null;
  /** ANIME by default — manga entries set this explicitly */
  type?: MediaType;
  title: string;
  titleNative?: string | null;
  cover?: string | null;
  banner?: string | null;
  format?: string | null;
  episodes?: number | null;
  /** manga only */
  chapters?: number | null;
  /** manga only */
  volumes?: number | null;
  duration?: number | null;
  airingStatus?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  genres?: string[];
  studios?: string[];
  averageScore?: number | null;
  popularity?: number | null;
  siteUrl?: string | null;
  description?: string | null;
  startDate?: string | null;
  nextEpisode?: { episode: number; airingAt: number } | null;
};

/** Total units (episodes for anime, chapters for manga). */
export function totalUnits(media: AnimeMedia) {
  return media.type === "MANGA"
    ? (media.chapters ?? null)
    : (media.episodes ?? null);
}

export function mediaTypeOf(media: AnimeMedia): MediaType {
  return media.type === "MANGA" ? "MANGA" : "ANIME";
}

export type LibraryEntry = {
  media: AnimeMedia;
  status: WatchStatus;
  progress: number;
  score?: number | null;
  favorite?: boolean;
  /** ISO date the user started watching/reading (imported from AniList/MAL) */
  startedAt?: string | null;
  /** ISO date the user finished */
  completedAt?: string | null;
  /** times rewatched / reread */
  repeat?: number | null;
  /** Custom user tags e.g. ["ecchi", "fav", "must-watch"] */
  tags?: string[];
  /** Custom lists e.g. ["calm"] */
  customLists?: string[];
  updatedAt: number;
  addedAt: number;
};

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function normalizeTags(tags?: string[] | null): string[] {
  if (!tags || !tags.length) return [];
  const clean = tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(clean));
}

export type ChatMessage = {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
};

export type Note = {
  animeId: number;
  /** ANIME by default */
  mediaType?: MediaType;
  title: string;
  body: string;
  tags: string[];
  updatedAt: number;
};

export type Settings = {
  geminiKey: string;
  model: string;
  anilistUser: string;
  spoilerFree: boolean;
  theme: "light" | "dark";
  /** preset id used while in light mode */
  lightTheme: string;
  /** preset id used while in dark mode */
  darkTheme: string;
};

export const DEFAULT_SETTINGS: Settings = {
  geminiKey: "",
  model: "gemini-2.5-flash",
  anilistUser: "",
  spoilerFree: true,
  theme: "dark",
  lightTheme: "paper",
  darkTheme: "koka",
};

/** Models available on Google's free tier of the Gemini API. */
export const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];
