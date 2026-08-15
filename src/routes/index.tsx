import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Flame,
  ListChecks,
  RefreshCw,
  Star,
} from "lucide-react";
import { AnimeCard } from "@/components/AnimeCard";
import { PageHeader } from "@/components/AppShell";
import { AiPanel } from "@/components/AiPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { formatAiringTime } from "@/components/NotificationsDropdown";
import { fetchNextAiringEpisodes } from "@/lib/anilist";
import { useLibrary, useMediaMode, useNotes } from "@/lib/store";
import { MODE_COPY, statusLabel, totalUnits } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Koka — All-in-one Anime Dashboard" },
      {
        name: "description",
        content:
          "Track, plan and analyse your anime list in one calm workspace: AniList & MAL import, seasonal charts, AI news digests and markdown notes.",
      },
      { property: "og:title", content: "Koka — All-in-one Anime Dashboard" },
      {
        property: "og:description",
        content:
          "Track, plan and analyse your anime with seasonal charts, AI news digests and markdown notes.",
      },
    ],
  }),
  component: Dashboard,
});

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flame;
  label: string;
  value: string | number;
}) {
  return (
    <div className="panel p-3.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] tracking-wide uppercase">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Dashboard() {
  const { mode } = useMediaMode();
  const copy = MODE_COPY[mode];
  const { library, patch } = useLibrary();
  const { notes } = useNotes();
  const [refreshing, setRefreshing] = useState(false);

  // Sync schedules with AniList GraphQL on dashboard load
  const syncSchedules = useCallback(async () => {
    const animeEntries = library.filter(
      (e) =>
        e.media.type !== "MANGA" &&
        (e.status === "CURRENT" || e.status === "PLANNING"),
    );
    if (!animeEntries.length) return;
    const ids = animeEntries.map((e) => e.media.id);
    setRefreshing(true);
    try {
      const map = await fetchNextAiringEpisodes(ids);
      map.forEach((nextEp, id) => {
        const existing = library.find((e) => e.media.id === id);
        if (existing) {
          const currentNextEp = existing.media.nextEpisode;
          const hasChanged =
            (!currentNextEp && nextEp) ||
            (currentNextEp && !nextEp) ||
            (currentNextEp &&
              nextEp &&
              (currentNextEp.episode !== nextEp.episode ||
                currentNextEp.airingAt !== nextEp.airingAt));

          if (hasChanged) {
            patch(id, {
              media: { ...existing.media, nextEpisode: nextEp },
            });
          }
        }
      });
    } catch {
      /* ignore Network error */
    } finally {
      setRefreshing(false);
    }
  }, [library, patch]);

  useEffect(() => {
    void syncSchedules();
  }, [syncSchedules]);

  const watching = useMemo(
    () =>
      library
        .filter((e) => e.status === "CURRENT" || e.status === "REPEATING")
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [library],
  );

  // Show anime entries in library with an upcoming airing episode within 14 days
  const airing = useMemo(() => {
    const nowSec = Math.floor(Date.now() / 1000);
    const fourteenDaysSec = 14 * 86400;

    return library
      .filter((e) => {
        const airingAt = e.media.nextEpisode?.airingAt;
        if (!airingAt) return false;
        return airingAt - nowSec <= fourteenDaysSec;
      })
      .sort(
        (a, b) =>
          (a.media.nextEpisode?.airingAt ?? 0) -
          (b.media.nextEpisode?.airingAt ?? 0),
      );
  }, [library]);

  const episodesWatched = library.reduce((s, e) => s + (e.progress || 0), 0);
  const scored = library.filter((e) => e.score);
  const meanScore = scored.length
    ? (scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length).toFixed(
        1,
      )
    : "—";

  const listSummary = library
    .slice(0, 120)
    .map(
      (e) =>
        `${e.media.title} (${statusLabel(e.status, mode)}, ${e.progress}/${totalUnits(e.media) ?? "?"} ${copy.unitShort}${e.score ? `, rated ${e.score}/10` : ""})`,
    )
    .join("; ");

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`Your ${copy.noun} workspace at a glance.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={ListChecks} label="Titles" value={library.length} />
        <Stat
          icon={Flame}
          label={mode === "MANGA" ? "Reading" : "Watching"}
          value={watching.length}
        />
        <Stat
          icon={CalendarClock}
          label={mode === "MANGA" ? "Chapters" : "Episodes"}
          value={episodesWatched}
        />
        <Stat icon={Star} label="Mean score" value={meanScore} />
      </div>

      {library.length === 0 ? (
        <div className="panel mt-6 p-8 text-center">
          <h2 className="font-display text-lg font-semibold">
            Bring your list in
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
            Import an AniList or MyAnimeList JSON/XML export, or sync straight
            from the AniList GraphQL API with your username.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild size="sm">
              <Link to="/import">Import now</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/seasons">Discover</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {airing.length > 0 ? (
            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">
                  Airing schedule ({airing.length})
                </h2>
                <button
                  type="button"
                  onClick={() => void syncSchedules()}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  title="Refresh schedule from AniList"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      refreshing ? "animate-spin text-primary" : "",
                    )}
                  />
                  <span>{refreshing ? "Syncing..." : "Sync AniList"}</span>
                </button>
              </div>

              <div className="panel divide-y divide-border">
                {airing.map((e) => {
                  const airingAt = e.media.nextEpisode?.airingAt ?? 0;
                  const { timeStr, countdownStr, isWithin3Hours } =
                    formatAiringTime(airingAt);

                  return (
                    <Link
                      key={e.media.id}
                      to="/anime/$id"
                      params={{ id: String(e.media.id) }}
                      className="flex items-center gap-3 p-3 transition-colors hover:bg-secondary/60"
                    >
                      <img
                        src={e.media.cover ?? ""}
                        alt=""
                        loading="lazy"
                        className="h-12 w-9 rounded object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {e.media.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Episode {e.media.nextEpisode?.episode} · {timeStr}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            isWithin3Hours
                              ? "bg-destructive/15 text-destructive animate-pulse"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          {countdownStr}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-lg font-semibold">
                {mode === "MANGA" ? "Continue reading" : "Continue watching"}
              </h2>
              <Link
                to="/library"
                className="text-xs text-muted-foreground hover:text-primary"
              >
                View library
              </Link>
            </div>
            {watching.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {watching.slice(0, 10).map((e) => (
                  <AnimeCard key={e.media.id} media={e.media} entry={e} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing in progress right now.
              </p>
            )}
          </section>
        </>
      )}

      <div className="mt-8">
        <ChatPanel
          title="Ask Koka AI"
          description={`Chat about anything ${copy.noun} — grounded in your list.`}
          compact
          allowNoteFetching
          context={
            listSummary ? `The user's library: ${listSummary}` : undefined
          }
          suggestions={[
            `What should I ${copy.verb} tonight?`,
            "Any big anime news this week?",
            "Sum up my taste in one paragraph",
          ]}
        />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <AiPanel
          title="What should I watch tonight?"
          description="A short, spoiler-free pick from your own backlog."
          label="Suggest"
          storageHint="Uses your Gemini key from Settings."
          prompt={() =>
            `From this anime list, recommend 3 titles to watch next and why (mood, pacing, length). Avoid spoilers and character details. Keep each pick to 2 sentences.\n\nList: ${listSummary || "empty list"}`
          }
        />
        <AiPanel
          title="Weekly digest"
          description="Latest news around the shows you're watching."
          label="Digest"
          search
          spoilerFree={false}
          prompt={() =>
            `Give me a concise markdown digest of anime news from the last 14 days for these shows. Group by title, one or two bullets each, include dates. Skip titles with no news.\n\nShows: ${watching
              .slice(0, 20)
              .map((e) => e.media.title)
              .join(", ")}`
          }
        />
      </div>

      {notes.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold">
            Recent notes
          </h2>
          <div className="panel divide-y divide-border">
            {[...notes]
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, 4)
              .map((n) => (
                <Link
                  key={n.animeId}
                  to="/anime/$id"
                  params={{ id: String(n.animeId) }}
                  className="block p-3 transition-colors hover:bg-secondary/60"
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {n.body}
                  </p>
                </Link>
              ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
