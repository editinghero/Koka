import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, Flame } from "lucide-react";
import { askGemini, SPOILER_FREE_SYSTEM } from "@/lib/gemini";
import {
  currentSeason,
  fetchDiscover,
  nextSeason,
  type Season,
} from "@/lib/anilist";
import type { AnimeMedia } from "@/lib/types";
import { Markdown } from "./Markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TasteContext {
  name: string;
  favorites: string[];
  topGenres: string[];
  completedCount: number;
}

const SEASONS: Season[] = ["WINTER", "SPRING", "SUMMER", "FALL"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 14 }, (_, i) => CURRENT_YEAR + 1 - i);

export function PickForMePanel({
  tasteContext,
  currentSeasonData,
}: {
  tasteContext: TasteContext;
  currentSeasonData?: AnimeMedia[];
}) {
  const now = currentSeason();
  const next = nextSeason(now.season, now.year);

  const [target, setTarget] = useState<"current" | "next" | "custom">("current");
  const [customSeason, setCustomSeason] = useState<Season>(now.season);
  const [customYear, setCustomYear] = useState<number>(now.year);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [lastSeasonPicked, setLastSeasonPicked] = useState<string | null>(null);

  const activeSeasonLabel =
    target === "current"
      ? `${now.season.toLowerCase()} ${now.year}`
      : target === "next"
      ? `${next.season.toLowerCase()} ${next.year}`
      : `${customSeason.toLowerCase()} ${customYear}`;

  async function handlePick() {
    setLoading(true);
    setError(null);
    try {
      let titles = currentSeasonData;
      if (
        target === "next" ||
        target === "custom" ||
        !titles ||
        titles.length === 0
      ) {
        const s =
          target === "current"
            ? now
            : target === "next"
            ? next
            : { season: customSeason, year: customYear };
        titles = await fetchDiscover({
          type: "ANIME",
          season: s.season,
          seasonYear: s.year,
          sort: "POPULARITY_DESC",
          perPage: 35,
        });
      }

      if (!titles || titles.length === 0) {
        throw new Error(
          `Could not find titles for ${activeSeasonLabel} season chart.`,
        );
      }

      const prompt = `You are an expert anime recommendation concierge who deeply understands this user's taste and watch history.
Analyze the user's inside taste profile, favorites, ratings, and genre preferences, and pick the best titles to watch from the ${activeSeasonLabel} season.

User Taste Profile:
- Favorite & High-Rated Titles: ${tasteContext.favorites.join(", ") || "Diverse anime fan"}
- Top Preferred Genres: ${tasteContext.topGenres.join(", ") || "Action, Drama, Fantasy"}
- Total Anime Completed: ${tasteContext.completedCount}

Candidate Lineup for ${activeSeasonLabel}:
${titles
  .slice(0, 30)
  .map((m, i) => {
    const scoreVal = m.score ?? m.averageScore ?? m.meanScore;
    const scoreText = scoreVal ? `Score: ${scoreVal}%` : "Unrated";
    const genresText = m.genres?.slice(0, 4).join(", ") || "Anime";
    const studioText = m.studios?.[0] ? `Studio: ${m.studios[0]}` : "";
    const cleanSynopsis = m.synopsis
      ? m.synopsis.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").slice(0, 180).trim() + "…"
      : "No synopsis available.";
    return `${i + 1}. **${m.title}** (${m.format || "TV"}) — [${genresText}] | ${scoreText} ${studioText ? `| ${studioText}` : ""}\n   Premise: ${cleanSynopsis}`;
  })
  .join("\n\n")}

Format instructions:
1. Recommend 4 to 6 standout titles in strict PRIORITY ORDER (Priority 1, Priority 2, Priority 3...).
2. For each recommendation, provide:
   - **Title** (use bold)
   - **Priority & Match**: 1 clear, tailored sentence explaining why this title specifically matches the user's taste and preferred genres.
   - **Synopsis**: A short, engaging 2-sentence synopsis (spoiler-free, concise, not too much).
Keep the tone calm, thoughtful, spoiler-free, and formatted cleanly in Markdown.`;

      const res = await askGemini(prompt, {
        system: SPOILER_FREE_SYSTEM,
      });
      setResult(res.text);
      setLastSeasonPicked(activeSeasonLabel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate picks.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel p-4 sm:p-5">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Pick for me with AI
          </h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          AI analyzes your watch history and picks standout anime from the season chart with tailored matching reasons.
        </p>

        {/* User taste preview badges */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Based on your taste:</span>
          {tasteContext.topGenres
            .filter((g) => g && g !== "undefined" && g !== "null")
            .slice(0, 3)
            .map((g) => (
              <span
                key={g}
                className="rounded-full bg-secondary/80 px-2 py-0.5 text-[10px] text-foreground"
              >
                {g}
              </span>
            ))}
          {tasteContext.favorites[0] ? (
            <span className="truncate max-w-[160px] text-[10px] text-muted-foreground">
              like &ldquo;{tasteContext.favorites[0].split(" (")[0]}&rdquo;
            </span>
          ) : null}
        </div>
      </div>

      {/* Action controls row — all aligned to left in one clean line */}
      <div className="mt-4 flex flex-wrap items-center justify-start gap-2.5">
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTarget("current")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
              target === "current"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Current ({now.season.toLowerCase()} {now.year})
          </button>
          <button
            type="button"
            onClick={() => setTarget("next")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
              target === "next"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Next ({next.season.toLowerCase()} {next.year})
          </button>
          <button
            type="button"
            onClick={() => setTarget("custom")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
              target === "custom"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Select Season
          </button>
        </div>

        {target === "custom" ? (
          <div className="flex items-center gap-1.5">
            <select
              value={customSeason}
              onChange={(e) => setCustomSeason(e.target.value as Season)}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground"
            >
              {SEASONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <select
              value={customYear}
              onChange={(e) => setCustomYear(Number(e.target.value))}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground"
            >
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <Button
          size="sm"
          onClick={handlePick}
          disabled={loading}
          className="gap-1.5 whitespace-nowrap text-xs"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Flame className="h-3.5 w-3.5" />
          )}
          Pick with AI
        </Button>
      </div>

      {error ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground capitalize">
              Recommended for {lastSeasonPicked ?? activeSeasonLabel}
            </span>
          </div>
          <Markdown copyAnimeTitles>{result}</Markdown>
        </div>
      ) : null}
    </section>
  );
}
