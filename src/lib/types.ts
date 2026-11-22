export type MediaType = "ANIME" | "MANGA";

export type WatchStatus =
  | "CURRENT"
  | "PLANNING"
  | "COMPLETED"
  | "PAUSED"
  | "DROPPED"
  | "REPEATING";

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

export type StatusDistributionItem = {
  status: string;
  amount: number;
};

export type MediaRanking = {
  id: number;
  rank: number;
  type: string;
  context: string;
  year?: number | null;
  season?: string | null;
  allTime?: boolean | null;
};

export type MediaCharacter = {
  id: number;
  role: string;
  name: string;
  image?: string | null;
};

export type MediaStaff = {
  id: number;
  role: string;
  name: string;
  image?: string | null;
};

export type MediaExternalLink = {
  id: number;
  site: string;
  url: string;
  type?: string | null;
  icon?: string | null;
};

export type MediaRelation = {
  relationType: string;
  id: number;
  type?: MediaType;
  title: string;
  format?: string | null;
  status?: string | null;
  cover?: string | null;
};

export type MediaRecommendation = {
  id: number;
  type?: MediaType;
  title: string;
  cover?: string | null;
  format?: string | null;
  averageScore?: number | null;
};

export type AiringScheduleItem = {
  episode: number;
  airingAt: number;
};

export type AnimeMedia = {
  id: number;
  malId?: number | null;
  /** ANIME by default — manga entries set this explicitly */
  type?: MediaType;
  title: string;
  titleNative?: string | null;
  englishTitle?: string | null;
  romajiTitle?: string | null;
  synonyms?: string[];
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
  /** Alias for airingStatus for convenience & exports */
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  genres?: string[];
  studios?: string[];
  allStudios?: { name: string; isMain?: boolean }[];
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  siteUrl?: string | null;
  description?: string | null;
  startDate?: string | null;
  nextEpisode?: { episode: number; airingAt: number } | null;
  rankings?: MediaRanking[];
  statusDistribution?: StatusDistributionItem[];
  tags?: string[];
  isAdult?: boolean | null;
  countryOfOrigin?: string | null;
  characters?: MediaCharacter[];
  staff?: MediaStaff[];
  externalLinks?: MediaExternalLink[];
  relations?: MediaRelation[];
  recommendations?: MediaRecommendation[];
  airingSchedule?: AiringScheduleItem[];
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

export type CustomLink = {
  label: string;
  url: string;
  isPrimary: boolean;
};

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
  /** whether user is currently rewatching / rereading */
  isRewatching?: boolean;
  /** Custom user links (e.g. streaming site, seasons) */
  customLinks?: CustomLink[];
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
  const clean = tags
    .map((t) => String(t).trim().toLowerCase())
    .filter((t) => Boolean(t) && t !== "anilist");
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
  tags?: string[];
  updatedAt: number;
};

export type FontOption =
  | "default"
  | "satoshi"
  | "baloo2"
  | "outfit"
  | "spacegrotesk"
  | "nunito"
  | "agravepro"
  | "playfair";

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
  font?: FontOption;
};

export const DEFAULT_SETTINGS: Settings = {
  geminiKey: "",
  model: "gemini-3.5-flash-lite",
  anilistUser: "",
  spoilerFree: true,
  theme: "dark",
  lightTheme: "paper",
  darkTheme: "umi",
  font: "default",
};

/** Models available on Google's Gemini API (with latest 3.5+, 3.8, and 4 Hydrogen). */
export const GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

export type FavoriteMedia = {
  id: number;
  title: string;
  cover?: string | null;
  format?: string | null;
  year?: number | null;
};

export type FavoriteCharacter = {
  id: number;
  name: string;
  image?: string | null;
};

export type FavoriteStaff = {
  id: number;
  name: string;
  image?: string | null;
  occupations?: string[];
};

export type UserStatItem = {
  label: string;
  count: number;
  meanScore?: number | null;
  minutesWatched?: number | null;
  image?: string | null;
};

export type UserStats = {
  count: number;
  meanScore: number;
  minutesWatched?: number;
  episodesWatched?: number;
  chaptersRead?: number;
  volumesRead?: number;
  statuses?: UserStatItem[];
  formats?: UserStatItem[];
  scores?: UserStatItem[];
  genres?: UserStatItem[];
  studios?: UserStatItem[];
  voiceActors?: UserStatItem[];
};

export type UserProfile = {
  id: number;
  name: string;
  about?: string | null;
  avatar?: string | null;
  banner?: string | null;
  siteUrl?: string | null;
  favorites?: {
    anime?: FavoriteMedia[];
    manga?: FavoriteMedia[];
    characters?: FavoriteCharacter[];
    voiceActors?: FavoriteStaff[];
  };
  animeStats?: UserStats | null;
  mangaStats?: UserStats | null;
  updatedAt: number;
};
