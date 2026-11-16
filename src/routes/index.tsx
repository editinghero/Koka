import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Flame,
  ListChecks,
  Pin,
  Play,
  Plus,
  RefreshCw,
  Star,
} from "lucide-react";
import { AnimeCard } from "@/components/AnimeCard";
import { PageHeader } from "@/components/AppShell";
import { AiPanel } from "@/components/AiPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { CommunityPlatformIcon } from "@/components/CommunityPopup";
import { formatAiringTime } from "@/components/NotificationsDropdown";
import { fetchNextAiringEpisodes } from "@/lib/anilist";
import {
  filterAndGroupCommunities,
  shortCategoryLabel,
  sortCommunitiesByLastOpen,
  type CommunityCategory,
  type CommunityItem,
} from "@/lib/community-utils";
import {
  useCommunities,
  useCommunityPopup,
  useLibrary,
  useMediaMode,
  useNotes,
} from "@/lib/store";
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

const DEFAULT_VISIBLE_COMMUNITY_LINKS = 9;

function Dashboard() {
  const { mode } = useMediaMode();
  const copy = MODE_COPY[mode];
  const { library, patch } = useLibrary();
  const { notes } = useNotes();
  const { communities, markCommunityOpened } = useCommunities();
  const { openPopup } = useCommunityPopup();
  const [refreshing, setRefreshing] = useState(false);
  const [communitiesExpanded, setCommunitiesExpanded] = useState(false);

  // Sync schedules with AniList GraphQL on dashboard load
  const syncSchedules = useCallback(async () => {
    setRefreshing(true);
    try {
      const animeEntries = library.filter(
        (e) =>
          e.media.type !== "MANGA" &&
          (e.status === "CURRENT" || e.status === "PLANNING"),
      );
      if (!animeEntries.length) return;
      const ids = animeEntries.map((e) => e.media.id);
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

  // Sort communities with pinned on top, then by lastOpenedAt descending; cap to 9 by default
  const sortedCommunities = useMemo(() => {
    const byOpen = sortCommunitiesByLastOpen(communities);
    return [
      ...byOpen.filter((c) => Boolean(c.pinned)),
      ...byOpen.filter((c) => !c.pinned),
    ];
  }, [communities]);

  const visibleCommunities = useMemo(
    () =>
      communitiesExpanded
        ? sortedCommunities
        : sortedCommunities.slice(0, DEFAULT_VISIBLE_COMMUNITY_LINKS),
    [sortedCommunities, communitiesExpanded],
  );

  const { pinnedItems, generalByCategory, animeGroups } = useMemo(() => {
    const {
      pinnedItems: pItems,
      generalItems,
      animeGroups: aGroups,
    } = filterAndGroupCommunities(visibleCommunities);

    const catMap = new Map<CommunityCategory, CommunityItem[]>();
    for (const item of generalItems) {
      const list = catMap.get(item.category) ?? [];
      list.push(item);
      catMap.set(item.category, list);
    }
    return {
      pinnedItems: pItems,
      generalByCategory: [...catMap.entries()],
      animeGroups: aGroups,
    };
  }, [visibleCommunities]);

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
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-all duration-150 active:scale-95 disabled:opacity-50"
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
                      data-card-press
                      className="flex items-center gap-3 p-3 transition-all duration-150 hover:bg-secondary/60 active:scale-[0.98] active:opacity-80 card-pressable"
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
                      <div className="flex items-center justify-end gap-1.5">
                        {e.progress < (e.media.nextEpisode?.episode ?? 1) - 1 ? (
                          <span
                            className={cn(
                              "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              isWithin3Hours
                                ? "bg-destructive/15 text-destructive animate-pulse"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            {e.progress}/{(e.media.nextEpisode?.episode ?? 1) - 1}
                          </span>
                        ) : null}

                        {(() => {
                          const primaryLink =
                            (e.customLinks ?? []).find(
                              (l) => l.isPrimary && l.url.trim(),
                            ) ??
                            (e.customLinks ?? []).find((l) => l.url.trim()) ??
                            null;
                          if (!primaryLink) return null;
                          return (
                            <button
                              type="button"
                              onClick={(evt) => {
                                evt.preventDefault();
                                evt.stopPropagation();
                                window.open(
                                  primaryLink.url,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                              }}
                              title={`Play (${primaryLink.label || "External"})`}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 active:scale-95",
                                isWithin3Hours
                                  ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
                                  : "bg-primary/10 text-primary hover:bg-primary/20",
                              )}
                            >
                              <Play className="h-3 w-3 fill-current" />
                              <span>Play</span>
                            </button>
                          );
                        })()}
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

      {/* Community Section — Moved to bottom after Weekly Digest, sorted by last open, categorized & grouped by anime with divider, default 9 links + Show more */}
      <section className="panel mt-8 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-foreground">
            Community
          </h2>
          <button
            type="button"
            onClick={() => openPopup({ view: "opener", media: null })}
            aria-label="Open Community"
            title="Open Community"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-all duration-150 hover:border-primary hover:text-primary active:scale-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Pinned Section — Shown on top ONLY when pinnedItems.length > 0 */}
          {pinnedItems.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Pin className="h-3 w-3 text-primary" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  Pinned
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {pinnedItems.map((c) => (
                  <a
                    key={c.id}
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-pill-press
                    onClick={() => markCommunityOpened(c.id)}
                    className="pill-pressable inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-surface px-2.5 py-1.5 font-mono text-xs font-medium text-foreground transition-all duration-150 hover:-translate-y-0.5 hover:border-primary hover:text-primary active:scale-95 active:opacity-85"
                  >
                    <CommunityPlatformIcon
                      platform={c.platform}
                      className="h-3.5 w-3.5 shrink-0"
                    />
                    <span>{c.handle}</span>
                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {pinnedItems.length > 0 &&
          (generalByCategory.length > 0 || animeGroups.length > 0) ? (
            <div className="border-t border-border/60" />
          ) : null}

          {/* Categorized General, News & Other Links (Sorted by Last Open) */}
          {generalByCategory.length > 0 ? (
            <div className="space-y-3">
              {generalByCategory.map(([cat, items]) => (
                <div key={cat} className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {shortCategoryLabel(cat)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((c) => (
                      <a
                        key={c.id}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-pill-press
                        onClick={() => markCommunityOpened(c.id)}
                        className="pill-pressable inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 font-mono text-xs font-medium text-foreground transition-all duration-150 hover:-translate-y-0.5 hover:border-primary hover:text-primary active:scale-95 active:opacity-85"
                      >
                        <CommunityPlatformIcon
                          platform={c.platform}
                          className="h-3.5 w-3.5 shrink-0"
                        />
                        <span>{c.handle}</span>
                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Divider between Categories and Anime Series */}
          {generalByCategory.length > 0 && animeGroups.length > 0 ? (
            <div className="border-t border-border" />
          ) : null}

          {/* Grouped & Sorted by Anime (Sorted by Last Open) */}
          {animeGroups.length > 0 ? (
            <div className="space-y-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Anime & Manga
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {animeGroups.map((group) => (
                  <div
                    key={group.key}
                    data-card-press
                    className="card-pressable flex flex-col justify-between gap-2 rounded-xl border border-border/70 bg-background/40 p-3 transition-all duration-150 hover:border-primary/40 active:scale-[0.98] active:opacity-90"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {group.mediaCover ? (
                          <img
                            src={group.mediaCover}
                            alt=""
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                            className="h-5 w-4 shrink-0 rounded object-cover"
                          />
                        ) : null}
                        {group.mediaId ? (
                          <Link
                            to="/anime/$id"
                            params={{ id: String(group.mediaId) }}
                            className="truncate text-xs font-semibold text-foreground transition-all duration-150 hover:text-primary active:scale-95 active:opacity-80"
                          >
                            {group.title}
                          </Link>
                        ) : (
                          <span className="truncate text-xs font-semibold text-foreground">
                            {group.title}
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {shortCategoryLabel(group.category)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((c) => (
                        <a
                          key={c.id}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-pill-press
                          onClick={() => markCommunityOpened(c.id)}
                          className="pill-pressable inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 font-mono text-xs font-medium text-foreground transition-all duration-150 hover:-translate-y-0.5 hover:border-primary hover:text-primary active:scale-95 active:opacity-85"
                        >
                          <CommunityPlatformIcon
                            platform={c.platform}
                            className="h-3 w-3 shrink-0"
                          />
                          <span>{c.handle}</span>
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Show more / Show less button when total communities > 9 */}
        {sortedCommunities.length > DEFAULT_VISIBLE_COMMUNITY_LINKS ? (
          <div className="mt-4 flex justify-center border-t border-border/60 pt-3">
            <button
              type="button"
              onClick={() => setCommunitiesExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium text-muted-foreground transition-all duration-150 hover:bg-secondary hover:text-foreground active:scale-95"
            >
              <span>
                {communitiesExpanded
                  ? "Show less"
                  : `Show more (${sortedCommunities.length - DEFAULT_VISIBLE_COMMUNITY_LINKS} more)`}
              </span>
              {communitiesExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        ) : null}
      </section>

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
