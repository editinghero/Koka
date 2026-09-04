import type { NewsArticle } from "./types";
import { getSourceById } from "./sources";

/**
 * Normalize title into lowercase alphanumeric tokens for similarity comparison.
 */
export function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2); // ignore tiny stop words like 'a', 'in', 'to', 'of'
}

/**
 * Calculate Jaccard similarity between two token sets
 */
function tokenSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Clean URL to compare canonical versions
 */
function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip common tracking parameters
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_medium");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("_location");
    return u.origin + u.pathname.replace(/\/+$/, "");
  } catch {
    return url.replace(/\?.*$/, "").replace(/\/+$/, "");
  }
}

/**
 * Deduplicate articles deterministically.
 * When duplicates are detected, keeps the one with higher source priority or better metadata (image/recency).
 */
export function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const result: NewsArticle[] = [];
  const seenUrls = new Set<string>();

  for (const article of articles) {
    const normUrl = canonicalUrl(article.url);
    if (seenUrls.has(normUrl)) {
      continue;
    }

    const currentTokens = tokenizeTitle(article.title);

    // Check if an existing result matches closely in title
    let isDuplicate = false;
    let duplicateIndex = -1;

    for (let i = 0; i < result.length; i++) {
      const existing = result[i];
      if (!existing) continue;

      const existingTokens = tokenizeTitle(existing.title);

      // Exact title match
      if (
        article.title.trim().toLowerCase() ===
        existing.title.trim().toLowerCase()
      ) {
        isDuplicate = true;
        duplicateIndex = i;
        break;
      }

      // Fuzzy title similarity (similarity > 0.72 for titles with >= 4 words)
      if (currentTokens.length >= 4 && existingTokens.length >= 4) {
        const sim = tokenSimilarity(currentTokens, existingTokens);
        if (sim >= 0.72) {
          isDuplicate = true;
          duplicateIndex = i;
          break;
        }
      }
    }

    if (!isDuplicate || duplicateIndex === -1) {
      seenUrls.add(normUrl);
      result.push(article);
    } else {
      const existing = result[duplicateIndex];
      if (existing) {
        const existingPriority =
          getSourceById(existing.sourceId)?.priority ?? 999;
        const currentPriority =
          getSourceById(article.sourceId)?.priority ?? 999;

        if (
          currentPriority < existingPriority ||
          (!existing.imageUrl &&
            article.imageUrl &&
            currentPriority <= existingPriority + 2)
        ) {
          seenUrls.delete(canonicalUrl(existing.url));
          seenUrls.add(normUrl);
          result[duplicateIndex] = article;
        }
      }
    }
  }

  return result;
}
