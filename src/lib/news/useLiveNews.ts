import { useCallback, useEffect, useState } from "react";
import type { NewsArticle, NewsStoredState } from "./types";
import { DEFAULT_SOURCE_IDS } from "./sources";
import { fetchNewsFeed } from "./news.functions";

const STORAGE_KEYS = {
  sources: "koka:news:sources",
  feed: "koka:news:feed",
};

export const INITIAL_NEWS_COUNT = 12;
export const PAGE_SIZE = 12;

function loadStoredSources(): string[] {
  if (typeof window === "undefined") return DEFAULT_SOURCE_IDS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.sources);
    if (!raw) return DEFAULT_SOURCE_IDS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SOURCE_IDS;
  } catch {
    return DEFAULT_SOURCE_IDS;
  }
}

function loadStoredFeed(): NewsStoredState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.feed);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NewsStoredState;
    if (parsed && Array.isArray(parsed.articles)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveStoredFeed(data: NewsStoredState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.feed, JSON.stringify(data));
  } catch {
    /* quota ignore */
  }
}

function saveStoredSources(sources: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.sources, JSON.stringify(sources));
  } catch {
    /* quota ignore */
  }
}

export function useLiveNews() {
  const [selectedSources, setSelectedSourcesState] = useState<string[]>(() =>
    loadStoredSources(),
  );
  const [cachedFeed] = useState<NewsStoredState | null>(() => loadStoredFeed());

  const [articles, setArticles] = useState<NewsArticle[]>(
    () => cachedFeed?.articles ?? [],
  );
  const [lastUpdated, setLastUpdated] = useState<number | null>(
    () => cachedFeed?.lastUpdated ?? null,
  );
  const [successfulSources, setSuccessfulSources] = useState<string[]>(
    () => cachedFeed?.successfulSources ?? [],
  );
  const [failedSources, setFailedSources] = useState<string[]>(
    () => cachedFeed?.failedSources ?? [],
  );

  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_NEWS_COUNT);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cachedFeed || cachedFeed.articles.length === 0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSource = useCallback((sourceId: string) => {
    setSelectedSourcesState((prev) => {
      let next: string[];
      if (prev.includes(sourceId)) {
        // Prevent unchecking everything
        if (prev.length === 1) return prev;
        next = prev.filter((id) => id !== sourceId);
      } else {
        next = [...prev, sourceId];
      }
      saveStoredSources(next);
      return next;
    });
  }, []);

  const selectAllSources = useCallback((sourceIds: string[]) => {
    setSelectedSourcesState(sourceIds);
    saveStoredSources(sourceIds);
  }, []);

  const refreshNews = useCallback(
    async (sourcesToFetch?: string[]) => {
      const sources = sourcesToFetch ?? selectedSources;
      if (sources.length === 0) return;

      setIsRefreshing(true);
      setError(null);

      try {
        const res = await fetchNewsFeed({
          data: { sourceIds: sources },
        });

        const now = Date.now();
        setArticles(res.articles);
        setLastUpdated(now);
        setSuccessfulSources(res.successfulSources);
        setFailedSources(res.failedSources);
        // CRITICAL: reset visible count to INITIAL_NEWS_COUNT on refresh
        setVisibleCount(INITIAL_NEWS_COUNT);

        saveStoredFeed({
          articles: res.articles,
          lastUpdated: now,
          successfulSources: res.successfulSources,
          failedSources: res.failedSources,
        });

        if (res.articles.length === 0 && res.failedSources.length > 0 && res.successfulSources.length === 0) {
          setError("Unable to connect to selected news sources. Please try again.");
        }
      } catch (err) {
        console.error("Failed to fetch news feed:", err);
        setError("Unable to load news right now. Please check your connection.");
      } finally {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    },
    [selectedSources],
  );

  // Initial load: Only fetch if NO cached feed is in localStorage
  useEffect(() => {
    const existingFeed = loadStoredFeed();
    if (!existingFeed || existingFeed.articles.length === 0) {
      void refreshNews(loadStoredSources());
    } else {
      setIsLoading(false);
    }
  }, []); // Run only once on mount

  const showMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  return {
    selectedSources,
    articles,
    visibleArticles: articles.slice(0, visibleCount),
    visibleCount,
    totalCount: articles.length,
    hasMore: visibleCount < articles.length,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    successfulSources,
    failedSources,
    toggleSource,
    selectAllSources,
    refreshNews,
    showMore,
  };
}
