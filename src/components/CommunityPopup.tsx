import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ExternalLink,
  Globe,
  Loader2,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  COMMUNITY_CATEGORIES,
  discoverCommunitiesClient,
  filterAndGroupCommunities,
  normalizeCategory,
  normalizeCustomLinkInput,
  normalizeRedditInput,
  normalizeXInput,
  shortCategoryLabel,
  type AiDiscoveredCommunities,
  type CommunityCategory,
  type CommunityItem,
  type CommunityPlatform,
} from "@/lib/community-utils";
import {
  useCommunities,
  useCommunityPopup,
  useLibrary,
  useMediaMode,
} from "@/lib/store";
import { searchAnime } from "@/lib/anilist";
import type { AnimeMedia, MediaType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Clean SVG icon for Reddit (no emojis). */
export function RedditIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.477 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10c0-5.523-4.477-10-10-10zm5.89 11.43c.04.24.06.48.06.73 0 2.72-3.17 4.92-7.08 4.92-3.91 0-7.08-2.2-7.08-4.92 0-.25.02-.49.06-.73a1.46 1.46 0 0 1-.59-1.18c0-.81.65-1.46 1.46-1.46.39 0 .74.15 1.01.4 1.01-.72 2.4-1.19 3.95-1.25l.74-3.49a.31.31 0 0 1 .37-.24l2.43.52c.25-.48.75-.81 1.33-.81.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5l-2.12-.45-.65 3.04c1.51.07 2.87.54 3.87 1.25.27-.25.62-.4 1.01-.4.81 0 1.46.65 1.46 1.46 0 .49-.24.92-.59 1.18zM9.25 13c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25S9.94 13 9.25 13zm5.5 0c-.69 0-1.25.56-1.25 1.25s.56 1.25 1.25 1.25 1.25-.56 1.25-1.25S15.44 13 14.75 13zm-5.12 3.62a.38.38 0 0 0-.11.53c.54.81 1.62 1.22 2.48 1.22s1.94-.41 2.48-1.22a.38.38 0 1 0-.64-.42c-.38.57-1.19.89-1.84.89s-1.46-.32-1.84-.89a.38.38 0 0 0-.53-.11z" />
    </svg>
  );
}

/** Clean SVG icon for X.com (no emojis). */
export function XLogoIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** Renders the appropriate monochrome SVG icon for Reddit, X, or Custom Links. */
export function CommunityPlatformIcon({
  platform,
  className = "h-3.5 w-3.5",
}: {
  platform: CommunityPlatform;
  className?: string;
}) {
  if (platform === "reddit") {
    return <RedditIcon className={cn("text-current", className)} />;
  }
  if (platform === "x") {
    return <XLogoIcon className={cn("text-current", className)} />;
  }
  return <Globe className={cn("text-current", className)} />;
}

export function CommunityPopup() {
  const {
    open,
    view,
    media: preselectedMedia,
    search: initialSearch,
    closePopup,
    setPopupView,
    setPopupMedia,
  } = useCommunityPopup();
  const {
    communities,
    upsertCommunities,
    togglePinCommunity,
    markCommunityOpened,
    deleteCommunity,
  } = useCommunities();
  const { all: allLibraryEntries } = useLibrary();
  const { mode: currentMediaMode } = useMediaMode();

  // Opener filter states
  const [platformFilter, setPlatformFilter] = useState<
    "all" | CommunityPlatform
  >("all");
  const [categoryFilter, setCategoryFilter] = useState<
    "all" | CommunityCategory
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Custom Add Form State
  const [customPlatformMode, setCustomPlatformMode] = useState<
    "all" | "reddit" | "x" | "custom"
  >("all");
  const [customName, setCustomName] = useState("");
  const [customRedditInput, setCustomRedditInput] = useState("");
  const [customXInput, setCustomXInput] = useState("");
  const [customLinkUrl, setCustomLinkUrl] = useState("");
  const [customLinkLabel, setCustomLinkLabel] = useState("");
  const [customCategory, setCustomCategory] =
    useState<CommunityCategory>("Anime Series");
  const [customMediaTypeFilter, setCustomMediaTypeFilter] = useState<
    "NONE" | MediaType
  >("ANIME");
  const [customLinkedMediaId, setCustomLinkedMediaId] = useState<string>("");

  // AI Find + Approval State
  const [aiQueryTitle, setAiQueryTitle] = useState("");
  const [aiMediaType, setAiMediaType] = useState<MediaType>(currentMediaMode);
  const [aiSelectedMedia, setAiSelectedMedia] = useState<{
    id?: number | null | undefined;
    title: string;
    type: MediaType;
    cover?: string | null | undefined;
  } | null>(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResult, setAiResult] = useState<AiDiscoveredCommunities | null>(
    null,
  );
  const [approveReddit, setApproveReddit] = useState(true);
  const [approveX, setApproveX] = useState(true);
  const [editableRedditHandle, setEditableRedditHandle] = useState("");
  const [editableRedditUrl, setEditableRedditUrl] = useState("");
  const [editableRedditDesc, setEditableRedditDesc] = useState("");
  const [editableXHandle, setEditableXHandle] = useState("");
  const [editableXUrl, setEditableXUrl] = useState("");
  const [editableXDesc, setEditableXDesc] = useState("");
  const [editableAiCategory, setEditableAiCategory] =
    useState<CommunityCategory>("Anime Series");

  // Live AniList search inside AI picker
  const [anilistResults, setAnilistResults] = useState<AnimeMedia[]>([]);
  const [anilistSearching, setAnilistSearching] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (initialSearch) {
      setSearchQuery(initialSearch);
    } else if (preselectedMedia && view === "opener") {
      setSearchQuery(preselectedMedia.title);
    } else if (!preselectedMedia) {
      setSearchQuery("");
    }

    if (preselectedMedia) {
      setCustomName(preselectedMedia.title);
      setCustomCategory(
        preselectedMedia.type === "MANGA" ? "Manga Series" : "Anime Series",
      );
      setCustomMediaTypeFilter(preselectedMedia.type);
      if (preselectedMedia.id) {
        setCustomLinkedMediaId(String(preselectedMedia.id));
      }
      setAiSelectedMedia(preselectedMedia);
      setAiQueryTitle(preselectedMedia.title);
      setAiMediaType(preselectedMedia.type);
    } else {
      setAiMediaType(currentMediaMode);
      setCustomMediaTypeFilter(currentMediaMode);
    }
  }, [open, preselectedMedia, initialSearch, view, currentMediaMode]);

  // Separate user library lists for Anime vs Manga (no predefined hardcoded items)
  const userMediaByType = useMemo(() => {
    const animeMap = new Map<
      number,
      {
        id: number;
        title: string;
        type: MediaType;
        cover?: string | null | undefined;
      }
    >();
    const mangaMap = new Map<
      number,
      {
        id: number;
        title: string;
        type: MediaType;
        cover?: string | null | undefined;
      }
    >();

    for (const entry of allLibraryEntries) {
      const mType: MediaType =
        entry.media.type === "MANGA" ? "MANGA" : "ANIME";
      const item = {
        id: entry.media.id,
        title: entry.media.title,
        type: mType,
        cover: entry.media.cover ?? null,
      };
      if (mType === "MANGA") {
        mangaMap.set(entry.media.id, item);
      } else {
        animeMap.set(entry.media.id, item);
      }
    }

    return {
      ANIME: [...animeMap.values()],
      MANGA: [...mangaMap.values()],
      ALL: [...animeMap.values(), ...mangaMap.values()],
    };
  }, [allLibraryEntries]);

  // Filtered user list for AI Find tab separated by Anime / Manga
  const filteredUserListForAi = useMemo(() => {
    const list = userMediaByType[aiMediaType];
    const q = aiQueryTitle.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => item.title.toLowerCase().includes(q));
  }, [userMediaByType, aiMediaType, aiQueryTitle]);

  const { filtered, pinnedItems, generalItems, animeGroups } = useMemo(
    () =>
      filterAndGroupCommunities(communities, {
        platform: platformFilter,
        category: categoryFilter,
        search: searchQuery,
      }),
    [communities, platformFilter, categoryFilter, searchQuery],
  );

  if (!open) return null;

  function handleSaveCustom(e: React.FormEvent) {
    e.preventDefault();
    const activeMediaPool =
      customMediaTypeFilter === "NONE"
        ? []
        : userMediaByType[customMediaTypeFilter];
    const linkedMedia =
      customMediaTypeFilter !== "NONE" && customLinkedMediaId
        ? activeMediaPool.find((m) => String(m.id) === customLinkedMediaId)
        : null;

    const baseTitle =
      customName.trim() || linkedMedia?.title || preselectedMedia?.title || "";

    const toSave: CommunityItem[] = [];
    const now = Date.now();
    const resolvedCategory = normalizeCategory(customCategory);

    if (
      (customPlatformMode === "all" || customPlatformMode === "reddit") &&
      customRedditInput.trim()
    ) {
      const norm = normalizeRedditInput(customRedditInput);
      if (!norm.handle) {
        toast.error("Enter a valid subreddit name or URL");
        return;
      }
      toSave.push({
        id: `custom-reddit-${norm.handle.replace(/^r\//i, "").toLowerCase()}-${now}`,
        platform: "reddit",
        name: baseTitle || norm.handle,
        handle: norm.handle,
        url: norm.url,
        category: resolvedCategory,
        mediaId: linkedMedia?.id ?? preselectedMedia?.id ?? null,
        mediaType: linkedMedia?.type ?? preselectedMedia?.type ?? null,
        mediaTitle: linkedMedia?.title ?? preselectedMedia?.title ?? null,
        mediaCover: linkedMedia?.cover ?? preselectedMedia?.cover ?? null,
        pinned: false,
        createdAt: now,
        lastOpenedAt: now,
      });
    }

    if (
      (customPlatformMode === "all" || customPlatformMode === "x") &&
      customXInput.trim()
    ) {
      const norm = normalizeXInput(customXInput);
      if (!norm.handle) {
        toast.error("Enter a valid X handle or URL");
        return;
      }
      toSave.push({
        id: `custom-x-${norm.handle.replace(/^[@#]/, "").toLowerCase()}-${now - 1}`,
        platform: "x",
        name: baseTitle || norm.handle,
        handle: norm.handle,
        url: norm.url,
        category: resolvedCategory,
        mediaId: linkedMedia?.id ?? preselectedMedia?.id ?? null,
        mediaType: linkedMedia?.type ?? preselectedMedia?.type ?? null,
        mediaTitle: linkedMedia?.title ?? preselectedMedia?.title ?? null,
        mediaCover: linkedMedia?.cover ?? preselectedMedia?.cover ?? null,
        pinned: false,
        createdAt: now - 1,
        lastOpenedAt: now - 1,
      });
    }

    if (
      (customPlatformMode === "all" || customPlatformMode === "custom") &&
      customLinkUrl.trim()
    ) {
      const norm = normalizeCustomLinkInput(
        customLinkUrl,
        customLinkLabel || customName,
      );
      if (!norm.url) {
        toast.error("Enter a valid custom link URL");
        return;
      }
      toSave.push({
        id: `custom-link-${now - 2}`,
        platform: "custom",
        name: baseTitle || customLinkLabel.trim() || norm.handle,
        handle: customLinkLabel.trim() || norm.handle,
        url: norm.url,
        category: resolvedCategory,
        mediaId: linkedMedia?.id ?? preselectedMedia?.id ?? null,
        mediaType: linkedMedia?.type ?? preselectedMedia?.type ?? null,
        mediaTitle: linkedMedia?.title ?? preselectedMedia?.title ?? null,
        mediaCover: linkedMedia?.cover ?? preselectedMedia?.cover ?? null,
        pinned: false,
        createdAt: now - 2,
        lastOpenedAt: now - 2,
      });
    }

    if (!toSave.length) {
      toast.error("Enter a Reddit, X, or custom link to add");
      return;
    }

    upsertCommunities(toSave);
    toast.success("Added to Community");

    setCustomName("");
    setCustomRedditInput("");
    setCustomXInput("");
    setCustomLinkUrl("");
    setCustomLinkLabel("");
    setPopupView("opener");
  }

  async function runAiDiscovery(targetMedia?: {
    id?: number | null | undefined;
    title: string;
    type: MediaType;
    cover?: string | null | undefined;
  }) {
    const chosen = targetMedia ?? aiSelectedMedia;
    const titleToSearch = (chosen?.title || aiQueryTitle).trim();
    const typeToSearch = chosen?.type || aiMediaType;

    if (!titleToSearch) {
      toast.error("Select or enter an anime/manga title");
      return;
    }

    if (targetMedia) {
      setAiSelectedMedia(targetMedia);
      setAiQueryTitle(targetMedia.title);
      setAiMediaType(targetMedia.type);
    }

    setAiSearching(true);
    setAiResult(null);
    try {
      const discovered = await discoverCommunitiesClient(
        titleToSearch,
        typeToSearch,
      );
      setAiResult(discovered);
      setApproveReddit(true);
      setApproveX(true);
      setEditableRedditHandle(discovered.reddit.handle);
      setEditableRedditUrl(discovered.reddit.url);
      setEditableRedditDesc(discovered.reddit.description);
      setEditableXHandle(discovered.x.handle);
      setEditableXUrl(discovered.x.url);
      setEditableXDesc(discovered.x.description);
      setEditableAiCategory(normalizeCategory(discovered.category));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Community search failed",
      );
    } finally {
      setAiSearching(false);
    }
  }

  /**
   * Searches both the user's list (filtered automatically via `filteredUserListForAi`)
   * and the AniList DB (`searchAnime`) so the user can pick the anime/manga first,
   * and then click `Find` to discover communities with AI.
   */
  async function handleSearchAnilistTitles() {
    const q = aiQueryTitle.trim();
    if (!q) {
      setAnilistResults([]);
      return;
    }
    setAnilistSearching(true);
    try {
      const results = (await searchAnime(q, aiMediaType)).slice(0, 9);
      setAnilistResults(results);
      const localMatch = userMediaByType[aiMediaType].find((m) =>
        m.title.toLowerCase().includes(q.toLowerCase()),
      );
      if (localMatch) {
        setAiSelectedMedia(localMatch);
      } else if (results[0]) {
        setAiSelectedMedia({
          id: results[0].id,
          title: results[0].title,
          type: aiMediaType,
          cover: results[0].cover,
        });
      }
    } catch {
      toast.error("Could not search AniList");
    } finally {
      setAnilistSearching(false);
    }
  }

  function handleApproveAiCommunities() {
    if (!aiResult) return;
    if (!approveReddit && !approveX) {
      toast.error("Select at least one community");
      return;
    }

    const now = Date.now();
    const matchedFromList = userMediaByType.ALL.find(
      (m) => m.title.toLowerCase() === aiResult.title.toLowerCase(),
    );
    const mediaId =
      aiSelectedMedia?.id ??
      matchedFromList?.id ??
      preselectedMedia?.id ??
      null;
    const mediaTitle =
      aiSelectedMedia?.title ?? matchedFromList?.title ?? aiResult.title;
    const mediaCover =
      aiSelectedMedia?.cover ??
      matchedFromList?.cover ??
      preselectedMedia?.cover ??
      null;
    const mediaType = aiSelectedMedia?.type ?? aiResult.mediaType;

    const approvedItems: CommunityItem[] = [];

    if (approveReddit && editableRedditHandle.trim()) {
      const rNorm = normalizeRedditInput(
        editableRedditUrl || editableRedditHandle,
      );
      approvedItems.push({
        id: `ai-reddit-${rNorm.handle.replace(/^r\//i, "").toLowerCase()}-${mediaId ?? now}`,
        platform: "reddit",
        name: mediaTitle,
        handle: rNorm.handle || editableRedditHandle.trim(),
        url: rNorm.url || editableRedditUrl.trim(),
        category: normalizeCategory(editableAiCategory),
        description: editableRedditDesc.trim(),
        mediaId,
        mediaType,
        mediaTitle,
        mediaCover,
        pinned: false,
        createdAt: now,
        lastOpenedAt: now,
      });
    }

    if (approveX && editableXHandle.trim()) {
      const xNorm = normalizeXInput(editableXUrl || editableXHandle);
      approvedItems.push({
        id: `ai-x-${xNorm.handle.replace(/^[@#]/, "").toLowerCase()}-${mediaId ?? now}`,
        platform: "x",
        name: mediaTitle,
        handle: xNorm.handle || editableXHandle.trim(),
        url: xNorm.url || editableXUrl.trim(),
        category: normalizeCategory(editableAiCategory),
        description: editableXDesc.trim(),
        mediaId,
        mediaType,
        mediaTitle,
        mediaCover,
        pinned: false,
        createdAt: now - 1,
        lastOpenedAt: now - 1,
      });
    }

    upsertCommunities(approvedItems);
    toast.success(`Added ${mediaTitle} communities`);
    setAiResult(null);
    setPopupView("opener");
  }

  function renderCommunityRow(item: CommunityItem, showAnimeChip = true) {
    return (
      <div
        key={item.id}
        data-card-press
        className="group card-pressable flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-border bg-background/60 px-3.5 py-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50 active:scale-[0.97] active:opacity-85"
      >
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => markCommunityOpened(item.id)}
          className="flex min-w-0 flex-1 items-center gap-3 transition-transform duration-150 active:scale-[0.98]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-transform duration-150 group-hover:scale-105">
            <CommunityPlatformIcon
              platform={item.platform}
              className="h-4 w-4"
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-mono text-xs font-semibold text-foreground transition-colors group-hover:text-primary">
                {item.handle}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-60 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {item.mediaTitle || item.name}
            </p>
          </div>
        </a>

        <div className="flex shrink-0 items-center gap-1.5">
          {showAnimeChip && item.mediaId ? (
            <Link
              to="/anime/$id"
              params={{ id: String(item.mediaId) }}
              onClick={closePopup}
              data-pill-press
              className="pill-pressable hidden max-w-[120px] items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all duration-150 hover:border-primary hover:text-foreground active:scale-95 sm:inline-flex"
            >
              {item.mediaCover ? (
                <img
                  src={item.mediaCover}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
                />
              ) : null}
              <span className="truncate">{item.mediaTitle || item.name}</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={() => togglePinCommunity(item.id)}
            aria-label={
              item.pinned ? `Unpin ${item.handle}` : `Pin ${item.handle}`
            }
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
              item.pinned
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              deleteCommunity(item.id);
              toast.success(`Removed ${item.handle}`);
            }}
            aria-label={`Delete ${item.handle}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Community"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
    >
      {/* Solid translucent backdrop (no gradients) */}
      <div
        onClick={closePopup}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-150"
      />

      <div className="relative z-10 flex max-h-[82vh] w-[calc(100vw-1rem)] max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Expanded Responsive Popup Header — No separate plus button; tabs: All | + | Find + AI Logo */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background/60 px-4 py-3 sm:px-6 sm:py-3.5">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-base font-semibold text-foreground sm:text-lg">
              Community
            </h2>
            <span className="hidden rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground sm:inline-block">
              {communities.length}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Expanded Navigation Tab Bar: All | + | Find + Sparkles */}
            <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1.5">
              <button
                type="button"
                onClick={() => setPopupView("opener")}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors sm:px-4",
                  view === "opener"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>

              <button
                type="button"
                onClick={() => setPopupView("add-custom")}
                aria-label="Add Custom"
                title="Add Custom"
                className={cn(
                  "inline-flex items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors sm:px-4",
                  view === "add-custom"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Plus className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setPopupView("add-ai")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors sm:px-4",
                  view === "add-ai"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>Find</span>
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Cross button with NO background */}
            <button
              type="button"
              onClick={closePopup}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Focused Anime Banner when opened from an Anime Card/Detail */}
        {preselectedMedia ? (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2 text-xs sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              {preselectedMedia.cover ? (
                <img
                  src={preselectedMedia.cover}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  className="h-6 w-4 shrink-0 rounded object-cover"
                />
              ) : null}
              <span className="truncate font-semibold text-foreground">
                {preselectedMedia.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {view !== "add-ai" ? (
                <button
                  type="button"
                  onClick={() => {
                    setPopupView("add-ai");
                    void runAiDiscovery(preselectedMedia);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                >
                  <span>Find</span>
                  <Sparkles className="h-3 w-3" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setPopupMedia(null);
                  setSearchQuery("");
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                All
              </button>
            </div>
          </div>
        ) : null}

        {/* BODY CONTENT */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {view === "opener" ? (
            <div className="space-y-4">
              {/* Responsive Filter Bar */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex items-center rounded-xl border border-border bg-background/60 p-0.5">
                    {(
                      [
                        ["all", "All"],
                        ["reddit", "Reddit"],
                        ["x", "X"],
                        ["custom", "Links"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPlatformFilter(key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                          platformFilter === key
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {key !== "all" ? (
                          <CommunityPlatformIcon
                            platform={key}
                            className="h-3 w-3"
                          />
                        ) : null}
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter("all")}
                      className={cn(
                        "rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors",
                        categoryFilter === "all"
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      All
                    </button>
                    {COMMUNITY_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors",
                          categoryFilter === cat
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {shortCategoryLabel(cat)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    aria-label="Search communities"
                    className="h-8 w-full rounded-xl border border-border bg-background/60 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-background/40 p-8 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No communities found
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPopupView("add-custom")}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" onClick={() => setPopupView("add-ai")}>
                      <span>Find</span>
                      <Sparkles className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Pinned Section — Shown at the very top ONLY when pinnedItems.length > 0 */}
                  {pinnedItems.length > 0 ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Pin className="h-3.5 w-3.5 text-primary" />
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                            Pinned
                          </h3>
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {pinnedItems.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {pinnedItems.map((item) =>
                          renderCommunityRow(item, true),
                        )}
                      </div>
                    </div>
                  ) : null}

                  {pinnedItems.length > 0 &&
                  (generalItems.length > 0 || animeGroups.length > 0) ? (
                    <div className="border-t border-border" />
                  ) : null}

                  {/* General & News Communities (Sorted by Last Open) */}
                  {generalItems.length > 0 ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          General & News
                        </h3>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {generalItems.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {generalItems.map((item) =>
                          renderCommunityRow(item, false),
                        )}
                      </div>
                    </div>
                  ) : null}

                  {/* Divider between General and Anime/Manga Series */}
                  {generalItems.length > 0 && animeGroups.length > 0 ? (
                    <div className="border-t border-border" />
                  ) : null}

                  {/* Grouped by Anime / Manga (Sorted by Last Open) */}
                  {animeGroups.length > 0 ? (
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          By Anime & Manga
                        </h3>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {animeGroups.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {animeGroups.map((group) => (
                          <div
                            key={group.key}
                            className="rounded-xl border border-border/70 bg-background/30 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
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
                                    onClick={closePopup}
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
                              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {shortCategoryLabel(group.category)}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {group.items.map((item) =>
                                renderCommunityRow(item, false),
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {/* VIEW 2: ADD (+ TAB) — Supports Reddit, X, and Custom Links + Separated Anime / Manga */}
          {view === "add-custom" ? (
            <form onSubmit={handleSaveCustom} className="space-y-4">
              <div className="rounded-xl border border-border bg-background/50 p-4">
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Add Community or Link
                </h3>

                {/* Platform Toggle: All | Reddit | X | Custom Link */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(
                    [
                      ["all", "All"],
                      ["reddit", "Reddit"],
                      ["x", "X"],
                      ["custom", "Custom Link"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCustomPlatformMode(key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        customPlatformMode === key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {key !== "all" ? (
                        <CommunityPlatformIcon
                          platform={key}
                          className="h-3.5 w-3.5"
                        />
                      ) : null}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* Separate Anime / Manga Selector */}
                <div className="mt-4 space-y-2">
                  <Label className="text-xs">Type</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center rounded-xl border border-border bg-surface p-1">
                      {(
                        [
                          ["NONE", "General"],
                          ["ANIME", "Anime"],
                          ["MANGA", "Manga"],
                        ] as const
                      ).map(([tKey, tLabel]) => (
                        <button
                          key={tKey}
                          type="button"
                          onClick={() => {
                            setCustomMediaTypeFilter(tKey);
                            setCustomLinkedMediaId("");
                            if (tKey === "ANIME") {
                              setCustomCategory("Anime Series");
                            } else if (tKey === "MANGA") {
                              setCustomCategory("Manga Series");
                            } else {
                              setCustomCategory("Other");
                            }
                          }}
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                            customMediaTypeFilter === tKey
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {tLabel}
                        </button>
                      ))}
                    </div>

                    {customMediaTypeFilter !== "NONE" ? (
                      <select
                        id="custom-linked-media"
                        aria-label={
                          customMediaTypeFilter === "MANGA"
                            ? "Select Manga"
                            : "Select Anime"
                        }
                        value={customLinkedMediaId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomLinkedMediaId(val);
                          const found = userMediaByType[
                            customMediaTypeFilter
                          ].find((m) => String(m.id) === val);
                          if (found) {
                            setCustomName(found.title);
                            setCustomCategory(
                              found.type === "MANGA"
                                ? "Manga Series"
                                : "Anime Series",
                            );
                          }
                        }}
                        className="h-9 min-w-[200px] flex-1 rounded-md border border-input bg-surface px-3 text-xs text-foreground"
                      >
                        <option value="">
                          {customMediaTypeFilter === "MANGA"
                            ? `Select Manga from your list (${userMediaByType.MANGA.length})`
                            : `Select Anime from your list (${userMediaByType.ANIME.length})`}
                        </option>
                        {userMediaByType[customMediaTypeFilter].map((m) => (
                          <option key={m.id} value={String(m.id)}>
                            {m.title}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-comm-name" className="text-xs">
                      Title
                    </Label>
                    <Input
                      id="custom-comm-name"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Solo Leveling"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="custom-comm-category" className="text-xs">
                      Category
                    </Label>
                    <select
                      id="custom-comm-category"
                      value={customCategory}
                      onChange={(e) =>
                        setCustomCategory(e.target.value as CommunityCategory)
                      }
                      className="h-9 w-full rounded-md border border-input bg-surface px-3 text-xs text-foreground"
                    >
                      {COMMUNITY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {shortCategoryLabel(c)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {customPlatformMode === "all" ||
                  customPlatformMode === "reddit" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-reddit-input" className="text-xs">
                        Reddit (r/...)
                      </Label>
                      <Input
                        id="custom-reddit-input"
                        value={customRedditInput}
                        onChange={(e) => setCustomRedditInput(e.target.value)}
                        placeholder="r/sololeveling"
                        required={customPlatformMode === "reddit"}
                      />
                    </div>
                  ) : null}

                  {customPlatformMode === "all" ||
                  customPlatformMode === "x" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="custom-x-input" className="text-xs">
                        X (@handle or URL)
                      </Label>
                      <Input
                        id="custom-x-input"
                        value={customXInput}
                        onChange={(e) => setCustomXInput(e.target.value)}
                        placeholder="@sololeveling_pr"
                        required={customPlatformMode === "x"}
                      />
                    </div>
                  ) : null}

                  {customPlatformMode === "all" ||
                  customPlatformMode === "custom" ? (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="custom-link-url" className="text-xs">
                          Custom Link URL
                        </Label>
                        <Input
                          id="custom-link-url"
                          value={customLinkUrl}
                          onChange={(e) => setCustomLinkUrl(e.target.value)}
                          placeholder="https://discord.gg/... or wiki URL"
                          required={customPlatformMode === "custom"}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="custom-link-label" className="text-xs">
                          Link Label (Optional)
                        </Label>
                        <Input
                          id="custom-link-label"
                          value={customLinkLabel}
                          onChange={(e) => setCustomLinkLabel(e.target.value)}
                          placeholder="e.g. Discord, Wiki, MAL"
                        />
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPopupView("opener")}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </div>
            </form>
          ) : null}

          {/* VIEW 3: FIND + AI LOGO — Two Buttons: Search (AniList DB + User List) & Find (AI Discovery) */}
          {view === "add-ai" ? (
            <div className="space-y-4">
              {aiSearching ? (
                <div className="flex items-center justify-center gap-3 rounded-xl border border-border bg-background/50 p-5">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="truncate text-xs font-medium text-foreground">
                    Finding communities for &ldquo;
                    {aiSelectedMedia?.title || aiQueryTitle}&rdquo;...
                  </p>
                </div>
              ) : null}

              {aiResult ? (
                <div className="min-w-0 space-y-3.5 overflow-hidden rounded-xl border border-primary/50 bg-background/70 p-3.5 sm:p-4">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                        Approve Community
                      </span>
                      <h4 className="truncate font-display text-sm font-semibold text-foreground sm:text-base">
                        {aiResult.title}
                      </h4>
                    </div>
                    <select
                      aria-label="Category"
                      value={editableAiCategory}
                      onChange={(e) =>
                        setEditableAiCategory(
                          e.target.value as CommunityCategory,
                        )
                      }
                      className="h-8 shrink-0 rounded-lg border border-border bg-surface px-2.5 text-xs text-foreground"
                    >
                      {COMMUNITY_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {shortCategoryLabel(c)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Discovered Reddit Card — min-w-0 + overflow-hidden prevents any URL overflow */}
                    <div
                      className={cn(
                        "min-w-0 space-y-2.5 overflow-hidden rounded-xl border p-3 transition-colors",
                        approveReddit
                          ? "border-primary/50 bg-surface"
                          : "border-border bg-surface/40 opacity-60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <RedditIcon className="h-4 w-4 shrink-0 text-foreground" />
                          <span className="truncate text-xs font-semibold text-foreground">
                            Reddit
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          aria-label="Approve Reddit"
                          checked={approveReddit}
                          onChange={(e) => setApproveReddit(e.target.checked)}
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                      </div>

                      <Input
                        value={editableRedditHandle}
                        onChange={(e) => {
                          setEditableRedditHandle(e.target.value);
                          const norm = normalizeRedditInput(e.target.value);
                          if (norm.url) setEditableRedditUrl(norm.url);
                        }}
                        className="h-8 w-full min-w-0 font-mono text-xs"
                      />

                      <div className="flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
                        <span
                          title={editableRedditUrl}
                          className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
                        >
                          {editableRedditUrl}
                        </span>
                        <a
                          href={editableRedditUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-pill-press
                          className="pill-pressable inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary transition-all duration-150 hover:underline active:scale-95"
                        >
                          <span>Check</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>

                    {/* Discovered X.com Card — min-w-0 + overflow-hidden prevents any URL overflow */}
                    <div
                      className={cn(
                        "min-w-0 space-y-2.5 overflow-hidden rounded-xl border p-3 transition-colors",
                        approveX
                          ? "border-primary/50 bg-surface"
                          : "border-border bg-surface/40 opacity-60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <XLogoIcon className="h-3.5 w-3.5 shrink-0 text-foreground" />
                          <span className="truncate text-xs font-semibold text-foreground">
                            X.com
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          aria-label="Approve X"
                          checked={approveX}
                          onChange={(e) => setApproveX(e.target.checked)}
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                      </div>

                      <Input
                        value={editableXHandle}
                        onChange={(e) => {
                          setEditableXHandle(e.target.value);
                          const norm = normalizeXInput(e.target.value);
                          if (norm.url) setEditableXUrl(norm.url);
                        }}
                        className="h-8 w-full min-w-0 font-mono text-xs"
                      />

                      <div className="flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-lg border border-border/60 bg-background/60 px-2.5 py-1.5">
                        <span
                          title={editableXUrl}
                          className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
                        >
                          {editableXUrl}
                        </span>
                        <a
                          href={editableXUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-pill-press
                          className="pill-pressable inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary transition-all duration-150 hover:underline active:scale-95"
                        >
                          <span>Check</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAiResult(null)}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApproveAiCommunities}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Add
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-background/50 p-3.5 sm:p-4">
                <div className="space-y-3.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {/* Separate Anime and Manga Toggle */}
                    <div className="flex shrink-0 self-start rounded-xl border border-border bg-surface p-1 sm:self-auto">
                      {(["ANIME", "MANGA"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            setAiMediaType(t);
                            setAnilistResults([]);
                          }}
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                            aiMediaType === t
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {t === "ANIME" ? "Anime" : "Manga"}
                        </button>
                      ))}
                    </div>

                    <Input
                      id="ai-anime-search-input"
                      value={aiQueryTitle}
                      onChange={(e) => {
                        setAiQueryTitle(e.target.value);
                        setAiSelectedMedia(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleSearchAnilistTitles();
                        }
                      }}
                      placeholder={
                        aiMediaType === "MANGA"
                          ? "Search manga in your list or AniList..."
                          : "Search anime in your list or AniList..."
                      }
                      className="min-w-0 flex-1"
                    />

                    {/* Two Clear Buttons: 1) Search (AniList DB + User List) and 2) Find (AI Discovery) */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={anilistSearching || !aiQueryTitle.trim()}
                        onClick={() => void handleSearchAnilistTitles()}
                        className="h-9 flex-1 px-3 text-xs sm:flex-initial"
                      >
                        {anilistSearching ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Search className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        <span>Search</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          aiSearching ||
                          (!aiQueryTitle.trim() && !aiSelectedMedia)
                        }
                        onClick={() => void runAiDiscovery()}
                        className="h-9 flex-1 px-3 text-xs sm:flex-initial"
                      >
                        <span>Find</span>
                        {aiSearching ? (
                          <Loader2 className="ml-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="ml-1.5 h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* AniList DB Search Results */}
                  {anilistResults.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          AniList Search Results
                        </p>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {anilistResults.length}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {anilistResults.map((m) => {
                          const isSelected = aiSelectedMedia?.id === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                const picked = {
                                  id: m.id,
                                  title: m.title,
                                  type: aiMediaType,
                                  cover: m.cover,
                                };
                                setAiSelectedMedia(picked);
                                setAiQueryTitle(m.title);
                              }}
                              className={cn(
                                "flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-xl border p-2 text-left text-xs transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/15 text-foreground"
                                  : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground",
                              )}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                {m.cover ? (
                                  <img
                                    src={m.cover}
                                    alt=""
                                    className="h-9 w-6 shrink-0 rounded object-cover"
                                  />
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-foreground">
                                    {m.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {aiMediaType === "MANGA"
                                      ? "Manga"
                                      : "Anime"}
                                  </p>
                                </div>
                              </div>
                              {isSelected ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* User List (Strictly separated by Anime vs Manga, filtered by Search query) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {aiMediaType === "MANGA"
                          ? "Your Manga List"
                          : "Your Anime List"}
                      </p>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {filteredUserListForAi.length}
                      </span>
                    </div>

                    {filteredUserListForAi.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-5 text-center text-xs text-muted-foreground">
                        {aiQueryTitle.trim()
                          ? `No ${aiMediaType === "MANGA" ? "manga" : "anime"} matching "${aiQueryTitle}" in your list. Click Search to search AniList.`
                          : `No ${aiMediaType === "MANGA" ? "manga" : "anime"} in your list yet. Use Search above to search AniList.`}
                      </div>
                    ) : (
                      <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
                        {filteredUserListForAi.map((item) => {
                          const isSelected =
                            aiSelectedMedia?.id === item.id ||
                            aiQueryTitle.toLowerCase() ===
                              item.title.toLowerCase();
                          return (
                            <button
                              key={`${item.type}:${item.id}`}
                              type="button"
                              onClick={() => {
                                setAiSelectedMedia(item);
                                setAiQueryTitle(item.title);
                                setAiMediaType(item.type);
                              }}
                              className={cn(
                                "flex min-w-0 items-center justify-between gap-2 overflow-hidden rounded-xl border p-2 text-left transition-colors",
                                isSelected
                                  ? "border-primary bg-primary/15 text-foreground"
                                  : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground",
                              )}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                {item.cover ? (
                                  <img
                                    src={item.cover}
                                    alt=""
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                    className="h-9 w-6 shrink-0 rounded object-cover"
                                  />
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-foreground">
                                    {item.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {item.type === "MANGA" ? "Manga" : "Anime"}
                                  </p>
                                </div>
                              </div>
                              {isSelected ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
