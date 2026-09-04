import type { NewsSource } from "./types";

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "ann",
    name: "Anime News Network",
    url: "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us",
    description: "Breaking news, industry reports and articles from ANN",
    defaultEnabled: true,
    priority: 1,
  },
  {
    id: "crunchyroll",
    name: "Crunchyroll News",
    url: "https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss",
    description:
      "Official Crunchyroll news updates, trailers & streaming announcements",
    defaultEnabled: true,
    priority: 2,
  },
  {
    id: "mal",
    name: "MyAnimeList News",
    url: "https://myanimelist.net/rss/news.xml",
    description: "Curated anime community and industry news from MAL",
    defaultEnabled: true,
    priority: 3,
  },
  {
    id: "anime-corner",
    name: "Anime Corner",
    url: "https://animecorner.me/feed/",
    description: "Polls, anime announcements, seasonal news and reviews",
    defaultEnabled: true,
    priority: 4,
  },
  {
    id: "anime-trending",
    name: "Anime Trending",
    url: "https://anitrendz.net/news/feed/",
    description: "Charts, awards and community news updates",
    defaultEnabled: true,
    priority: 5,
  },
  {
    id: "anime-news-india",
    name: "Anime News India",
    url: "https://animenewsindia.com/feed/",
    description: "Regional and global anime broadcasting and streaming updates",
    defaultEnabled: true,
    priority: 6,
  },
  {
    id: "kotaku",
    name: "Kotaku Anime",
    url: "https://kotaku.com/anime/feed",
    description: "Mainstream gaming & anime features and news coverage",
    defaultEnabled: false,
    priority: 7,
  },
  {
    id: "anime-herald",
    name: "Anime Herald",
    url: "https://animeherald.com/feed/",
    description: "Independent anime commentary, releases and reporting",
    defaultEnabled: false,
    priority: 8,
  },
  {
    id: "honeys-anime",
    name: "Honey's Anime",
    url: "https://honeysanime.com/feed/",
    description: "Anime, manga & gaming culture and news feeds",
    defaultEnabled: false,
    priority: 9,
  },
];

export const DEFAULT_SOURCE_IDS = NEWS_SOURCES.filter(
  (s) => s.defaultEnabled,
).map((s) => s.id);

export function getSourceById(id: string): NewsSource | undefined {
  return NEWS_SOURCES.find((s) => s.id === id);
}
