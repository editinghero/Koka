import type {
  AnimeMedia,
  LibraryEntry,
  MediaRanking,
  MediaType,
  Note,
  StatusDistributionItem,
  UserProfile,
  WatchStatus,
} from "./types";

export type { AnimeMedia };

const ENDPOINT = "https://graphql.anilist.co";

const MEDIA_FIELDS = `
  id
  idMal
  type
  title { userPreferred romaji english native }
  synonyms
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
  tags { id name rank isMediaSpoiler isGeneralSpoiler }
  averageScore
  meanScore
  popularity
  isAdult
  countryOfOrigin
  siteUrl
  description(asHtml: false)
  startDate { year month day }
  studios { edges { isMain node { id name siteUrl } } }
  nextAiringEpisode { episode airingAt }
  airingSchedule(perPage: 25) { nodes { episode airingAt } }
  externalLinks { id site url type icon }
  relations { edges { relationType node { id type title { userPreferred romaji english } coverImage { medium large } format status } } }
  recommendations(perPage: 10, sort: [RATING_DESC]) { nodes { mediaRecommendation { id type title { userPreferred romaji english } coverImage { medium large } format averageScore } } }
  characters(perPage: 12, sort: [ROLE, RELEVANCE]) { edges { role node { id name { full native } image { large medium } } } }
  staff(perPage: 8) { edges { role node { id name { full native } image { large medium } } } }
  rankings {
    id
    rank
    type
    context
    year
    season
    allTime
  }
  stats {
    statusDistribution {
      status
      amount
    }
  }
`;

type RawMedia = {
  id: number;
  idMal?: number | null;
  type?: string | null;
  title: { userPreferred?: string; romaji?: string; english?: string; native?: string };
  synonyms?: string[];
  coverImage?: { large?: string; extraLarge?: string; color?: string };
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
  tags?: { id: number; name: string; rank?: number; isMediaSpoiler?: boolean }[];
  averageScore?: number | null;
  meanScore?: number | null;
  popularity?: number | null;
  isAdult?: boolean | null;
  countryOfOrigin?: string | null;
  siteUrl?: string | null;
  description?: string | null;
  startDate?: { year?: number; month?: number; day?: number };
  studios?: {
    edges?: { isMain?: boolean; node?: { id: number; name: string; siteUrl?: string } }[];
    nodes?: { name: string }[];
  };
  nextAiringEpisode?: { episode: number; airingAt: number } | null;
  airingSchedule?: { nodes?: { episode: number; airingAt: number }[] };
  externalLinks?: { id: number; site: string; url: string; type?: string; icon?: string }[];
  relations?: {
    edges?: {
      relationType: string;
      node?: {
        id: number;
        type?: string;
        title?: { userPreferred?: string; romaji?: string; english?: string };
        coverImage?: { medium?: string; large?: string };
        format?: string;
        status?: string;
      };
    }[];
  };
  recommendations?: {
    nodes?: {
      mediaRecommendation?: {
        id: number;
        type?: string;
        title?: { userPreferred?: string; romaji?: string; english?: string };
        coverImage?: { medium?: string; large?: string };
        format?: string;
        averageScore?: number;
      };
    }[];
  };
  characters?: {
    edges?: {
      role: string;
      node?: {
        id: number;
        name?: { full?: string; native?: string };
        image?: { large?: string; medium?: string };
      };
    }[];
  };
  staff?: {
    edges?: {
      role: string;
      node?: {
        id: number;
        name?: { full?: string; native?: string };
        image?: { large?: string; medium?: string };
      };
    }[];
  };
  rankings?: MediaRanking[];
  stats?: {
    statusDistribution?: StatusDistributionItem[];
  };
};

export function normalizeMedia(m: RawMedia): AnimeMedia {
  const d = m.startDate;
  const mainStudios =
    m.studios?.edges
      ?.filter((e) => e.isMain && e.node?.name)
      .map((e) => e.node!.name) ??
    m.studios?.nodes?.map((s) => s.name) ??
    [];

  const allStudiosList =
    m.studios?.edges
      ?.filter((e) => e.node?.name)
      .map((e) => ({ name: e.node!.name, isMain: Boolean(e.isMain) })) ?? [];

  return {
    id: m.id,
    malId: m.idMal ?? null,
    type: m.type === "MANGA" ? "MANGA" : "ANIME",
    title:
      m.title?.english ||
      m.title?.romaji ||
      m.title?.userPreferred ||
      m.title?.native ||
      "Untitled",
    titleNative: m.title?.native ?? null,
    englishTitle: m.title?.english ?? null,
    romajiTitle: m.title?.romaji ?? null,
    synonyms: m.synonyms ?? [],
    cover: m.coverImage?.extraLarge || m.coverImage?.large || null,
    banner: m.bannerImage ?? null,
    format: m.format ?? null,
    episodes: m.episodes ?? null,
    chapters: m.chapters ?? null,
    volumes: m.volumes ?? null,
    duration: m.duration ?? null,
    airingStatus: m.status ?? null,
    status: m.status ?? null,
    season: m.season ?? null,
    seasonYear: m.seasonYear ?? null,
    genres: m.genres ?? [],
    studios: mainStudios,
    allStudios: allStudiosList,
    tags:
      m.tags
        ?.map((t) => t.name)
        .filter((name) => name.toLowerCase().trim() !== "anilist") ?? [],
    averageScore: m.averageScore ?? null,
    meanScore: m.meanScore ?? null,
    popularity: m.popularity ?? null,
    isAdult: m.isAdult ?? null,
    countryOfOrigin: m.countryOfOrigin ?? null,
    siteUrl: m.siteUrl ?? null,
    description: m.description ? m.description.replace(/<[^>]+>/g, "") : null,
    startDate: d?.year ? `${d.year}-${d.month ?? 1}-${d.day ?? 1}` : null,
    nextEpisode: m.nextAiringEpisode ?? null,
    rankings: m.rankings ?? [],
    statusDistribution: m.stats?.statusDistribution ?? [],
    characters:
      m.characters?.edges?.map((e) => ({
        id: e.node?.id ?? 0,
        role: e.role,
        name: e.node?.name?.full || e.node?.name?.native || "Unknown",
        image: e.node?.image?.large || e.node?.image?.medium || null,
      })) ?? [],
    staff:
      m.staff?.edges?.map((e) => ({
        id: e.node?.id ?? 0,
        role: e.role,
        name: e.node?.name?.full || e.node?.name?.native || "Unknown",
        image: e.node?.image?.large || e.node?.image?.medium || null,
      })) ?? [],
    externalLinks:
      m.externalLinks?.map((l) => ({
        id: l.id,
        site: l.site,
        url: l.url,
        type: l.type ?? null,
        icon: l.icon ?? null,
      })) ?? [],
    relations:
      m.relations?.edges?.map((e) => ({
        relationType: e.relationType,
        id: e.node?.id ?? 0,
        type: (e.node?.type as MediaType) || "ANIME",
        title:
          e.node?.title?.english ||
          e.node?.title?.romaji ||
          e.node?.title?.userPreferred ||
          "Untitled",
        format: e.node?.format ?? null,
        status: e.node?.status ?? null,
        cover: e.node?.coverImage?.large || e.node?.coverImage?.medium || null,
      })) ?? [],
    recommendations:
      m.recommendations?.nodes
        ?.filter((n) => n.mediaRecommendation)
        .map((n) => {
          const rec = n.mediaRecommendation!;
          return {
            id: rec.id,
            type: (rec.type as MediaType) || "ANIME",
            title:
              rec.title?.english ||
              rec.title?.romaji ||
              rec.title?.userPreferred ||
              "Untitled",
            format: rec.format ?? null,
            averageScore: rec.averageScore ?? null,
            cover:
              rec.coverImage?.large || rec.coverImage?.medium || null,
          };
        }) ?? [],
    airingSchedule:
      m.airingSchedule?.nodes?.map((s) => ({
        episode: s.episode,
        airingAt: s.airingAt,
      })) ?? [],
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
  type?: MediaType | undefined;
  season?: string | null | undefined;
  seasonYear?: number | null | undefined;
  sort?: string | undefined;
  genre?: string | null | undefined;
  genres?: string[] | undefined;
  format?: string | null | undefined;
  formats?: string[] | undefined;
  status?: string | null | undefined;
  source?: string | null | undefined;
  minScore?: number | undefined;
  isAdult?: boolean | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
  search?: string | undefined;
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
    genres,
    format,
    formats,
    status,
    source,
    minScore,
    isAdult = false,
    page = 1,
    perPage = 40,
    search,
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
    perPage,
  };
  if (season && seasonYear) {
    variables["season"] = season;
    variables["seasonYear"] = seasonYear;
  }
  if (genreParam) {
    variables["genre"] = genreParam;
  }
  if (genres && genres.length > 0) {
    variables["genres"] = genres.filter((g) => g !== "ALL");
  }
  if (format && format !== "ALL") {
    variables["format"] = format;
  }
  if (formats && formats.length > 0) {
    variables["formats"] = formats.filter((f) => f !== "ALL");
  }
  if (status && status !== "ALL") {
    variables["status"] = status;
  }
  if (source && source !== "ALL") {
    variables["source"] = source;
  }
  if (search && search.trim()) {
    variables["search"] = search.trim();
  }

  const query = `query (
    $type: MediaType,
    $sort: [MediaSort],
    $genre: String,
    $genres: [String],
    $format: MediaFormat,
    $formats: [MediaFormat],
    $status: MediaStatus,
    $source: MediaSource,
    $season: MediaSeason,
    $seasonYear: Int,
    $isAdult: Boolean,
    $search: String,
    $page: Int,
    $perPage: Int
  ) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        perPage
        currentPage
        lastPage
        hasNextPage
      }
      media(
        type: $type,
        sort: $sort,
        genre: $genre,
        genre_in: $genres,
        format: $format,
        format_in: $formats,
        status: $status,
        source: $source,
        season: $season,
        seasonYear: $seasonYear,
        isAdult: $isAdult,
        search: $search
      ) { ${MEDIA_FIELDS} }
    }
  }`;

  const data = await anilist<{ Page: { media: RawMedia[]; pageInfo?: unknown } }>(
    query,
    variables,
  );
  let list = data.Page.media.map(normalizeMedia);
  if (minScore && minScore > 0) {
    list = list.filter((m) => (m.averageScore ?? m.meanScore ?? 0) >= minScore);
  }
  return list;
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
          mediaType: type ?? (media.type === "MANGA" ? "MANGA" : "ANIME"),
          title: media.title,
          body: e.notes.trim(),
          tags: [],
          updatedAt: e.updatedAt ? e.updatedAt * 1000 : now,
        });
      }
    }
  }

  return { entries: Array.from(entriesMap.values()), notes };
}

export async function fetchUserProfile(
  username: string,
): Promise<UserProfile | null> {
  const data = await anilist<{
    User: {
      id: number;
      name: string;
      about?: string | null;
      avatar?: { large?: string | null; medium?: string | null } | null;
      bannerImage?: string | null;
      siteUrl?: string | null;
      favourites?: {
        anime?: {
          nodes?: Array<{
            id: number;
            title?: { userPreferred?: string; english?: string; romaji?: string } | null;
            coverImage?: { medium?: string | null; large?: string | null } | null;
            format?: string | null;
            seasonYear?: number | null;
          }>;
        };
        manga?: {
          nodes?: Array<{
            id: number;
            title?: { userPreferred?: string; english?: string; romaji?: string } | null;
            coverImage?: { medium?: string | null; large?: string | null } | null;
            format?: string | null;
            startDate?: { year?: number | null } | null;
          }>;
        };
        characters?: {
          nodes?: Array<{
            id: number;
            name?: { userPreferred?: string; full?: string } | null;
            image?: { medium?: string | null; large?: string | null } | null;
          }>;
        };
        staff?: {
          nodes?: Array<{
            id: number;
            name?: { userPreferred?: string; full?: string } | null;
            image?: { medium?: string | null; large?: string | null } | null;
            primaryOccupations?: string[] | null;
          }>;
        };
      };
      statistics?: {
        anime?: {
          count: number;
          meanScore: number;
          minutesWatched?: number;
          episodesWatched?: number;
          statuses?: Array<{ status: string; count: number; meanScore?: number | null; minutesWatched?: number | null }>;
          formats?: Array<{ format: string; count: number }>;
          scores?: Array<{ score: number; count: number }>;
          genres?: Array<{ genre: string; count: number; meanScore?: number | null; minutesWatched?: number | null }>;
          studios?: Array<{ studio?: { id: number; name: string } | null; count: number; meanScore?: number | null }>;
          voiceActors?: Array<{ voiceActor?: { id: number; name?: { userPreferred?: string } | null; image?: { medium?: string | null } | null } | null; count: number; meanScore?: number | null }>;
        };
        manga?: {
          count: number;
          meanScore: number;
          chaptersRead?: number;
          volumesRead?: number;
          statuses?: Array<{ status: string; count: number; meanScore?: number | null }>;
          formats?: Array<{ format: string; count: number }>;
          scores?: Array<{ score: number; count: number }>;
          genres?: Array<{ genre: string; count: number; meanScore?: number | null }>;
        };
      };
    };
  }>(
    `query ($name: String) {
      User(name: $name) {
        id
        name
        about(asHtml: false)
        avatar { large medium }
        bannerImage
        siteUrl
        favourites {
          anime {
            nodes {
              id
              title { userPreferred english romaji }
              coverImage { medium large }
              format
              seasonYear
            }
          }
          manga {
            nodes {
              id
              title { userPreferred english romaji }
              coverImage { medium large }
              format
              startDate { year }
            }
          }
          characters {
            nodes {
              id
              name { userPreferred full }
              image { medium large }
            }
          }
          staff {
            nodes {
              id
              name { userPreferred full }
              image { medium large }
              primaryOccupations
            }
          }
        }
        statistics {
          anime {
            count
            meanScore
            minutesWatched
            episodesWatched
            statuses { status count meanScore minutesWatched }
            formats { format count }
            scores { score count }
            genres { genre count meanScore minutesWatched }
            studios { studio { id name } count meanScore }
            voiceActors { voiceActor { id name { userPreferred } image { medium } } count meanScore }
          }
          manga {
            count
            meanScore
            chaptersRead
            volumesRead
            statuses { status count meanScore }
            formats { format count }
            scores { score count }
            genres { genre count meanScore }
          }
        }
      }
    }`,
    { name: username },
  );

  const u = data.User;
  if (!u) return null;

  return {
    id: u.id,
    name: u.name,
    about: u.about ?? null,
    avatar: u.avatar?.large ?? u.avatar?.medium ?? null,
    banner: u.bannerImage ?? null,
    siteUrl: u.siteUrl ?? null,
    favorites: {
      anime:
        u.favourites?.anime?.nodes?.map((a) => ({
          id: a.id,
          title:
            a.title?.english ??
            a.title?.romaji ??
            a.title?.userPreferred ??
            "Unknown",
          cover: a.coverImage?.large ?? a.coverImage?.medium ?? null,
          format: a.format ?? null,
          year: a.seasonYear ?? null,
        })) ?? [],
      manga:
        u.favourites?.manga?.nodes?.map((m) => ({
          id: m.id,
          title:
            m.title?.english ??
            m.title?.romaji ??
            m.title?.userPreferred ??
            "Unknown",
          cover: m.coverImage?.large ?? m.coverImage?.medium ?? null,
          format: m.format ?? null,
          year: m.startDate?.year ?? null,
        })) ?? [],
      characters:
        u.favourites?.characters?.nodes?.map((c) => ({
          id: c.id,
          name: c.name?.userPreferred ?? c.name?.full ?? "Unknown",
          image: c.image?.large ?? c.image?.medium ?? null,
        })) ?? [],
      voiceActors:
        u.favourites?.staff?.nodes?.map((s) => ({
          id: s.id,
          name: s.name?.userPreferred ?? s.name?.full ?? "Unknown",
          image: s.image?.large ?? s.image?.medium ?? null,
          occupations: s.primaryOccupations ?? [],
        })) ?? [],
    },
    animeStats: u.statistics?.anime
      ? {
          count: u.statistics.anime.count,
          meanScore: u.statistics.anime.meanScore,
          minutesWatched: u.statistics.anime.minutesWatched ?? 0,
          episodesWatched: u.statistics.anime.episodesWatched ?? 0,
          statuses:
            u.statistics.anime.statuses?.map((s) => ({
              label: s.status,
              count: s.count,
              meanScore: s.meanScore ?? null,
              minutesWatched: s.minutesWatched ?? null,
            })) ?? [],
          formats:
            u.statistics.anime.formats?.map((f) => ({
              label: f.format,
              count: f.count,
            })) ?? [],
          scores:
            u.statistics.anime.scores?.map((sc) => ({
              label: String(sc.score),
              count: sc.count,
            })) ?? [],
          genres:
            u.statistics.anime.genres?.map((g) => ({
              label: g.genre,
              count: g.count,
              meanScore: g.meanScore ?? null,
              minutesWatched: g.minutesWatched ?? null,
            })) ?? [],
          studios:
            u.statistics.anime.studios
              ?.filter((st) => st.studio?.name)
              .map((st) => ({
                label: st.studio!.name,
                count: st.count,
                meanScore: st.meanScore ?? null,
              })) ?? [],
          voiceActors:
            u.statistics.anime.voiceActors
              ?.filter((va) => va.voiceActor?.name?.userPreferred)
              .map((va) => ({
                label: va.voiceActor!.name!.userPreferred!,
                count: va.count,
                meanScore: va.meanScore ?? null,
                image: va.voiceActor?.image?.medium ?? null,
              })) ?? [],
        }
      : null,
    mangaStats: u.statistics?.manga
      ? {
          count: u.statistics.manga.count,
          meanScore: u.statistics.manga.meanScore,
          chaptersRead: u.statistics.manga.chaptersRead ?? 0,
          volumesRead: u.statistics.manga.volumesRead ?? 0,
          statuses:
            u.statistics.manga.statuses?.map((s) => ({
              label: s.status,
              count: s.count,
              meanScore: s.meanScore ?? null,
            })) ?? [],
          formats:
            u.statistics.manga.formats?.map((f) => ({
              label: f.format,
              count: f.count,
            })) ?? [],
          scores:
            u.statistics.manga.scores?.map((sc) => ({
              label: String(sc.score),
              count: sc.count,
            })) ?? [],
          genres:
            u.statistics.manga.genres?.map((g) => ({
              label: g.genre,
              count: g.count,
              meanScore: g.meanScore ?? null,
            })) ?? [],
        }
      : null,
    updatedAt: Date.now(),
  };
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
