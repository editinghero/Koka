import type {
  AnimeMedia,
  LibraryEntry,
  MediaType,
  Note,
  WatchStatus,
} from "./types";

const ENDPOINT = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  idMal
  type
  title { romaji english native }
  coverImage { large extraLarge color }
  bannerImage
  format
  episodes
  chapters
  volumes
  duration
  status
  season
  seasonYear
  genres
  averageScore
  popularity
  siteUrl
  description(asHtml: false)
  startDate { year month day }
  studios(isMain: true) { nodes { name } }
  nextAiringEpisode { episode airingAt }
`;

type RawMedia = {
  id: number;
  idMal?: number | null;
  type?: string | null;
  title: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; extraLarge?: string };
  bannerImage?: string | null;
  format?: string | null;
  episodes?: number | null;
  chapters?: number | null;
  volumes?: number | null;
  duration?: number | null;
  status?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  genres?: string[];
  averageScore?: number | null;
  popularity?: number | null;
  siteUrl?: string | null;
  description?: string | null;
  startDate?: { year?: number; month?: number; day?: number };
  studios?: { nodes?: { name: string }[] };
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
};

export function normalizeMedia(m: RawMedia): AnimeMedia {
  const d = m.startDate;
  return {
    id: m.id,
    malId: m.idMal ?? null,
    type: m.type === "MANGA" ? "MANGA" : "ANIME",
    title: m.title?.english || m.title?.romaji || m.title?.native || "Untitled",
    titleNative: m.title?.native ?? null,
    cover: m.coverImage?.extraLarge || m.coverImage?.large || null,
    banner: m.bannerImage ?? null,
    format: m.format ?? null,
    episodes: m.episodes ?? null,
    chapters: m.chapters ?? null,
    volumes: m.volumes ?? null,
    duration: m.duration ?? null,
    airingStatus: m.status ?? null,
    season: m.season ?? null,
    seasonYear: m.seasonYear ?? null,
    genres: m.genres ?? [],
    studios: m.studios?.nodes?.map((s) => s.name) ?? [],
    averageScore: m.averageScore ?? null,
    popularity: m.popularity ?? null,
    siteUrl: m.siteUrl ?? null,
    description: m.description ? m.description.replace(/<[^>]+>/g, "") : null,
    startDate: d?.year ? `${d.year}-${d.month ?? 1}-${d.day ?? 1}` : null,
    nextEpisode: m.nextAiringEpisode ?? null,
  };
}

export async function anilist<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (!res.ok || json.errors) {
    throw new Error(json.errors?.[0]?.message ?? `AniList error ${res.status}`);
  }
  return json.data as T;
}

export type DiscoverParams = {
  type?: MediaType;
  season?: string | null;
  seasonYear?: number | null;
  sort?: string;
  genre?: string | null;
  isAdult?: boolean;
  page?: number;
};

export async function fetchDiscover(
  params: DiscoverParams = {},
): Promise<AnimeMedia[]> {
  const {
    type = "ANIME",
    season,
    seasonYear,
    sort = "POPULARITY_DESC",
    genre,
    isAdult = false,
    page = 1,
  } = params;

  const isAdultFlag = isAdult || genre === "Hentai" || genre === "Adult (18+)";
  const genreParam =
    genre === "Adult (18+)" || genre === "Hentai"
      ? "Hentai"
      : genre && genre !== "ALL"
        ? genre
        : undefined;

  const variables: Record<string, unknown> = {
    type,
    sort: [sort],
    isAdult: isAdultFlag,
    page,
  };
  if (season && seasonYear) {
    variables.season = season;
    variables.seasonYear = seasonYear;
  }
  if (genreParam) {
    variables.genre = genreParam;
  }

  const query = `query ($type: MediaType, $sort: [MediaSort], $genre: String, $season: MediaSeason, $seasonYear: Int, $isAdult: Boolean, $page: Int) {
    Page(page: $page, perPage: 40) {
      media(type: $type, sort: $sort, genre: $genre, season: $season, seasonYear: $seasonYear, isAdult: $isAdult) { ${MEDIA_FIELDS} }
    }
  }`;

  const data = await anilist<{ Page: { media: RawMedia[] } }>(query, variables);
  return data.Page.media.map(normalizeMedia);
}

export async function fetchSeason(
  season: string,
  seasonYear: number,
  page = 1,
  sort = "POPULARITY_DESC",
  genre?: string | null,
  isAdult = false,
): Promise<AnimeMedia[]> {
  return fetchDiscover({
    type: "ANIME",
    season,
    seasonYear,
    sort,
    genre,
    isAdult,
    page,
  });
}

/** Trending/popular list — used for browse / discover with genre and adult support. */
export async function fetchTrending(
  type: MediaType = "MANGA",
  sort: string = "TRENDING_DESC",
  page = 1,
  genre?: string | null,
  isAdult = false,
): Promise<AnimeMedia[]> {
  return fetchDiscover({
    type,
    sort,
    genre,
    isAdult,
    page,
  });
}

export async function searchAnime(
  search: string,
  type: MediaType = "ANIME",
): Promise<AnimeMedia[]> {
  if (!search.trim()) return [];
  const data = await anilist<{ Page: { media: RawMedia[] } }>(
    `query ($search: String, $type: MediaType) {
      Page(page: 1, perPage: 20) {
        media(search: $search, type: $type, sort: SEARCH_MATCH, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }`,
    { search, type },
  );
  return data.Page.media.map(normalizeMedia);
}

let lastScheduleFetchMs = 0;
const cachedScheduleMap = new Map<
  number,
  { episode: number; airingAt: number } | null
>();

export async function fetchNextAiringEpisodes(
  ids: number[],
  force = false,
): Promise<Map<number, { episode: number; airingAt: number } | null>> {
  if (!ids.length) return new Map();
  const now = Date.now();
  if (
    !force &&
    now - lastScheduleFetchMs < 3 * 60 * 1000 &&
    cachedScheduleMap.size > 0
  ) {
    const result = new Map<
      number,
      { episode: number; airingAt: number } | null
    >();
    ids.forEach((id) => {
      if (cachedScheduleMap.has(id)) {
        result.set(id, cachedScheduleMap.get(id) ?? null);
      }
    });
    return result;
  }

  try {
    const data = await anilist<{
      Page: {
        media: {
          id: number;
          nextAiringEpisode?: { episode: number; airingAt: number } | null;
        }[];
      };
    }>(
      `query ($ids: [Int]) {
        Page(page: 1, perPage: 50) {
          media(id_in: $ids, type: ANIME) {
            id
            nextAiringEpisode { episode airingAt }
          }
        }
      }`,
      { ids: ids.slice(0, 50) },
    );
    data.Page.media.forEach((m) => {
      cachedScheduleMap.set(m.id, m.nextAiringEpisode ?? null);
    });
    lastScheduleFetchMs = now;

    const result = new Map<
      number,
      { episode: number; airingAt: number } | null
    >();
    ids.forEach((id) => {
      result.set(id, cachedScheduleMap.get(id) ?? null);
    });
    return result;
  } catch {
    return cachedScheduleMap;
  }
}

export async function fetchByIds(
  ids: number[],
  type: MediaType = "ANIME",
): Promise<AnimeMedia[]> {
  const out: AnimeMedia[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await anilist<{ Page: { media: RawMedia[] } }>(
      `query ($ids: [Int], $type: MediaType) {
        Page(page: 1, perPage: 50) { media(id_in: $ids, type: $type) { ${MEDIA_FIELDS} } }
      }`,
      { ids: chunk, type },
    );
    out.push(...data.Page.media.map(normalizeMedia));
    if (i + 50 < ids.length) await new Promise((r) => setTimeout(r, 700));
  }
  return out;
}

export async function fetchByMalIds(
  ids: number[],
  type: MediaType = "ANIME",
): Promise<AnimeMedia[]> {
  const out: AnimeMedia[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await anilist<{ Page: { media: RawMedia[] } }>(
      `query ($ids: [Int], $type: MediaType) {
        Page(page: 1, perPage: 50) { media(idMal_in: $ids, type: $type) { ${MEDIA_FIELDS} } }
      }`,
      { ids: chunk, type },
    );
    out.push(...data.Page.media.map(normalizeMedia));
    if (i + 50 < ids.length) await new Promise((r) => setTimeout(r, 700));
  }
  return out;
}

type FuzzyDate = {
  year?: number | null;
  month?: number | null;
  day?: number | null;
};

export function fuzzyToIso(d?: FuzzyDate | null): string | null {
  if (!d?.year) return null;
  const p = (n?: number | null) => String(n ?? 1).padStart(2, "0");
  return `${d.year}-${p(d.month)}-${p(d.day)}`;
}

export async function fetchUserList(
  username: string,
  type: MediaType = "ANIME",
): Promise<{ entries: LibraryEntry[]; notes: Note[] }> {
  const data = await anilist<{
    MediaListCollection: {
      lists: {
        name: string;
        isCustomList?: boolean;
        entries: {
          status: WatchStatus;
          progress: number;
          score: number;
          repeat?: number | null;
          notes?: string | null;
          startedAt?: FuzzyDate | null;
          completedAt?: FuzzyDate | null;
          updatedAt: number;
          media: RawMedia;
        }[];
      }[];
    };
  }>(
    `query ($user: String, $type: MediaType) {
      MediaListCollection(userName: $user, type: $type) {
        lists { name isCustomList entries {
          status progress score(format: POINT_10_DECIMAL) repeat notes updatedAt
          startedAt { year month day }
          completedAt { year month day }
          media { ${MEDIA_FIELDS} }
        } }
      }
    }`,
    { user: username, type },
  );
  const now = Date.now();
  const entriesMap = new Map<number, LibraryEntry>();
  const notes: Note[] = [];

  for (const list of data.MediaListCollection.lists) {
    const listNameLower = list.name.trim().toLowerCase();
    const isCustom = Boolean(list.isCustomList);

    for (const e of list.entries) {
      const media = normalizeMedia(e.media);
      const existing = entriesMap.get(media.id);
      const customLists = isCustom
        ? Array.from(new Set([...(existing?.customLists ?? []), listNameLower]))
        : (existing?.customLists ?? []);

      const entry: LibraryEntry = {
        media,
        status: e.status ?? existing?.status ?? "PLANNING",
        progress: e.progress ?? existing?.progress ?? 0,
        score: Number(e.score) || existing?.score || null,
        repeat: e.repeat ?? existing?.repeat ?? null,
        startedAt: fuzzyToIso(e.startedAt) ?? existing?.startedAt ?? null,
        completedAt: fuzzyToIso(e.completedAt) ?? existing?.completedAt ?? null,
        customLists,
        updatedAt: e.updatedAt ? e.updatedAt * 1000 : now,
        addedAt: existing?.addedAt ?? now,
      };

      entriesMap.set(media.id, entry);

      if (e.notes?.trim() && !notes.some((n) => n.animeId === media.id)) {
        notes.push({
          animeId: media.id,
          mediaType: media.type ?? "ANIME",
          title: media.title,
          body: e.notes.trim(),
          tags: ["anilist"],
          updatedAt: e.updatedAt ? e.updatedAt * 1000 : now,
        });
      }
    }
  }

  return { entries: Array.from(entriesMap.values()), notes };
}

export function currentSeason(date = new Date()) {
  const m = date.getMonth();
  const season =
    m < 3 ? "WINTER" : m < 6 ? "SPRING" : m < 9 ? "SUMMER" : "FALL";
  return { season, year: date.getFullYear() };
}

export function nextSeason(season: string, year: number) {
  const order = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const i = order.indexOf(season);
  return i === 3
    ? { season: "WINTER", year: year + 1 }
    : { season: order[i + 1], year };
}

export function prevSeason(season: string, year: number) {
  const order = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const i = order.indexOf(season);
  return i === 0
    ? { season: "FALL", year: year - 1 }
    : { season: order[i - 1], year };
}
