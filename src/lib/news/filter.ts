import type { NewsArticle } from "./types";

const MAX_AGE_DAYS = 14;
const MAX_AGE_MS = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Filter out articles older than freshness window and sort newest first.
 */
export function filterAndSortArticles(
  articles: NewsArticle[],
  maxAgeMs = MAX_AGE_MS,
): NewsArticle[] {
  const now = Date.now();
  const minTimestamp = now - maxAgeMs;

  return articles
    .filter((a) => {
      const pubTime = new Date(a.publishedAt).getTime();
      // Keep articles if published date is valid and within maxAgeMs (or future up to 1 day due to timezone diffs)
      if (isNaN(pubTime)) return false;
      return pubTime >= minTimestamp && pubTime <= now + 86400000;
    })
    .sort((a, b) => {
      const timeA = new Date(a.publishedAt).getTime();
      const timeB = new Date(b.publishedAt).getTime();
      return timeB - timeA;
    });
}
