import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, Compass, Flame } from "lucide-react";
import { askGemini, SPOILER_FREE_SYSTEM } from "@/lib/gemini";
import { currentSeason, fetchDiscover, nextSeason, type AnimeMedia } from "@/lib/anilist";
import { Markdown } from "./Markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TasteContext {
  name: string;
  favorites: string[];
  topGenres: string[];
  completedCount: number;
}

export function PickForMePanel({
  tasteContext,
  currentSeasonData,
}: {
  tasteContext: TasteContext;
  currentSeasonData?: AnimeMedia[];
}) {
  const now = currentSeason();
  const next = nextSeason(now.season, now.year);

  const [target, setTarget] = useState<"current" | "next">("current");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [lastSeasonPicked, setLastSeasonPicked] = useState<string | null>(null);

  const activeSeasonLabel =
    target === "current"
      ? `${now.season.toLowerCase()} ${now.year}`
      : `${next.season.toLowerCase()} ${next.year}`;

  async function handlePick() {
    setLoading(true);
    setError(null);
    try {
      let titles = currentSeasonData;
      if (target === "next" || !titles || titles.length === 0) {
        const s = target === "current" ? now : next;
        titles = await fetchDiscover({
          type: "ANIME",
          season: s.season,
          seasonYear: s.year,
          sort: "POPULARITY_DESC",
        });
      }

      if (!titles || titles.length === 0) {
        throw new Error(`Could not find titles for ${activeSeasonLabel} season chart.`);
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
  .map((m, i) => `${i + 1}. ${m.title} [${m.genres?.join(", ") || "Anime"}] (${m.format || "TV"})`)
  .join("\n")}

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold text-foreground">
              Pick for me
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            AI picks and ranks the best anime for your taste from the season chart with short synopses.
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
              <span className="truncate max-w-[140px] text-[10px] text-muted-foreground">
                like &ldquo;{tasteContext.favorites[0].split(" (")[0]}&rdquo;
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          {/* Season Choice Tabs */}
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
          </div>

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
            Pick for {target === "current" ? "Current Season" : "Next Season"}
          </Button>
        </div>
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
