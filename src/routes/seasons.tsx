import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { AnimeCard, GridSkeleton } from "@/components/AnimeCard";
import { PageHeader } from "@/components/AppShell";
import { AiPanel } from "@/components/AiPanel";
import {
  currentSeason,
  fetchSeason,
  fetchTrending,
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
          "Season charts with countdowns, plus trending and top-rated manga.",
      },
    ],
  }),
  component: SeasonsPage,
});

const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"];

const MANGA_SORTS = [
  { value: "TRENDING_DESC", label: "Trending" },
  { value: "POPULARITY_DESC", label: "Popular" },
  { value: "SCORE_DESC", label: "Top rated" },
] as const;

type MangaSort = (typeof MANGA_SORTS)[number]["value"];

function SeasonsPage() {
  const now = currentSeason();
  const { mode } = useMediaMode();
  const [season, setSeason] = useState(now.season);
  const [year, setYear] = useState(now.year);
  const [sort, setSort] = useState<MangaSort>("TRENDING_DESC");
  const { library, upsert } = useLibrary();

  const isManga = mode === "MANGA";

  const { data, isLoading, error } = useQuery({
    queryKey: isManga ? ["manga-browse", sort] : ["season", season, year],
    queryFn: () =>
      isManga ? fetchTrending("MANGA", sort) : fetchSeason(season, year),
    staleTime: 1000 * 60 * 30,
  });

  const inLibrary = new Set(library.map((e) => e.media.id));

  return (
    <>
      <PageHeader
        title="Discover"
        subtitle={
          isManga
            ? "Trending, popular and top-rated manga right now."
            : "Every season chart, past and upcoming."
        }
        action={
          isManga ? undefined : (
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
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {isManga ? (
          <div className="flex gap-1.5">
            {MANGA_SORTS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSort(s.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-all duration-200 active:scale-95",
                  sort === s.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex gap-1.5">
              {SEASONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs capitalize transition-all duration-200 active:scale-95",
                    season === s
                      ? "border-primary bg-primary text-primary-foreground"
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
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs"
            >
              {Array.from({ length: 14 }, (_, i) => now.year + 2 - i).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ),
              )}
            </select>
          </>
        )}
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

      {data ? (
        <div className="mt-8">
          <AiPanel
            title={isManga ? "Manga briefing" : "Season briefing"}
            description="Spoiler-free overview of what's worth your time."
            label="Brief me"
            prompt={() =>
              isManga
                ? `Write a calm, spoiler-free markdown briefing of what's currently trending in manga. Cover the overall shape of the list, standout premises, and what kind of reader each is for. No character details or plot twists.\n\nTitles: ${data
                    .slice(0, 30)
                    .map((m) => m.title)
                    .join(", ")}`
                : `Write a calm, spoiler-free markdown briefing of the ${season.toLowerCase()} ${year} anime season. Cover the overall shape of the season, notable studios, standout premises and what kind of viewer each is for. No character details or plot twists.\n\nTitles: ${data
                    .slice(0, 30)
                    .map((m) => m.title)
                    .join(", ")}`
            }
          />
        </div>
      ) : null}
    </>
  );
}
