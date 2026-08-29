import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { Star, Tv, UserRound } from "lucide-react";
import type { AnimeMedia, LibraryEntry } from "@/lib/types";
import { mediaTypeOf, totalUnits } from "@/lib/types";
import { cn } from "@/lib/utils";

export function countdown(airingAt: number) {
  const diff = airingAt * 1000 - Date.now();
  if (diff <= 0) return "airing now";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ⚡ Bolt: Memoized Cover component to prevent unnecessary re-renders in large grids/lists
export const Cover = memo(function Cover({
  media,
  className,
}: {
  media: AnimeMedia;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-secondary",
        className,
      )}
    >
      {media.cover ? (
        <img
          src={media.cover}
          alt={`${media.title} cover art`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Tv className="h-5 w-5" />
        </div>
      )}
    </div>
  );
});

export const AnimeCard = memo(function AnimeCard({
  media,
  entry,
  footer,
}: {
  media: AnimeMedia;
  entry?: LibraryEntry | undefined;
  footer?: React.ReactNode;
}) {
  const total = totalUnits(media);
  const unit = mediaTypeOf(media) === "MANGA" ? "ch" : "eps";
  const pct =
    entry && total
      ? Math.min(100, Math.round((entry.progress / total) * 100))
      : 0;

  return (
    <div className="group panel animate-in overflow-hidden transition-all duration-300 fade-in-0 hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]">
      <Link
        to="/anime/$id"
        params={{ id: String(media.id) }}
        className="block overflow-hidden"
        aria-label={media.title}
      >
        <Cover
          media={media}
          className="aspect-[3/4] rounded-none transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </Link>

      <div className="space-y-1.5 p-2.5">
        <Link
          to="/anime/$id"
          params={{ id: String(media.id) }}
          className="line-clamp-2 text-[13px] leading-snug font-medium transition-colors hover:text-primary"
        >
          {media.title}
        </Link>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{media.format ?? (unit === "ch" ? "MANGA" : "TV")}</span>
          {media.averageScore ? (
            <span
              className="inline-flex items-center gap-0.5"
              title="Public score (AniList / MAL)"
            >
              <Star className="h-3 w-3" /> {media.averageScore}
            </span>
          ) : null}
          {entry?.score ? (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-px font-medium text-primary"
              title="Your score"
            >
              <UserRound className="h-2.5 w-2.5" /> {entry.score}
            </span>
          ) : null}
          {media.nextEpisode ? (
            <span className="text-primary">
              EP{media.nextEpisode.episode} ·{" "}
              {countdown(media.nextEpisode.airingAt)}
            </span>
          ) : null}
        </div>
        {entry ? (
          <div className="space-y-1">
            <div className="h-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {entry.progress}/{total ?? "?"} {unit}
            </p>
          </div>
        ) : null}
        {entry?.tags?.length ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {entry.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              >
                #{t.trim().toLowerCase()}
              </span>
            ))}
          </div>
        ) : null}
        {footer}
      </div>
    </div>
  );
});

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="panel overflow-hidden">
          <div className="aspect-[3/4] animate-pulse bg-secondary" />
          <div className="space-y-2 p-2.5">
            <div className="h-3 w-4/5 animate-pulse rounded bg-secondary" />
            <div className="h-2.5 w-1/2 animate-pulse rounded bg-secondary" />
          </div>
        </div>
      ))}
    </div>
  );
}
