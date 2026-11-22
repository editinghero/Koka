import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ExternalLink,
  Film,
  Heart,
  Mic,
  RefreshCw,
  Share2,
  Sparkles,
  Tv,
  User,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { AiPanel } from "@/components/AiPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { Markdown } from "@/components/Markdown";
import { StatsShareDialog } from "@/components/StatsShareDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchUserProfile } from "@/lib/anilist";
import { useLibrary, useMediaMode, useSettings, useUserProfile } from "@/lib/store";
import { MODE_COPY, STATUS_ORDER, statusLabel } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Taste Insights — Koka Anime Dashboard" },
      {
        name: "description",
        content:
          "Visual stats, user profile, favorites, top genres, score distribution and analytics.",
      },
      { property: "og:title", content: "Taste Insights — Koka" },
      {
        property: "og:description",
        content:
          "Full user profile, favorites, score distribution and AI analysis of your taste.",
      },
    ],
  }),
  component: InsightsPage,
});

function Bar({
  label,
  value,
  max,
  sub,
  image,
}: {
  label: string;
  value: number;
  max: number;
  sub?: string | undefined;
  image?: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-3">
      {image ? (
        <img
          src={image}
          alt={label}
          className="h-5 w-5 shrink-0 rounded object-cover"
        />
      ) : null}
      <span
        className="w-28 shrink-0 truncate text-xs text-muted-foreground"
        title={label}
      >
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${max ? (value / max) * 100 : 0}%` }}
        />
      </div>
      <div className="flex w-16 shrink-0 items-center justify-end gap-1.5 text-right text-xs">
        <span className="tabular-nums font-medium">{value}</span>
        {sub ? (
          <span className="text-[10px] text-muted-foreground">{sub}</span>
        ) : null}
      </div>
    </div>
  );
}

function InsightsPage() {
  const { mode } = useMediaMode();
  const copy = MODE_COPY[mode];
  const { library } = useLibrary();
  const { profile: userProfile, setProfile } = useUserProfile();
  const { settings, update: updateSettings } = useSettings();
  const [shareOpen, setShareOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [userInput, setUserInput] = useState(settings.anilistUser || "");
  const [favTab, setFavTab] = useState<"anime" | "manga" | "characters" | "voiceActors">("anime");
  const [statsSource, setStatsSource] = useState<"library" | "anilist">("library");

  async function handleSync(targetUsername?: string) {
    const u = (targetUsername ?? settings.anilistUser ?? userInput).trim();
    if (!u) {
      toast.error("Please enter an AniList username");
      return;
    }
    setSyncing(true);
    try {
      const data = await fetchUserProfile(u);
      if (!data) {
        toast.error(`User "${u}" not found on AniList`);
        return;
      }
      setProfile(data);
      if (u !== settings.anilistUser) {
        updateSettings({ anilistUser: u });
      }
      toast.success(`Profile & stats for ${data.name} synced!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to sync user profile",
      );
    } finally {
      setSyncing(false);
    }
  }

  // Local library stats
  const genres = useMemo(() => {
    const counts: Record<string, number> = {};
    library.forEach((e) =>
      e.media.genres?.forEach((g) => (counts[g] = (counts[g] ?? 0) + 1)),
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [library]);

  const studios = useMemo(() => {
    const counts: Record<string, number> = {};
    library.forEach((e) =>
      e.media.studios?.forEach((s) => (counts[s] = (counts[s] ?? 0) + 1)),
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [library]);

  const scores = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      label: `${i + 1}`,
      value: 0,
    }));
    library.forEach((e) => {
      const s = Math.round(e.score ?? 0);
      if (s >= 1 && s <= 10) buckets[s - 1]!.value += 1;
    });
    return buckets;
  }, [library]);

  const statusCounts = STATUS_ORDER.map((s) => ({
    label: statusLabel(s, mode),
    value: library.filter((e) => e.status === s).length,
  }));

  const activeLibrary = library.filter(
    (e) => e.status !== "PLANNING" && (e.progress ?? 0) > 0,
  );

  const hoursSpent = Math.round(
    activeLibrary.reduce(
      (s, e) =>
        s + e.progress * (mode === "MANGA" ? 5 : (e.media.duration ?? 24)),
      0,
    ) / 60,
  );

  const favAnimeList =
    userProfile?.favorites?.anime?.map((a) => a.title).slice(0, 10).join(", ") || "";

  const ratedTitlesContext = library
    .filter((e) => e.score)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 40)
    .map((e) => `${e.media.title} ${e.score}/10 [${e.media.genres?.join("/")}]`)
    .join("; ");

  const profileContext = [
    favAnimeList ? `Favorite Anime: ${favAnimeList}` : "",
    ratedTitlesContext,
  ]
    .filter(Boolean)
    .join("; ");

  const backlog = library
    .filter((e) => e.status === "PLANNING")
    .slice(0, 40)
    .map((e) => e.media.title)
    .join(", ");

  const maxGenre = genres[0]?.[1] ?? 1;
  const maxStudio = studios[0]?.[1] ?? 1;
  const maxScore = Math.max(...scores.map((s) => s.value), 1);

  // Stats from AniList profile
  const aniStats = mode === "MANGA" ? userProfile?.mangaStats : userProfile?.animeStats;
  const hasAniStats = Boolean(aniStats && (aniStats.scores?.length || aniStats.statuses?.length));

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle={`${hoursSpent} ${copy.timeLabel.toLowerCase()} across ${activeLibrary.length} active ${copy.nounPlural} titles.`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSync()}
              disabled={syncing}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Profile"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShareOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
          </div>
        }
      />
      <StatsShareDialog open={shareOpen} onOpenChange={setShareOpen} />

      {/* ── User Profile Section ── */}
      <section className="panel mb-6 overflow-hidden">
        {userProfile?.banner ? (
          <div className="relative h-28 w-full overflow-hidden bg-secondary sm:h-36">
            <img
              src={userProfile.banner}
              alt="Profile banner"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
          </div>
        ) : null}

        <div className="p-4 sm:p-5">
          {userProfile ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {userProfile.avatar ? (
                    <img
                      src={userProfile.avatar}
                      alt={userProfile.name}
                      className="h-14 w-14 rounded-2xl border-2 border-background object-cover shadow-sm ring-1 ring-border sm:h-16 sm:w-16"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:h-16 sm:w-16">
                      <User className="h-7 w-7" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-bold sm:text-xl">
                        {userProfile.name}
                      </h2>
                      {userProfile.siteUrl ? (
                        <a
                          href={userProfile.siteUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="View on AniList"
                          className="text-muted-foreground transition-colors hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      AniList Profile · Synced{" "}
                      {new Date(userProfile.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSync(userProfile.name)}
                  disabled={syncing}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`}
                  />
                  Refresh Profile
                </Button>
              </div>

              {/* Bio / About */}
              {userProfile.about ? (
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs leading-relaxed text-muted-foreground">
                  <Markdown>{userProfile.about}</Markdown>
                </div>
              ) : null}

              {/* Quick Stat Chips */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Anime Watched
                  </div>
                  <div className="font-display text-base font-bold text-foreground">
                    {userProfile.animeStats?.count ?? activeLibrary.length} titles
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {userProfile.animeStats?.episodesWatched
                      ? `${userProfile.animeStats.episodesWatched} eps`
                      : `${hoursSpent} hrs`}
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Anime Mean Score
                  </div>
                  <div className="font-display text-base font-bold text-foreground">
                    {userProfile.animeStats?.meanScore
                      ? `${userProfile.animeStats.meanScore}%`
                      : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {userProfile.animeStats?.minutesWatched
                      ? `${(userProfile.animeStats.minutesWatched / 1440).toFixed(1)} days`
                      : "score average"}
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Manga Read
                  </div>
                  <div className="font-display text-base font-bold text-foreground">
                    {userProfile.mangaStats?.count ?? 0} titles
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {userProfile.mangaStats?.chaptersRead ?? 0} chapters
                  </div>
                </div>

                <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Manga Mean Score
                  </div>
                  <div className="font-display text-base font-bold text-foreground">
                    {userProfile.mangaStats?.meanScore
                      ? `${userProfile.mangaStats.meanScore}%`
                      : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {userProfile.mangaStats?.volumesRead ?? 0} volumes
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold">
                  Pull your full AniList Profile & Favorites
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Bio, favorite characters, anime, manga, voice actors, and full
                  statistics.
                </p>
              </div>
              <div className="flex w-full max-w-sm items-center gap-2">
                <Input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="AniList username (e.g. kokaneko)"
                  className="h-9 text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => handleSync(userInput)}
                  disabled={syncing}
                  className="h-9 gap-1.5 text-xs"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  Sync
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Favorites Section ── */}
      {userProfile?.favorites ? (
        <section className="panel mb-6 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500 fill-rose-500/20" />
              <h2 className="font-display text-sm font-semibold">Favorites</h2>
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  { id: "anime", label: "Anime", count: userProfile.favorites.anime?.length ?? 0 },
                  { id: "manga", label: "Manga", count: userProfile.favorites.manga?.length ?? 0 },
                  { id: "characters", label: "Characters", count: userProfile.favorites.characters?.length ?? 0 },
                  { id: "voiceActors", label: "Voice Actors", count: userProfile.favorites.voiceActors?.length ?? 0 },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFavTab(tab.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                    favTab === tab.id
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {tab.label} {tab.count > 0 ? `(${tab.count})` : ""}
                </button>
              ))}
            </div>
          </div>

          {favTab === "anime" ? (
            userProfile.favorites.anime?.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {userProfile.favorites.anime.map((a) => (
                  <Link
                    key={a.id}
                    to="/anime/$id"
                    params={{ id: String(a.id) }}
                    className="group flex flex-col gap-1.5"
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary shadow transition-all duration-150 group-hover:scale-[1.02] group-hover:shadow-md">
                      {a.cover ? (
                        <img
                          src={a.cover}
                          alt={a.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Film className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <span className="line-clamp-2 text-xs font-medium text-foreground transition-colors group-hover:text-primary">
                      {a.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {[a.format, a.year].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No favorite anime listed on AniList profile.
              </p>
            )
          ) : null}

          {favTab === "manga" ? (
            userProfile.favorites.manga?.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {userProfile.favorites.manga.map((m) => (
                  <div key={m.id} className="group flex flex-col gap-1.5">
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-secondary shadow transition-all duration-150 group-hover:scale-[1.02]">
                      {m.cover ? (
                        <img
                          src={m.cover}
                          alt={m.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Film className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <span className="line-clamp-2 text-xs font-medium text-foreground">
                      {m.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {[m.format, m.year].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No favorite manga listed on AniList profile.
              </p>
            )
          ) : null}

          {favTab === "characters" ? (
            userProfile.favorites.characters?.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {userProfile.favorites.characters.map((c) => (
                  <div key={c.id} className="group flex flex-col items-center gap-1.5 text-center">
                    <div className="aspect-square w-20 overflow-hidden rounded-full bg-secondary shadow ring-2 ring-border/50 transition-all duration-150 group-hover:scale-105 sm:w-24">
                      {c.image ? (
                        <img
                          src={c.image}
                          alt={c.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <User className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <span className="line-clamp-2 text-xs font-medium text-foreground">
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No favorite characters listed on AniList profile.
              </p>
            )
          ) : null}

          {favTab === "voiceActors" ? (
            userProfile.favorites.voiceActors?.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {userProfile.favorites.voiceActors.map((v) => (
                  <div key={v.id} className="group flex flex-col items-center gap-1.5 text-center">
                    <div className="aspect-square w-20 overflow-hidden rounded-full bg-secondary shadow ring-2 ring-border/50 transition-all duration-150 group-hover:scale-105 sm:w-24">
                      {v.image ? (
                        <img
                          src={v.image}
                          alt={v.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Mic className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <span className="line-clamp-1 text-xs font-medium text-foreground">
                      {v.name}
                    </span>
                    <span className="line-clamp-1 text-[10px] text-muted-foreground">
                      {v.occupations?.join(", ") || "Voice Actor"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No favorite voice actors listed on AniList profile.
              </p>
            )
          ) : null}
        </section>
      ) : null}

      {/* ── Detailed Analytics Grid (matching Score Distribution bar design) ── */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-bold">Analytics & Breakdowns</h2>
        {hasAniStats ? (
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/30 p-0.5">
            <button
              type="button"
              onClick={() => setStatsSource("library")}
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                statsSource === "library"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Dashboard Data
            </button>
            <button
              type="button"
              onClick={() => setStatsSource("anilist")}
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                statsSource === "anilist"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              AniList Full Stats
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top Genres */}
        <section className="panel space-y-2.5 p-4">
          <h2 className="font-display text-sm font-semibold">Top genres</h2>
          {statsSource === "anilist" && aniStats?.genres?.length ? (
            aniStats.genres.slice(0, 10).map((g) => (
              <Bar
                key={g.label}
                label={g.label}
                value={g.count}
                max={Math.max(...aniStats.genres!.map((x) => x.count), 1)}
                sub={g.meanScore ? `${g.meanScore}%` : undefined}
              />
            ))
          ) : genres.length ? (
            genres.map(([g, v]) => (
              <Bar key={g} label={g} value={v} max={maxGenre} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          )}
        </section>

        {/* Studios */}
        <section className="panel space-y-2.5 p-4">
          <h2 className="font-display text-sm font-semibold">Studios</h2>
          {statsSource === "anilist" && aniStats?.studios?.length ? (
            aniStats.studios.slice(0, 8).map((s) => (
              <Bar
                key={s.label}
                label={s.label}
                value={s.count}
                max={Math.max(...aniStats.studios!.map((x) => x.count), 1)}
                sub={s.meanScore ? `${s.meanScore}%` : undefined}
              />
            ))
          ) : studios.length ? (
            studios.map(([s, v]) => (
              <Bar key={s} label={s} value={v} max={maxStudio} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          )}
        </section>

        {/* Score Distribution */}
        <section className="panel space-y-2.5 p-4">
          <h2 className="font-display text-sm font-semibold">
            Score distribution
          </h2>
          {statsSource === "anilist" && aniStats?.scores?.length ? (
            aniStats.scores.map((s) => (
              <Bar
                key={s.label}
                label={`${s.label}/100`}
                value={s.count}
                max={Math.max(...aniStats.scores!.map((x) => x.count), 1)}
              />
            ))
          ) : (
            scores.map((s) => (
              <Bar
                key={s.label}
                label={`${s.label}/10`}
                value={s.value}
                max={maxScore}
              />
            ))
          )}
        </section>

        {/* Status Split */}
        <section className="panel space-y-2.5 p-4">
          <h2 className="font-display text-sm font-semibold">Status split</h2>
          {statsSource === "anilist" && aniStats?.statuses?.length ? (
            aniStats.statuses.map((s) => (
              <Bar
                key={s.label}
                label={s.label}
                value={s.count}
                max={Math.max(...aniStats.statuses!.map((x) => x.count), 1)}
                sub={s.meanScore ? `${s.meanScore}%` : undefined}
              />
            ))
          ) : (
            statusCounts.map((s) => (
              <Bar
                key={s.label}
                label={s.label}
                value={s.value}
                max={Math.max(...statusCounts.map((x) => x.value), 1)}
              />
            ))
          )}
        </section>

        {/* Format Distribution (from AniList) */}
        {aniStats?.formats?.length ? (
          <section className="panel space-y-2.5 p-4">
            <h2 className="font-display text-sm font-semibold">Format split</h2>
            {aniStats.formats.map((f) => (
              <Bar
                key={f.label}
                label={f.label}
                value={f.count}
                max={Math.max(...aniStats.formats!.map((x) => x.count), 1)}
              />
            ))}
          </section>
        ) : null}

        {/* Top Voice Actors (from AniList) */}
        {aniStats?.voiceActors?.length ? (
          <section className="panel space-y-2.5 p-4">
            <h2 className="font-display text-sm font-semibold">
              Top voice actors
            </h2>
            {aniStats.voiceActors.slice(0, 8).map((va) => (
              <Bar
                key={va.label}
                label={va.label}
                value={va.count}
                max={Math.max(...aniStats.voiceActors!.map((x) => x.count), 1)}
                sub={va.meanScore ? `${va.meanScore}%` : undefined}
                image={va.image}
              />
            ))}
          </section>
        ) : null}
      </div>

      <div className="mt-6">
        <ChatPanel
          title="Ask about your taste"
          description="A free-form chat that knows your ratings and backlog."
          allowNoteFetching
          context={`Rated titles: ${profileContext || "none"}. Planned backlog: ${backlog || "empty"}.`}
          suggestions={[
            "What genres am I avoiding?",
            "Build me a 5-title watch plan for this month",
            "Which of my ratings look inconsistent?",
          ]}
        />
      </div>

      <div className="mt-6 grid gap-4">
        <AiPanel
          title="Taste profile"
          description="What your ratings say about what you actually enjoy."
          label="Analyse"
          prompt={() =>
            `Analyse this rated ${copy.noun} list and write a markdown taste profile: dominant themes, tone preferences, pacing, what you consistently rate high vs low, and blind spots worth exploring. No spoilers, no character discussion.\n\nRatings: ${profileContext || "no rated titles"}`
          }
        />
        <AiPanel
          title="Backlog triage"
          description="Order your planned list into a sensible watch queue."
          label="Triage"
          prompt={() =>
            `Given my taste (${profileContext.slice(0, 1500) || "unknown"}), sort this planned backlog into a ${copy.verb} queue. Output a markdown table: Order, Title, Why now, Commitment (short/medium/long). Keep it spoiler-free.\n\nBacklog: ${backlog || "empty"}`
          }
        />
        <AiPanel
          title="Hidden gems"
          description="Recommendations outside the obvious picks."
          label="Find gems"
          search
          prompt={() =>
            `Based on my highly rated ${copy.nounPlural}, recommend 6 lesser-known ${copy.nounPlural} titles I likely haven't seen (exclude anything in the list). For each: title, year, one-line premise with no spoilers or character details, and why it fits my taste. Markdown list.\n\nMy list: ${profileContext || "unknown"}`
          }
        />
      </div>
    </>
  );
}
