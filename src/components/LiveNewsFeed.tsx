import { useState } from "react";
import {
  ExternalLink,
  RefreshCw,
  SlidersHorizontal,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NEWS_SOURCES } from "@/lib/news/sources";
import { useLiveNews } from "@/lib/news/useLiveNews";
import type { NewsArticle } from "@/lib/news/types";
import { Button } from "@/components/ui/button";

function formatRelativeTime(dateStr: string): string {
  try {
    const timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) return "";
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);

    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "yesterday";
    if (diffDays < 14) return `${diffDays}d ago`;

    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function NewsCard({ article }: { article: NewsArticle }) {
  const [imageError, setImageError] = useState(false);
  const timeAgo = formatRelativeTime(article.publishedAt);
  const hasImage = Boolean(article.imageUrl) && !imageError;

  return (
    <article className="panel group flex flex-col justify-between overflow-hidden p-4 transition-all duration-200 hover:border-primary/50 hover:shadow-sm">
      <div className="space-y-3">
        {hasImage ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-secondary/50">
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground/90">
            {article.sourceName}
          </span>
          {timeAgo ? (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            </>
          ) : null}
          {article.category ? (
            <>
              <span>·</span>
              <span className="rounded bg-secondary/80 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                {article.category}
              </span>
            </>
          ) : null}
        </div>

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group/link block"
        >
          <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug transition-colors group-hover/link:text-primary">
            {article.title}
          </h3>
        </a>

        {article.description ? (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {article.description}
          </p>
        ) : null}
      </div>

      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <span>Read original</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </article>
  );
}

function NewsSkeleton() {
  return (
    <div className="panel space-y-3 p-4 animate-pulse">
      <div className="aspect-video w-full rounded-lg bg-secondary/70" />
      <div className="h-3 w-1/3 rounded bg-secondary/70" />
      <div className="h-5 w-4/5 rounded bg-secondary/70" />
      <div className="h-3 w-full rounded bg-secondary/70" />
      <div className="h-3 w-2/3 rounded bg-secondary/70" />
    </div>
  );
}

export function LiveNewsFeed() {
  const {
    selectedSources,
    visibleArticles,
    totalCount,
    hasMore,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    failedSources,
    toggleSource,
    selectAllSources,
    refreshNews,
    showMore,
  } = useLiveNews();

  const [showSourceSelector, setShowSourceSelector] = useState(false);

  const updatedTimeStr = lastUpdated ? formatRelativeTime(new Date(lastUpdated).toISOString()) : null;

  return (
    <section className="mt-8 space-y-4">
      {/* Section Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold">
              Latest Anime News
            </h2>
            {totalCount > 0 ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {totalCount}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Live updates from selected anime news networks
            {updatedTimeStr ? ` · Updated ${updatedTimeStr}` : ""}
          </p>
        </div>

        {/* Sync/Refresh text button matching Home AniList sync */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowSourceSelector((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            title="Filter news sources"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Sources ({selectedSources.length})</span>
          </button>

          <button
            type="button"
            onClick={() => void refreshNews()}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            title="Refresh news from selected sources"
          >
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                isRefreshing ? "animate-spin text-primary" : "",
              )}
            />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Source Selection Pill Bar */}
      <div
        className={cn(
          "transition-all duration-200",
          showSourceSelector ? "block" : "hidden sm:block",
        )}
      >
        <div className="panel p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-1">
            <span className="font-medium text-foreground">Select Networks:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => selectAllSources(NEWS_SOURCES.map((s) => s.id))}
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                Select all
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={() =>
                  selectAllSources(
                    NEWS_SOURCES.filter((s) => s.defaultEnabled).map((s) => s.id),
                  )
                }
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                Reset default
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {NEWS_SOURCES.map((source) => {
              const isSelected = selectedSources.includes(source.id);
              const isFailed = failedSources.includes(source.id);

              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => toggleSource(source.id)}
                  title={source.description}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors whitespace-nowrap flex items-center gap-1.5",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground font-medium shadow-xs"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-primary/50",
                  )}
                >
                  <span>{source.name}</span>
                  {isFailed ? (
                    <span
                      title="Source temporarily unavailable"
                      className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {failedSources.length > 0 ? (
            <p className="text-[11px] text-amber-500/90 flex items-center gap-1 pt-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>
                {failedSources.length} source{failedSources.length > 1 ? "s" : ""} unavailable on last check ({failedSources.join(", ")}).
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <NewsSkeleton key={i} />
          ))}
        </div>
      ) : error && visibleArticles.length === 0 ? (
        /* Error state when all fail */
        <div className="panel p-8 text-center space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <h3 className="font-display text-base font-semibold">
            Unable to load news right now
          </h3>
          <p className="mx-auto max-w-md text-xs text-muted-foreground">
            {error}
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refreshNews()}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn("mr-1.5 h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
              Retry
            </Button>
          </div>
        </div>
      ) : visibleArticles.length === 0 ? (
        /* Empty state */
        <div className="panel p-8 text-center space-y-3">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="font-display text-base font-semibold">
            No recent articles found
          </h3>
          <p className="mx-auto max-w-md text-xs text-muted-foreground">
            Selected news networks haven't published articles within the 14-day window. Try enabling more sources or refreshing.
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refreshNews()}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn("mr-1.5 h-3.5 w-3.5", isRefreshing && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>
      ) : (
        /* Article Grid */
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleArticles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>

          {/* Show More Button */}
          {hasMore ? (
            <div className="pt-4 text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={showMore}
                className="px-6 text-xs hover:border-primary/60"
              >
                Show more ({totalCount - visibleArticles.length} remaining)
              </Button>
            </div>
          ) : (
            <p className="pt-2 text-center text-xs text-muted-foreground">
              All {totalCount} latest stories loaded
            </p>
          )}
        </>
      )}
    </section>
  );
}
