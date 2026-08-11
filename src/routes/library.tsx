import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AnimeCard } from "@/components/AnimeCard";
import { PageHeader } from "@/components/AppShell";
import { useLibrary, useMediaMode } from "@/lib/store";
import {
  MODE_COPY,
  STATUS_ORDER,
  statusLabel,
  type WatchStatus,
} from "@/lib/types";
import { Input } from "@/components/ui/input";
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

function LibraryPage() {
  const { mode } = useMediaMode();
  const copy = MODE_COPY[mode];
  const { library } = useLibrary();
  const [status, setStatus] = useState<WatchStatus | "ALL">("ALL");
  const [genre, setGenre] = useState("ALL");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");

  const genres = useMemo(() => {
    const set = new Set<string>();
    library.forEach((e) => e.media.genres?.forEach((g) => set.add(g)));
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
    const q = query.toLowerCase().trim().replace(/^#/, "");
    return library
      .filter((e) => status === "ALL" || e.status === status)
      .filter((e) => genre === "ALL" || e.media.genres?.includes(genre))
      .filter((e) => {
        if (!q) return true;
        const titleMatch = e.media.title.toLowerCase().includes(q);
        const genreMatch = e.media.genres?.some((g) =>
          g.toLowerCase().includes(q),
        );
        const studioMatch = e.media.studios?.some((s) =>
          s.toLowerCase().includes(q),
        );
        const tagMatch = e.tags?.some((t) => t.toLowerCase().includes(q));
        return titleMatch || genreMatch || studioMatch || tagMatch;
      })
      .sort((a, b) => {
        if (sort === "title") return a.media.title.localeCompare(b.media.title);
        if (sort === "score") return (b.score ?? 0) - (a.score ?? 0);
        if (sort === "progress") return b.progress - a.progress;
        return b.updatedAt - a.updatedAt;
      });
  }, [library, status, genre, query, sort]);

  return (
    <>
      <PageHeader
        title={mode === "MANGA" ? "Manga library" : "Anime library"}
        subtitle={`${library.length} titles · ${filtered.length} shown`}
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
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Tags:</span>
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
                  "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
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

        <div className="flex flex-wrap gap-1.5">
          {(["ALL", ...STATUS_ORDER] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                status === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "ALL" ? "All" : statusLabel(s, mode)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
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

      {filtered.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {filtered.map((e) => (
            <AnimeCard key={e.media.id} media={e.media} entry={e} />
          ))}
        </div>
      ) : (
        <p className="panel p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Import a list or add titles from the browse tab.
        </p>
      )}
    </>
  );
}
