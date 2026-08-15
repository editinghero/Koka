import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Check, SlidersHorizontal } from "lucide-react";
import { AnimeCard, GridSkeleton } from "@/components/AnimeCard";
import { PageHeader } from "@/components/AppShell";
import { AiPanel } from "@/components/AiPanel";
import {
  currentSeason,
  fetchDiscover,
  nextSeason,
  prevSeason,
} from "@/lib/anilist";
import { useLibrary, useMediaMode } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/seasons")({
  head: () => ({
    meta: [
      { title: "Discover Anime & Manga — Koka" },
      {
        name: "description",
        content:
          "Browse seasonal anime charts, upcoming shows, trending titles, popular manga and top-rated series.",
      },
      { property: "og:title", content: "Discover — Koka" },
      {
        property: "og:description",
        content:
          "Season charts with countdowns, category filters, plus trending and top-rated anime & manga.",
      },
    ],
  }),
  component: SeasonsPage,
});

const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"] as const;

const CATEGORIES = [
  "ALL",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
  "Adult (18+)",
] as const;

const DISCOVER_SORTS = [
  { value: "POPULARITY_DESC", label: "Popular" },
  { value: "TRENDING_DESC", label: "Trending" },
  { value: "SCORE_DESC", label: "Top rated" },
  { value: "START_DATE_DESC", label: "Release date" },
  { value: "TITLE_ROMAJI", label: "Title A–Z" },
] as const;

type DiscoverSort = (typeof DISCOVER_SORTS)[number]["value"];

function SeasonsPage() {
  const now = currentSeason();
  const { mode } = useMediaMode();
  const [browseMode, setBrowseMode] = useState<"seasonal" | "category">(
    mode === "MANGA" ? "category" : "seasonal",
  );
  const [season, setSeason] = useState(now.season);
  const [year, setYear] = useState(now.year);
  const [genre, setGenre] = useState<string>("ALL");
  const [sort, setSort] = useState<DiscoverSort>("POPULARITY_DESC");
  const { library, upsert } = useLibrary();

  const isManga = mode === "MANGA";
  const isSeasonalActive = !isManga && browseMode === "seasonal";
  const isAdultSelected = genre === "Adult (18+)";

  const { data, isLoading, error } = useQuery({
    queryKey: [
      "discover",
      mode,
      browseMode,
      isSeasonalActive ? season : null,
      isSeasonalActive ? year : null,
      genre,
      sort,
    ],
    queryFn: () =>
      fetchDiscover({
        type: mode,
        season: isSeasonalActive ? season : null,
        seasonYear: isSeasonalActive ? year : null,
        sort,
        genre: genre !== "ALL" ? genre : null,
        isAdult: isAdultSelected,
      }),
    staleTime: 1000 * 60 * 30,
  });

  const inLibrary = new Set(library.map((e) => e.media.id));

  return (
    <>
      <PageHeader
        title="Discover"
        subtitle={
          isManga
            ? "Trending, popular and top-rated manga across all categories."
            : isSeasonalActive
              ? `Seasonal anime chart for ${season.toLowerCase()} ${year}.`
              : `Explore ${genre === "ALL" ? "all anime" : genre} sorted by ${
                  DISCOVER_SORTS.find(
                    (s) => s.value === sort,
                  )?.label.toLowerCase() ?? ""
                }.`
        }
        action={
          !isManga && isSeasonalActive ? (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const p = prevSeason(season, year);
                  setSeason(p.season as string);
                  setYear(p.year);
                }}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const n = nextSeason(season, year);
                  setSeason(n.season as string);
                  setYear(n.year);
                }}
              >
                Next
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Main Filter Toolbar */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Mode Switch for Anime (Seasonal vs Categories) */}
          {!isManga ? (
            <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setBrowseMode("seasonal");
                  if (genre === "Adult (18+)") setGenre("ALL");
                }}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  browseMode === "seasonal"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Season Charts
              </button>
              <button
                type="button"
                onClick={() => setBrowseMode("category")}
                className={cn(
                  "rounded-md px-3 py-1 transition-colors",
                  browseMode === "category"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Categories & Sort
              </button>
            </div>
          ) : null}

          {/* Sort selector */}
          <div className="flex items-center gap-1.5 ml-auto text-xs">
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as DiscoverSort)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground"
            >
              {DISCOVER_SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Seasonal controls (if seasonal mode is active) */}
        {isSeasonalActive ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs capitalize transition-all duration-200 active:scale-95 whitespace-nowrap",
                    season === s
                      ? "border-primary bg-primary text-primary-foreground font-medium"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.toLowerCase()}
                </button>
              ))}
            </div>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs"
            >
              {Array.from({ length: 14 }, (_, i) => now.year + 2 - i).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ),
              )}
            </select>
          </div>
        ) : null}

        {/* Category / Genre Pills (with Adult 18+ placed at the very last) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
          <span className="shrink-0 font-medium text-foreground text-[11px]">
            Category:
          </span>
          {CATEGORIES.map((c) => {
            const isAdult = c === "Adult (18+)";
            const isActive = genre === c;

            return (
              <button
                key={c}
                onClick={() => {
                  setGenre(c);
                  if (isAdult && browseMode === "seasonal") {
                    setBrowseMode("category");
                  }
                }}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-[11px] transition-all whitespace-nowrap active:scale-95",
                  isActive
                    ? isAdult
                      ? "border-destructive bg-destructive text-destructive-foreground font-medium"
                      : "border-primary bg-primary text-primary-foreground font-medium"
                    : isAdult
                      ? "border-destructive/40 text-destructive/90 hover:border-destructive hover:bg-destructive/10"
                      : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
                )}
              >
                {c === "ALL" ? "All Categories" : c}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? <GridSkeleton /> : null}
      {error ? (
        <p className="panel p-6 text-sm text-destructive">
          Could not load that chart. Try again shortly.
        </p>
      ) : null}

      {data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {data.map((media) => (
            <AnimeCard
              key={media.id}
              media={media}
              footer={
                <Button
                  size="sm"
                  variant={inLibrary.has(media.id) ? "secondary" : "outline"}
                  className="mt-1 h-7 w-full text-[11px]"
                  onClick={() => {
                    upsert({
                      media,
                      status: "PLANNING",
                      progress: 0,
                      score: null,
                      updatedAt: Date.now(),
                      addedAt: Date.now(),
                    });
                    toast.success(`${media.title} added to Planned`);
                  }}
                >
                  {inLibrary.has(media.id) ? (
                    <>
                      <Check className="h-3 w-3" /> In list
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" /> Plan
                    </>
                  )}
                </Button>
              }
            />
          ))}
        </div>
      ) : null}

      {data && data.length > 0 ? (
        <div className="mt-8">
          <AiPanel
            title={
              isManga
                ? "Manga briefing"
                : isSeasonalActive
                  ? `${season.toLowerCase()} ${year} season briefing`
                  : `${genre === "ALL" ? "Discover" : genre} briefing`
            }
            description="Spoiler-free overview of standout titles worth checking out."
            label="Brief me"
            prompt={() =>
              `Write a calm, spoiler-free markdown briefing for this curated list of ${
                isManga ? "manga" : "anime"
              } (${genre === "ALL" ? "all genres" : `genre: ${genre}`}, sorted by ${
                DISCOVER_SORTS.find(
                  (s) => s.value === sort,
                )?.label.toLowerCase() ?? "popularity"
              }). Highlight standout premises, tone, art style, and what kind of audience each is for. No character spoilers or twists.\n\nTitles: ${data
                .slice(0, 25)
                .map((m) => m.title)
                .join(", ")}`
            }
          />
        </div>
      ) : null}
    </>
  );
}
