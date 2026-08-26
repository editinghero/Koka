import { createServerFn } from "@tanstack/react-start";
import type { NewsArticle, NewsFetchResponse } from "./types";
import { getSourceById, NEWS_SOURCES } from "./sources";
import { parseRssFeed } from "./parser";
import { deduplicateArticles } from "./dedupe";
import { filterAndSortArticles } from "./filter";

export const fetchNewsFeed = createServerFn({ method: "POST" })
  .inputValidator((data: { sourceIds?: string[] }) => data)
  .handler(async ({ data }): Promise<NewsFetchResponse> => {
    const requestedIds = data?.sourceIds && data.sourceIds.length > 0
      ? data.sourceIds
      : NEWS_SOURCES.filter((s) => s.defaultEnabled).map((s) => s.id);

    const sources = requestedIds
      .map((id) => getSourceById(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    const successfulSources: string[] = [];
    const failedSources: string[] = [];
    const allArticles: NewsArticle[] = [];

    // Fetch all selected sources concurrently with individual timeouts
    const results = await Promise.allSettled(
      sources.map(async (source) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500);

        try {
          const res = await fetch(source.url, {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              "Accept":
                "application/rss+xml, application/xml, text/xml, application/atom+xml, text/html, */*",
              "Cache-Control": "no-cache",
            },
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
          }

          const xml = await res.text();
          const parsed = parseRssFeed(xml, source.id, source.name);
          return { sourceId: source.id, articles: parsed };
        } catch (err) {
          clearTimeout(timeoutId);
          throw { sourceId: source.id, error: err };
        }
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        successfulSources.push(result.value.sourceId);
        allArticles.push(...result.value.articles);
      } else {
        const reason = result.reason as { sourceId?: string } | undefined;
        if (reason?.sourceId) {
          failedSources.push(reason.sourceId);
        }
      }
    }

    // Filter freshness (14 days) and sort newest first
    const freshArticles = filterAndSortArticles(allArticles);

    // Deduplicate stories across networks
    const deduplicated = deduplicateArticles(freshArticles);

    return {
      articles: deduplicated,
      successfulSources,
      failedSources,
    };
  });
