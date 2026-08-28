import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Clock,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { fetchNextAiringEpisodes } from "@/lib/anilist";
import { useLibrary } from "@/lib/store";
import type { LibraryEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const READ_NOTIFS_KEY = "koka_read_notif_keys";
const DISMISSED_NOTIFS_KEY = "koka_dismissed_notif_keys";

export function formatAiringTime(airingAtSeconds: number): {
  timeStr: string;
  countdownStr: string;
  isWithin3Hours: boolean;
  isPast: boolean;
} {
  const nowMs = Date.now();
  const airingMs = airingAtSeconds * 1000;
  const diffMs = airingMs - nowMs;
  const diffSeconds = Math.floor(diffMs / 1000);

  const isPast = diffSeconds <= 0;
  const isWithin3Hours = !isPast && diffSeconds <= 3 * 3600;

  const dateObj = new Date(airingMs);
  const timeStr = dateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isPast) {
    return {
      timeStr: `Aired at ${timeStr}`,
      countdownStr: "Airing now / Recently aired",
      isWithin3Hours: false,
      isPast: true,
    };
  }

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const days = Math.floor(hours / 24);

  let countdownStr = "";
  if (days > 0) {
    countdownStr = `in ${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    countdownStr = `in ${hours}h ${minutes}m`;
  } else {
    countdownStr = `in ${minutes}m`;
  }

  return {
    timeStr: `Today at ${timeStr}`,
    countdownStr,
    isWithin3Hours,
    isPast: false,
  };
}

export type AiringNotificationItem = {
  id: number;
  /** Unique key per episode e.g. "123:5" for Anime #123 Episode 5 */
  key: string;
  entry: LibraryEntry;
  episode: number;
  airingAt: number;
  timeStr: string;
  countdownStr: string;
  isWithin3Hours: boolean;
  isPast: boolean;
};

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { library, patch } = useLibrary();
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<
    "ALL" | "URGENT" | "CURRENT" | "PLANNING"
  >("ALL");

  const notifiedKeysRef = useRef<Set<string>>(new Set());

  // Read notification keys e.g. ["123:5", "456:12"]
  const [readKeys, setReadKeys] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(READ_NOTIFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {
      /* ignore */
    }
    return new Set();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        READ_NOTIFS_KEY,
        JSON.stringify(Array.from(readKeys)),
      );
    } catch {
      /* ignore */
    }
  }, [readKeys]);

  // Dismissed notification keys e.g. ["123:5"]
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem(DISMISSED_NOTIFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {
      /* ignore */
    }
    return new Set();
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        DISMISSED_NOTIFS_KEY,
        JSON.stringify(Array.from(dismissedKeys)),
      );
    } catch {
      /* ignore */
    }
  }, [dismissedKeys]);

  const dismissItem = useCallback((key: string) => {
    setDismissedKeys((prev) => new Set([...prev, key]));
  }, []);

  // Live refresh airing schedule timestamps directly from AniList GraphQL
  const refreshSchedules = useCallback(async () => {
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

  // Sync schedules on mount & periodically every 5 minutes
  useEffect(() => {
    void refreshSchedules();
    const interval = setInterval(
      () => {
        void refreshSchedules();
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [refreshSchedules]);

  // Refresh whenever user opens the dropdown
  useEffect(() => {
    if (isOpen) {
      void refreshSchedules();
    }
  }, [isOpen, refreshSchedules]);

  // Compute upcoming airing items from user's library (only items airing within 14 days)
  const airingItems: AiringNotificationItem[] = useMemo(() => {
    const items: AiringNotificationItem[] = [];
    const nowSec = Math.floor(Date.now() / 1000);
    const fourteenDaysSec = 14 * 86400;

    library.forEach((entry) => {
      const airingAt = entry.media.nextEpisode?.airingAt;
      if (airingAt) {
        const diffSec = airingAt - nowSec;
        const ep = entry.media.nextEpisode.episode;
        const key = `${entry.media.id}:${ep}`;
        if (dismissedKeys.has(key)) return;
        // Include only if episode is airing within 14 days (or already past/airing today)
        if (diffSec <= fourteenDaysSec) {
          const { timeStr, countdownStr, isWithin3Hours, isPast } =
            formatAiringTime(airingAt);
          items.push({
            id: entry.media.id,
            key,
            entry,
            episode: ep,
            airingAt,
            timeStr,
            countdownStr,
            isWithin3Hours,
            isPast,
          });
        }
      }
    });

    return items.sort((a, b) => a.airingAt - b.airingAt);
  }, [library, dismissedKeys]);

  const clearReadNotifs = useCallback(() => {
    const toDismiss = airingItems
      .filter((i) => readKeys.has(i.key))
      .map((i) => i.key);
    if (toDismiss.length) {
      setDismissedKeys((prev) => new Set([...prev, ...toDismiss]));
      toast.success("Cleared read notifications");
    }
  }, [airingItems, readKeys]);

  const unreadCount = useMemo(() => {
    return airingItems.filter((x) => !readKeys.has(x.key)).length;
  }, [airingItems, readKeys]);

  const hasUrgent = useMemo(() => {
    return airingItems.some((x) => x.isWithin3Hours && !readKeys.has(x.key));
  }, [airingItems, readKeys]);

  // Trigger browser notification for urgent items (< 3h)
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      airingItems.forEach((item) => {
        if (
          item.isWithin3Hours &&
          !readKeys.has(item.key) &&
          !notifiedKeysRef.current.has(item.key)
        ) {
          notifiedKeysRef.current.add(item.key);
          new Notification(`Koka Airing Alert 🎬`, {
            body: `${item.entry.media.title} Episode ${item.episode} airs soon (${item.countdownStr})!`,
            icon: item.entry.media.cover ?? undefined,
          });
        }
      });
    }
  }, [airingItems, readKeys]);

  const filteredItems = useMemo(() => {
    return airingItems.filter((item) => {
      if (filterTab === "URGENT") return item.isWithin3Hours;
      if (filterTab === "CURRENT") return item.entry.status === "CURRENT";
      if (filterTab === "PLANNING") return item.entry.status === "PLANNING";
      return true;
    });
  }, [airingItems, filterTab]);

  function markAllRead() {
    const all = new Set([...readKeys, ...airingItems.map((x) => x.key)]);
    setReadKeys(all);
  }

  function toggleRead(key: string) {
    const next = new Set(readKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setReadKeys(next);
  }

  async function requestNotificationPermission() {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        toast.success("Desktop notifications enabled!");
        if (airingItems.length) {
          const item = airingItems[0];
          new Notification("Koka Airing Alerts Active 🎬", {
            body: `You will get desktop alerts when your anime episodes air! Next up: ${item?.entry.media.title ?? "Anime"}`,
            icon: item?.entry.media.cover ?? undefined,
          });
        }
      } else {
        toast.error("Browser notification permission denied.");
      }
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground active:scale-95",
          hasUrgent ? "border-primary/50 text-primary" : "",
        )}
        title="Airing Schedule Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span
            className={cn(
              "absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-primary-foreground",
              hasUrgent ? "animate-pulse bg-destructive" : "bg-primary",
            )}
          >
            {unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          {/* Backdrop overlay for closing */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
          />

          {/* Centered responsive popup on mobile, right-aligned dropdown on desktop */}
          <div className="fixed inset-x-4 top-16 z-50 mx-auto w-auto max-w-sm rounded-2xl border border-border bg-popover p-4 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-none">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-semibold">
                  Airing Schedule
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void refreshSchedules()}
                  disabled={refreshing}
                  className="p-1 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                  title="Sync live schedules with AniList"
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      refreshing ? "animate-spin text-primary" : "",
                    )}
                  />
                </button>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="p-1 text-muted-foreground hover:text-primary transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={clearReadNotifs}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                  title="Clear all read notifications"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="mt-3 flex flex-wrap gap-1">
              {(
                [
                  ["ALL", "All"],
                  ["URGENT", "Airing Soon"],
                  ["CURRENT", "Watching"],
                  ["PLANNING", "Planned"],
                ] as const
              ).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                    filterTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Notification items */}
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {filteredItems.length ? (
                filteredItems.map((item) => {
                  const isRead = readKeys.has(item.key);
                  return (
                    <div
                      key={item.key}
                      onClick={() => toggleRead(item.key)}
                      className={cn(
                        "group relative flex cursor-pointer gap-3 rounded-xl border p-2.5 transition-all duration-200 hover:border-primary/40",
                        isRead
                          ? "border-border/60 bg-secondary/20 opacity-60"
                          : item.isWithin3Hours
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-card",
                      )}
                    >
                      <img
                        src={item.entry.media.cover ?? ""}
                        alt=""
                        className="h-12 w-9 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <Link
                            to="/anime/$id"
                            params={{ id: String(item.id) }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRead(item.key);
                              setIsOpen(false);
                            }}
                            className="line-clamp-1 text-xs font-semibold hover:text-primary"
                          >
                            {item.entry.media.title}
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissItem(item.key);
                            }}
                            className="p-0.5 text-muted-foreground hover:text-destructive transition-colors opacity-70 hover:opacity-100"
                            title="Dismiss notification"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Episode {item.episode} · {item.timeStr}
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.2 text-[10px] font-medium",
                              item.isWithin3Hours
                                ? "bg-destructive/15 text-destructive"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            {item.countdownStr}
                          </span>
                          <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
                            {isRead
                              ? "Read (click to unread)"
                              : "Click to mark read"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                  <Sparkles className="mx-auto h-5 w-5 text-muted-foreground/60" />
                  <p>No upcoming episodes found in your schedule.</p>
                </div>
              )}
            </div>

            {/* Desktop Notification Request */}
            <div className="mt-3 border-t border-border pt-2.5 text-center">
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                <Volume2 className="h-3 w-3" /> Enable Browser Desktop Alerts
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
