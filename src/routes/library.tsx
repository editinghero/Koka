import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  LayoutGrid,
  List as ListIcon,
  Star,
  UserRound,
  Plus,
  Minus,
  ExternalLink,
} from "lucide-react";
import { AnimeCard, Cover, countdown } from "@/components/AnimeCard";
import { PageHeader } from "@/components/AppShell";
import { useLibrary, useMediaMode } from "@/lib/store";
import {
  MODE_COPY,
  STATUS_ORDER,
  statusLabel,
  totalUnits,
  mediaTypeOf,
  type WatchStatus,
  type LibraryEntry,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Library — Koka Anime Dashboard" },
      {
        name: "description",
        content:
          "Track watching progress, scores, rewatches and personal notes for all your anime and manga.",
      },
      { property: "og:title", content: "Library — Koka Anime Dashboard" },
      {
        property: "og:description",
        content: "Filter your anime collection by status, genre and score.",
      },
    ],
  }),
  component: LibraryPage,
});

type SortKey = "updated" | "title" | "score" | "progress";
type ViewMode = "grid" | "list";

const STORAGE_KEYS = {
  viewMode: "koka:library:viewMode",
  sort: "koka:library:sort",
  status: "koka:library:status",
  genre: "koka:library:genre",
};

function getStoredValue<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const val = localStorage.getItem(key);
    return (val as T) || fallback;
  } catch {
    return fallback;
  }
}

function setStoredValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function LibraryListRow({
  entry,
  onBump,
  onScoreChange,
}: {
  entry: LibraryEntry;
  onBump: (delta: number) => void;
  onScoreChange: (score: number | null) => void;
}) {
  const { mode } = useMediaMode();
  const copy = MODE_COPY[mode];
  const media = entry.media;
  const total = totalUnits(media);
  const unit = mediaTypeOf(media) === "MANGA" ? "ch" : "eps";
  const pct = total
    ? Math.min(100, Math.round((entry.progress / total) * 100))
    : 0;

  return (
    <div className="panel flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 transition-all duration-200 hover:border-primary/40 min-w-0 overflow-hidden">
      {/* Cover & Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1 w-full md:w-auto">
        <Link
          to="/anime/$id"
          params={{ id: String(media.id) }}
          className="shrink-0 block overflow-hidden rounded"
        >
          <Cover
            media={media}
            className="h-14 w-10 sm:h-16 sm:w-12 rounded object-cover"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              to="/anime/$id"
              params={{ id: String(media.id) }}
              className="truncate text-sm font-semibold hover:text-primary transition-colors block"
            >
              {media.title}
            </Link>
            {media.siteUrl ? (
              <a
                href={media.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground/60 hover:text-primary shrink-0"
                title="View on AniList"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {[
              media.format ?? (unit === "ch" ? "MANGA" : "TV"),
              media.seasonYear
                ? `${media.season ?? ""} ${media.seasonYear}`
                : null,
              total ? `${total} ${copy.unitShort}` : null,
              media.studios?.[0],
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.2 text-[10px] font-medium border whitespace-nowrap",
                entry.status === "CURRENT" || entry.status === "REPEATING"
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : entry.status === "COMPLETED"
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-secondary border-border text-muted-foreground",
              )}
            >
              {statusLabel(entry.status, mode)}
            </span>

            {media.genres?.slice(0, 2).map((g) => (
              <span
                key={g}
                className="hidden sm:inline-block rounded-full bg-secondary px-2 py-0.2 text-[10px] text-muted-foreground whitespace-nowrap"
              >
                {g}
              </span>
            ))}

            {entry.tags?.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-medium text-primary whitespace-nowrap"
              >
                #{t.trim().toLowerCase()}
              </span>
            ))}

            {media.nextEpisode ? (
              <span className="text-[10px] text-primary font-medium whitespace-nowrap">
                EP{media.nextEpisode.episode} in{" "}
                {countdown(media.nextEpisode.airingAt)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Progress Bar & Controls */}
      <div className="flex items-center justify-between md:justify-end gap-2.5 sm:gap-4 w-full md:w-auto shrink-0 border-t border-border md:border-0 pt-2.5 md:pt-0">
        <div className="flex flex-col gap-1 min-w-[5.5rem] w-28 sm:w-36">
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground">
            <span>
              {entry.progress}/{total ?? "?"} {unit}
            </span>
            <span className="tabular-nums font-mono">{pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => onBump(-1)}
            aria-label="Decrease progress"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => onBump(1)}
            aria-label="Increase progress"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Score */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1">
            <UserRound className="h-3 w-3 text-primary" />
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={entry.score ?? ""}
              placeholder="—"
              onChange={(e) => {
                const v = e.target.value;
                onScoreChange(
                  v === "" ? null : Math.min(10, Math.max(0, Number(v))),
                );
              }}
              className="w-8 bg-transparent text-center font-medium focus:outline-none text-xs"
              title="Your Score"
            />
            <span className="text-[11px] text-muted-foreground">/10</span>
          </div>

          {media.averageScore ? (
            <div
              className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground px-1"
              title="AniList public score"
            >
              <Star className="h-3 w-3 text-amber-500" />
              <span>{media.averageScore}%</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LibraryPage() {
  const { mode } = useMediaMode();
  const copy = MODE_COPY[mode];
  const { library, patch } = useLibrary();

  // LocalStorage-persisted filters and view preferences
  const [viewMode, setViewModeState] = useState<ViewMode>(() =>
    getStoredValue(STORAGE_KEYS.viewMode, "grid"),
  );
  const [sort, setSortState] = useState<SortKey>(() =>
    getStoredValue(STORAGE_KEYS.sort, "updated"),
  );
  const [status, setStatusState] = useState<WatchStatus | "ALL">(() =>
    getStoredValue(STORAGE_KEYS.status, "ALL"),
  );
  const [genre, setGenreState] = useState<string>(() =>
    getStoredValue(STORAGE_KEYS.genre, "ALL"),
  );
  const [customList, setCustomList] = useState("ALL");
  const [query, setQuery] = useState("");

  const setViewMode = (v: ViewMode) => {
    setViewModeState(v);
    setStoredValue(STORAGE_KEYS.viewMode, v);
  };

  const setSort = (s: SortKey) => {
    setSortState(s);
    setStoredValue(STORAGE_KEYS.sort, s);
  };

  const setStatus = (st: WatchStatus | "ALL") => {
    setStatusState(st);
    setStoredValue(STORAGE_KEYS.status, st);
  };

  const setGenre = (g: string) => {
    setGenreState(g);
    setStoredValue(STORAGE_KEYS.genre, g);
  };

  const genres = useMemo(() => {
    const set = new Set<string>();
    library.forEach((e) => e.media.genres?.forEach((g) => set.add(g)));
    return [...set].sort();
  }, [library]);

  const customLists = useMemo(() => {
    const set = new Set<string>();
    library.forEach((e) =>
      e.customLists?.forEach((c) => set.add(c.trim().toLowerCase())),
    );
    return [...set].sort();
  }, [library]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    library.forEach((e) =>
      e.tags?.forEach((t) => set.add(t.trim().toLowerCase())),
    );
    return [...set].sort();
  }, [library]);

  const filtered = useMemo(() => {
    const rawQuery = query.trim().toLowerCase();
    const isHashtagSearch = rawQuery.startsWith("#");
    const q = rawQuery.replace(/^#/, "");

    return library
      .filter((e) => status === "ALL" || e.status === status)
      .filter((e) => genre === "ALL" || e.media.genres?.includes(genre))
      .filter(
        (e) =>
          customList === "ALL" ||
          e.customLists?.some(
            (c) => c.trim().toLowerCase() === customList.trim().toLowerCase(),
          ),
      )
      .filter((e) => {
        if (!q) return true;

        const tagMatch = e.tags?.some((t) => t.toLowerCase().includes(q));

        if (isHashtagSearch) {
          return tagMatch;
        }

        const titleMatch = e.media.title.toLowerCase().includes(q);
        const genreMatch = e.media.genres?.some((g) =>
          g?.toLowerCase().includes(q),
        );
        const studioMatch = e.media.studios?.some((s) =>
          s?.toLowerCase().includes(q),
        );
        const customListMatch = e.customLists?.some((c) =>
          c?.toLowerCase().includes(q),
        );

        return (
          !!titleMatch || !!genreMatch || !!studioMatch || !!tagMatch || !!customListMatch
        );
      })
      .sort((a, b) => {
        if (sort === "title") return a.media.title.localeCompare(b.media.title);
        if (sort === "score") return (b.score ?? 0) - (a.score ?? 0);
        if (sort === "progress") return b.progress - a.progress;
        return b.updatedAt - a.updatedAt;
      });
  }, [library, status, genre, customList, query, sort]);

  return (
    <>
      <PageHeader
        title={mode === "MANGA" ? "Manga library" : "Anime library"}
        subtitle={`${library.length} titles · ${filtered.length} shown`}
        action={
          <div className="flex items-center rounded-lg border border-border bg-surface p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
                viewMode === "list"
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="List View"
            >
              <ListIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        }
      />

      <div className="mb-5 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search by title, genre, or custom tag (e.g. #ecchi, #fav)`}
            className="pl-9"
          />
        </div>

        {allTags.length ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs text-muted-foreground">
            <span className="shrink-0 font-medium text-foreground">Tags:</span>
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() =>
                  setQuery(
                    query.toLowerCase().replace(/^#/, "") === t.toLowerCase()
                      ? ""
                      : `#${t}`,
                  )
                }
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                  query.toLowerCase().replace(/^#/, "") === t.toLowerCase()
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border hover:border-primary hover:text-foreground",
                )}
              >
                #{t}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {(["ALL", ...STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors whitespace-nowrap",
                status === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "ALL" ? "All" : statusLabel(s, mode)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap gap-2">
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5"
            >
              <option value="ALL">All genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            {customLists.length > 0 ? (
              <select
                value={customList}
                onChange={(e) => setCustomList(e.target.value)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 capitalize"
              >
                <option value="ALL">All custom lists</option>
                {customLists.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : null}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5"
            >
              <option value="updated">Recently updated</option>
              <option value="title">Title A–Z</option>
              <option value="score">Score</option>
              <option value="progress">Progress</option>
            </select>
          </div>
        </div>
      </div>

      {filtered.length ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {filtered.map((e) => (
              <AnimeCard key={e.media.id} media={e.media} entry={e} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((e) => (
              <LibraryListRow
                key={e.media.id}
                entry={e}
                onBump={(delta) => {
                  const current = e.progress ?? 0;
                  const next = Math.max(0, current + delta);
                  patch(e.media.id, { progress: next });
                }}
                onScoreChange={(newScore) => {
                  patch(e.media.id, { score: newScore });
                }}
              />
            ))}
          </div>
        )
      ) : (
        <p className="panel p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Import a list or add titles from the browse tab.
        </p>
      )}
    </>
  );
}
