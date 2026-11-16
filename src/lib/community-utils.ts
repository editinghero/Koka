import type { MediaType } from "./types";

export type CommunityPlatform = "reddit" | "x" | "custom";

export type CommunityCategory =
  | "Default & General"
  | "Anime Series"
  | "Manga Series"
  | "News & Industry"
  | "Other"
  | "Custom";

export const COMMUNITY_CATEGORIES: CommunityCategory[] = [
  "Default & General",
  "Anime Series",
  "Manga Series",
  "News & Industry",
  "Other",
];

export function normalizeCategory(cat?: string | null): CommunityCategory {
  if (!cat || cat === "Custom" || cat === "Other") return "Other";
  if (
    cat === "Default & General" ||
    cat === "Anime Series" ||
    cat === "Manga Series" ||
    cat === "News & Industry"
  ) {
    return cat;
  }
  return "Other";
}

export function shortCategoryLabel(cat: CommunityCategory): string {
  switch (normalizeCategory(cat)) {
    case "Default & General":
      return "General";
    case "Anime Series":
      return "Anime";
    case "Manga Series":
      return "Manga";
    case "News & Industry":
      return "News";
    case "Other":
    default:
      return "Other";
  }
}

export type CommunityItem = {
  id: string;
  platform: CommunityPlatform;
  name: string;
  handle: string;
  url: string;
  category: CommunityCategory;
  description?: string | undefined;
  mediaId?: number | null | undefined;
  mediaType?: MediaType | null | undefined;
  mediaTitle?: string | null | undefined;
  mediaCover?: string | null | undefined;
  isDefault?: boolean | undefined;
  pinned?: boolean | undefined;
  createdAt: number;
  lastOpenedAt?: number | null | undefined;
};

export type AiDiscoveredCommunities = {
  title: string;
  mediaType: MediaType;
  category: CommunityCategory;
  reddit: {
    name: string;
    handle: string;
    url: string;
    description: string;
  };
  x: {
    name: string;
    handle: string;
    url: string;
    description: string;
  };
};

/**
 * Normalizes any user or AI input for a Reddit community into a canonical
 * `r/Subreddit` handle and `https://www.reddit.com/r/Subreddit/` URL.
 */
export function normalizeRedditInput(raw: string): {
  handle: string;
  url: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { handle: "", url: "" };
  }

  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|old\.)?reddit\.com\/r\/([A-Za-z0-9_]+)/i,
  );
  if (urlMatch && urlMatch[1]) {
    const sub = urlMatch[1];
    return {
      handle: `r/${sub}`,
      url: `https://www.reddit.com/r/${sub}/`,
    };
  }

  const prefixMatch = trimmed.match(/^\/?r\/([A-Za-z0-9_]+)/i);
  if (prefixMatch && prefixMatch[1]) {
    const sub = prefixMatch[1];
    return {
      handle: `r/${sub}`,
      url: `https://www.reddit.com/r/${sub}/`,
    };
  }

  const cleanSub = trimmed.replace(/[^A-Za-z0-9_]/g, "");
  if (!cleanSub) {
    return { handle: "", url: "" };
  }
  return {
    handle: `r/${cleanSub}`,
    url: `https://www.reddit.com/r/${cleanSub}/`,
  };
}

/**
 * Normalizes any user or AI input for an X.com (Twitter) handle, community, or hashtag
 * into a clean display handle and canonical `https://x.com/...` URL.
 */
export function normalizeXInput(raw: string): {
  handle: string;
  url: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { handle: "", url: "" };
  }

  // X Community URL: https://x.com/i/communities/123456
  const communityMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/i\/communities\/([0-9]+)/i,
  );
  if (communityMatch && communityMatch[1]) {
    const commId = communityMatch[1];
    return {
      handle: `Community #${commId.slice(-5)}`,
      url: `https://x.com/i/communities/${commId}`,
    };
  }

  // X Hashtag URL: https://x.com/hashtag/Tag
  const hashtagUrlMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/hashtag\/([^/?#]+)/i,
  );
  if (hashtagUrlMatch && hashtagUrlMatch[1]) {
    const tag = decodeURIComponent(hashtagUrlMatch[1]);
    return {
      handle: `#${tag}`,
      url: `https://x.com/hashtag/${encodeURIComponent(tag)}`,
    };
  }

  // X Search URL
  if (
    trimmed.startsWith("https://x.com/search") ||
    trimmed.startsWith("https://twitter.com/search")
  ) {
    const normalizedUrl = trimmed.replace("twitter.com", "x.com");
    try {
      const u = new URL(normalizedUrl);
      const q = u.searchParams.get("q")?.replace(/"/g, "").trim();
      return {
        handle: q ? `#${q.replace(/\s+/g, "")}` : "X Topic",
        url: normalizedUrl,
      };
    } catch {
      return {
        handle: "X Topic",
        url: normalizedUrl,
      };
    }
  }

  // Profile URL: https://x.com/Username or https://twitter.com/Username
  const profileMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)/i,
  );
  if (profileMatch && profileMatch[1]) {
    const user = profileMatch[1];
    if (
      user.toLowerCase() !== "search" &&
      user.toLowerCase() !== "hashtag" &&
      user.toLowerCase() !== "i" &&
      user.toLowerCase() !== "intent" &&
      user.toLowerCase() !== "home"
    ) {
      return {
        handle: `@${user}`,
        url: `https://x.com/${user}`,
      };
    }
  }

  // Hashtag input e.g. #Frieren
  if (trimmed.startsWith("#")) {
    const tag = trimmed.slice(1).trim().split(/\s+/)[0] ?? "";
    if (!tag) return { handle: "", url: "" };
    return {
      handle: `#${tag}`,
      url: `https://x.com/hashtag/${encodeURIComponent(tag)}`,
    };
  }

  // @Username or plain username
  const cleanUser = trimmed.replace(/^@/, "").replace(/[^A-Za-z0-9_]/g, "");
  if (!cleanUser) {
    return { handle: "", url: "" };
  }
  return {
    handle: `@${cleanUser}`,
    url: `https://x.com/${cleanUser}`,
  };
}

/**
 * Normalizes any custom link URL and optional label into a clean display handle and valid https:// URL.
 */
export function normalizeCustomLinkInput(
  rawUrl: string,
  customLabel?: string,
): {
  handle: string;
  url: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { handle: "", url: "" };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      return { handle: "", url: "" };
    }
    const cleanHost = parsed.hostname.replace(/^www\./i, "");
    const label = customLabel?.trim();
    if (label) {
      return {
        handle: label,
        url: parsed.toString(),
      };
    }
    const pathPart = parsed.pathname.replace(/^\/+|\/+$/g, "");
    const shortDisplay = pathPart
      ? `${cleanHost}/${pathPart.split("/").slice(0, 2).join("/")}`
      : cleanHost;
    return {
      handle:
        shortDisplay.length > 28
          ? `${shortDisplay.slice(0, 25)}...`
          : shortDisplay,
      url: parsed.toString(),
    };
  } catch {
    return { handle: "", url: "" };
  }
}

export function normalizeTitleKey(title?: string | null): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Sorts communities by `pinned` first (when requested) or `lastOpenedAt` descending, then `createdAt`.
 */
export function sortCommunitiesByLastOpen(
  communities: CommunityItem[],
): CommunityItem[] {
  return [...communities].sort((a, b) => {
    const openDiff = (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
    if (openDiff !== 0) return openDiff;
    if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) {
      return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    }
    return b.createdAt - a.createdAt;
  });
}

/**
 * Returns all communities linked to a specific anime/manga by mediaId or normalized title.
 */
export function getCommunitiesForMedia(
  communities: CommunityItem[],
  mediaId: number,
  mediaTitle?: string | null,
): CommunityItem[] {
  const targetTitleKey = normalizeTitleKey(mediaTitle);
  return sortCommunitiesByLastOpen(
    communities.filter((c) => {
      if (c.mediaId && c.mediaId === mediaId) return true;
      if (targetTitleKey && c.mediaTitle) {
        const cKey = normalizeTitleKey(c.mediaTitle);
        if (
          cKey &&
          (cKey === targetTitleKey ||
            targetTitleKey.includes(cKey) ||
            cKey.includes(targetTitleKey))
        ) {
          return true;
        }
      }
      return false;
    }),
  );
}

/**
 * Filters and groups communities into:
 * - `pinnedItems`: pinned communities sorted by lastOpenedAt (shown at the top when non-empty)
 * - `generalItems`: non-series communities sorted by lastOpenedAt
 * - `animeGroups`: series communities grouped by anime/manga and sorted by lastOpenedAt
 */
export function filterAndGroupCommunities(
  communities: CommunityItem[],
  opts: {
    platform?: "all" | CommunityPlatform;
    category?: "all" | CommunityCategory;
    search?: string;
    mediaId?: number | null;
  } = {},
): {
  filtered: CommunityItem[];
  pinnedItems: CommunityItem[];
  grouped: Record<CommunityCategory, CommunityItem[]>;
  generalItems: CommunityItem[];
  animeGroups: {
    key: string;
    title: string;
    mediaId?: number | null | undefined;
    mediaCover?: string | null | undefined;
    category: CommunityCategory;
    items: CommunityItem[];
    lastOpenedAt: number;
  }[];
} {
  const platform = opts.platform ?? "all";
  const category =
    opts.category && opts.category !== "all"
      ? normalizeCategory(opts.category)
      : "all";
  const q = (opts.search ?? "").trim().toLowerCase();

  const filtered = sortCommunitiesByLastOpen(
    communities.filter((item) => {
      const itemCat = normalizeCategory(item.category);
      if (platform !== "all" && item.platform !== platform) return false;
      if (category !== "all" && itemCat !== category) return false;
      if (opts.mediaId && item.mediaId !== opts.mediaId) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.handle.toLowerCase().includes(q) ||
        itemCat.toLowerCase().includes(q) ||
        shortCategoryLabel(itemCat).toLowerCase().includes(q) ||
        (item.mediaTitle && item.mediaTitle.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    }),
  );

  const grouped: Record<CommunityCategory, CommunityItem[]> = {
    "Default & General": [],
    "Anime Series": [],
    "Manga Series": [],
    "News & Industry": [],
    Other: [],
    Custom: [],
  };

  const pinnedItems: CommunityItem[] = [];
  const generalItems: CommunityItem[] = [];
  const animeMap = new Map<
    string,
    {
      key: string;
      title: string;
      mediaId?: number | null | undefined;
      mediaCover?: string | null | undefined;
      category: CommunityCategory;
      items: CommunityItem[];
      lastOpenedAt: number;
    }
  >();

  for (const rawItem of filtered) {
    const item: CommunityItem = {
      ...rawItem,
      category: normalizeCategory(rawItem.category),
    };
    const bucket = grouped[item.category] ? item.category : "Other";
    grouped[bucket].push(item);

    if (item.pinned) {
      pinnedItems.push(item);
    }

    const isSeries =
      Boolean(item.mediaTitle || item.mediaId) ||
      item.category === "Anime Series" ||
      item.category === "Manga Series";

    if (isSeries) {
      const seriesTitle = item.mediaTitle || item.name;
      const groupKey = item.mediaId
        ? `id:${item.mediaId}`
        : `title:${normalizeTitleKey(seriesTitle)}`;
      const existing = animeMap.get(groupKey);
      const itemTime = item.lastOpenedAt ?? item.createdAt;
      if (existing) {
        existing.items.push(item);
        if (itemTime > existing.lastOpenedAt) {
          existing.lastOpenedAt = itemTime;
        }
        if (!existing.mediaCover && item.mediaCover) {
          existing.mediaCover = item.mediaCover;
        }
      } else {
        animeMap.set(groupKey, {
          key: groupKey,
          title: seriesTitle,
          mediaId: item.mediaId,
          mediaCover: item.mediaCover,
          category: item.category,
          items: [item],
          lastOpenedAt: itemTime,
        });
      }
    } else {
      generalItems.push(item);
    }
  }

  const animeGroups = [...animeMap.values()].sort(
    (a, b) => b.lastOpenedAt - a.lastOpenedAt,
  );

  return { filtered, pinnedItems, grouped, generalItems, animeGroups };
}

/**
 * Parses Gemini's response (JSON block + optional Google Search grounding sources)
 * into normalized Reddit and X.com community objects.
 */
export function parseAiCommunityResponse(
  rawText: string,
  sources: { title: string; uri: string }[],
  title: string,
  mediaType: MediaType = "ANIME",
): AiDiscoveredCommunities {
  const cleanTitle = title.trim();
  const defaultCategory: CommunityCategory =
    mediaType === "MANGA" ? "Manga Series" : "Anime Series";

  let parsedJson: {
    category?: string;
    redditSubreddit?: string;
    redditUrl?: string;
    redditDescription?: string;
    xHandleOrHashtag?: string;
    xUrl?: string;
    xDescription?: string;
  } = {};

  const jsonMatch =
    rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ??
    rawText.match(/\{[\s\S]*\}/)?.[0];

  if (jsonMatch) {
    try {
      parsedJson = JSON.parse(jsonMatch.trim()) as typeof parsedJson;
    } catch {
      /* fallback to regex extraction from text & grounding sources */
    }
  }

  // Extract Reddit from JSON, raw text, or grounding sources
  const sourceRedditUrl = sources.find((s) =>
    /reddit\.com\/r\/[A-Za-z0-9_]+/i.test(s.uri),
  )?.uri;
  const textRedditMatch = rawText.match(
    /(?:https?:\/\/(?:www\.)?reddit\.com\/r\/[A-Za-z0-9_]+|\br\/[A-Za-z0-9_]{2,})/i,
  )?.[0];

  const redditCandidate =
    parsedJson.redditUrl ||
    parsedJson.redditSubreddit ||
    sourceRedditUrl ||
    textRedditMatch ||
    "";
  const rNorm = normalizeRedditInput(redditCandidate);

  // Extract X.com from JSON, raw text, or grounding sources
  const sourceXUrl = sources.find((s) =>
    /(?:x|twitter)\.com\/(?:i\/communities\/[0-9]+|hashtag\/[^/?#]+|[A-Za-z0-9_]+)/i.test(
      s.uri,
    ),
  )?.uri;
  const textXMatch = rawText.match(
    /(?:https?:\/\/(?:www\.)?(?:x|twitter)\.com\/(?:i\/communities\/[0-9]+|hashtag\/[A-Za-z0-9_]+|[A-Za-z0-9_]+)|@[A-Za-z0-9_]{2,}|#[A-Za-z0-9_]{2,})/i,
  )?.[0];

  const xCandidate =
    parsedJson.xUrl ||
    parsedJson.xHandleOrHashtag ||
    sourceXUrl ||
    textXMatch ||
    "";
  const xNorm = normalizeXInput(xCandidate);

  if (!rNorm.handle && !xNorm.handle) {
    throw new Error(
      `Gemini could not find verified Reddit or X communities for "${cleanTitle}". Try another title or add a custom link.`,
    );
  }

  return {
    title: cleanTitle,
    mediaType,
    category: normalizeCategory(parsedJson.category ?? defaultCategory),
    reddit: {
      name: cleanTitle,
      handle: rNorm.handle,
      url: rNorm.url,
      description:
        parsedJson.redditDescription?.trim() ||
        `Reddit community for ${cleanTitle}`,
    },
    x: {
      name: cleanTitle,
      handle: xNorm.handle,
      url: xNorm.url,
      description:
        parsedJson.xDescription?.trim() || `X community for ${cleanTitle}`,
    },
  };
}

/**
 * Uses Koka's client-side `askGemini` (powered by the user's Gemini API key and model
 * configured in Settings, with Google Search grounding enabled) to find the real
 * Reddit subreddit and official X.com account/community for an anime or manga.
 */
export async function discoverCommunitiesClient(
  title: string,
  mediaType: MediaType = "ANIME",
): Promise<AiDiscoveredCommunities> {
  const cleanTitle = title.trim();
  if (!cleanTitle) {
    throw new Error("Enter an anime or manga title first.");
  }

  const system =
    "You are an anime and manga community researcher with Google Search access. " +
    "Use Google Search to find the REAL, existing Reddit subreddit (e.g. r/Frieren, r/KusuriyaNoHitorigoto, r/ShingekiNoKyojin) " +
    "and the REAL official X.com (Twitter) account (e.g. @Anime_Frieren, @CHAINSAWMAN_PR, @kusuriya_PR), X Community URL, or official hashtag for the requested title. " +
    "Never invent fake X profile handles by concatenating the English title.";

  const prompt = `Search Google for the official or primary fan Reddit subreddit and the official X.com (Twitter) account or community for the ${mediaType.toLowerCase()} "${cleanTitle}".

Respond with ONLY a valid JSON object (no markdown prose outside the JSON) using these exact keys:
{
  "category": "${mediaType === "MANGA" ? "Manga Series" : "Anime Series"}",
  "redditSubreddit": "r/SubredditName",
  "redditUrl": "https://www.reddit.com/r/SubredditName/",
  "redditDescription": "Short 1-sentence description of the subreddit",
  "xHandleOrHashtag": "@OfficialHandle or #OfficialHashtag",
  "xUrl": "https://x.com/OfficialHandle",
  "xDescription": "Short 1-sentence description of the X account or community"
}`;

  const { askGemini } = await import("./gemini");
  const { text, sources } = await askGemini(prompt, {
    system,
    search: true,
    temperature: 0.2,
  });

  return parseAiCommunityResponse(text, sources, cleanTitle, mediaType);
}

export const DEFAULT_COMMUNITIES: CommunityItem[] = [
  {
    id: "default-reddit-anime",
    platform: "reddit",
    name: "Anime",
    handle: "r/anime",
    url: "https://www.reddit.com/r/anime/",
    category: "Default & General",
    description: "Main anime community on Reddit",
    isDefault: true,
    pinned: true,
    createdAt: 1700000000100,
    lastOpenedAt: 1700000000100,
  },
  {
    id: "default-reddit-manga",
    platform: "reddit",
    name: "Manga",
    handle: "r/manga",
    url: "https://www.reddit.com/r/manga/",
    category: "Default & General",
    description: "Main manga community on Reddit",
    isDefault: true,
    pinned: true,
    createdAt: 1700000000090,
    lastOpenedAt: 1700000000090,
  },
  {
    id: "default-x-anitrendz",
    platform: "x",
    name: "Anime Trending",
    handle: "@AniTrendz",
    url: "https://x.com/AniTrendz",
    category: "News & Industry",
    description: "Seasonal anime charts & news",
    isDefault: true,
    pinned: false,
    createdAt: 1700000000085,
    lastOpenedAt: 1700000000085,
  },
  {
    id: "default-x-mangamogura",
    platform: "x",
    name: "Manga Mogura",
    handle: "@MangaMoguraRE",
    url: "https://x.com/MangaMoguraRE",
    category: "Default & General",
    description: "Daily manga & adaptation news",
    isDefault: true,
    pinned: false,
    createdAt: 1700000000080,
    lastOpenedAt: 1700000000080,
  },
  {
    id: "default-reddit-animenews",
    platform: "reddit",
    name: "Anime News",
    handle: "r/animenews",
    url: "https://www.reddit.com/r/animenews/",
    category: "News & Industry",
    description: "Trailers, visuals, and announcements",
    isDefault: true,
    pinned: false,
    createdAt: 1700000000075,
    lastOpenedAt: 1700000000075,
  },
  {
    id: "default-x-crunchyroll",
    platform: "x",
    name: "Crunchyroll",
    handle: "@Crunchyroll",
    url: "https://x.com/Crunchyroll",
    category: "Default & General",
    description: "Official Crunchyroll updates",
    isDefault: true,
    pinned: false,
    createdAt: 1700000000070,
    lastOpenedAt: 1700000000070,
  },
];
