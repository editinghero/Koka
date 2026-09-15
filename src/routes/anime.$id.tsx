import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Edit3,
  ExternalLink,
  Minus,
  Play,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { Cover, countdown } from "@/components/AnimeCard";
import { AiPanel } from "@/components/AiPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { NoteEditor } from "@/components/NoteEditor";
import { fetchByIds } from "@/lib/anilist";
import { useLibrary, useMediaMode, useNotes } from "@/lib/store";
import {
  MODE_COPY,
  STATUS_ORDER,
  statusLabel,
  totalUnits,
  type CustomLink,
  type LibraryEntry,
  type WatchStatus,
} from "@/lib/types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/anime/$id")({
  head: () => ({
    meta: [
      { title: "Title details — Koka" },
      {
        name: "description",
        content:
          "Track progress, update scores, write notes and ask AI about this title.",
      },
      { property: "og:title", content: "Title details — Koka" },
      {
        property: "og:description",
        content:
          "Progress tracking, markdown notes and spoiler-free AI summaries per title.",
      },
    ],
  }),
  component: AnimeDetail,
});

function AnimeDetail() {
  const { id } = Route.useParams();
  const animeId = Number(id);
  const { mode } = useMediaMode();
  const copy = MODE_COPY[mode];
  const { library, upsert, patch, remove } = useLibrary();
  const { notes } = useNotes();
  const note = notes.find((n) => n.animeId === animeId);
  const entry = library.find((e) => e.media.id === animeId);
  const [isEditing, setIsEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["media", mode, animeId],
    queryFn: async () => (await fetchByIds([animeId], mode))[0] ?? null,
    enabled: !entry,
    staleTime: 1000 * 60 * 30,
  });

  const media = entry?.media ?? data ?? null;

  if (!media) {
    return (
      <p className="panel p-8 text-center text-sm text-muted-foreground">
        {isLoading ? "Loading title…" : `Couldn't find that ${copy.noun}.`}
      </p>
    );
  }

  const progress = entry?.progress ?? 0;
  const total = totalUnits(media);

  function ensureEntry(): LibraryEntry {
    if (entry) return entry;
    const newEntry: LibraryEntry = {
      media: { ...media!, type: mode },
      status: "PLANNING",
      progress: 0,
      score: null,
      startedAt: null,
      completedAt: null,
      repeat: 0,
      isRewatching: false,
      customLinks: [],
      tags: [],
      updatedAt: Date.now(),
      addedAt: Date.now(),
    };
    upsert(newEntry);
    return newEntry;
  }

  function updateField<K extends keyof LibraryEntry>(
    key: K,
    val: LibraryEntry[K],
  ) {
    if (!media) return;
    if (!entry) {
      const fresh = ensureEntry();
      upsert({ ...fresh, [key]: val, updatedAt: Date.now() });
    } else {
      patch(media.id, { [key]: val });
    }
  }

  function setStatus(status: WatchStatus) {
    if (!media) return;
    if (entry) patch(media.id, { status });
    else
      upsert({
        media: { ...media, type: mode },
        status,
        progress: 0,
        score: null,
        startedAt: null,
        completedAt: null,
        repeat: 0,
        isRewatching: false,
        customLinks: [],
        tags: [],
        updatedAt: Date.now(),
        addedAt: Date.now(),
      });
  }

  function bump(delta: number) {
    if (!media) return;
    const next = Math.max(0, progress + delta);
    if (entry) patch(media.id, { progress: next });
    else
      upsert({
        media: { ...media, type: mode },
        status: "CURRENT",
        progress: next,
        score: null,
        startedAt: null,
        completedAt: null,
        repeat: 0,
        isRewatching: false,
        customLinks: [],
        tags: [],
        updatedAt: Date.now(),
        addedAt: Date.now(),
      });
  }

  function addLink() {
    const current = entry?.customLinks ?? [];
    const isFirst = current.length === 0;
    const next: CustomLink[] = [
      ...current,
      { label: "", url: "", isPrimary: isFirst },
    ];
    updateField("customLinks", next);
  }

  function updateLink(index: number, patchData: Partial<CustomLink>) {
    const current = [...(entry?.customLinks ?? [])];
    if (!current[index]) return;
    current[index] = { ...current[index], ...patchData };
    updateField("customLinks", current);
  }

  function togglePrimaryLink(index: number) {
    const current = [...(entry?.customLinks ?? [])];
    if (!current[index]) return;
    const targetNewPrimary = !current[index].isPrimary;
    const next = current.map((l, i) => ({
      ...l,
      isPrimary: i === index ? targetNewPrimary : false,
    }));
    updateField("customLinks", next);
  }

  function removeLink(index: number) {
    const current = [...(entry?.customLinks ?? [])];
    const wasPrimary = current[index]?.isPrimary;
    current.splice(index, 1);
    if (wasPrimary && current.length > 0) {
      current[0].isPrimary = true;
    }
    updateField("customLinks", current);
  }

  const primaryLink =
    (entry?.customLinks ?? []).find((l) => l.isPrimary && l.url.trim()) ??
    (entry?.customLinks ?? []).find((l) => l.url.trim()) ??
    null;

  return (
    <div className="animate-in duration-150 fade-in-0">
      <Link
        to="/library"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to library
      </Link>

      <div className="panel relative overflow-hidden">
        {/* Banner with top-right Edit button */}
        <div className="relative h-32 w-full bg-surface-2 md:h-44">
          {media.banner ? (
            <img
              src={media.banner}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-surface to-surface-2" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-black/40" />

          {/* Top-right Edit/Done toggle button */}
          <div className="absolute right-3 top-3 z-10">
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md backdrop-blur-md transition-all duration-150 active:scale-95 ${
                isEditing
                  ? "border border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-border/80 bg-surface/90 text-foreground hover:bg-surface"
              }`}
            >
              {isEditing ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-5 sm:flex-row">
          <Cover media={media} className="h-44 w-32 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold md:text-2xl">
              {media.title}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[
                media.titleNative,
                media.format,
                media.seasonYear ? `${media.season} ${media.seasonYear}` : null,
                total ? `${total} ${copy.unit}` : null,
                media.volumes ? `${media.volumes} volumes` : null,
                media.studios?.[0],
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {media.genres?.slice(0, 6).map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {g}
                </span>
              ))}
            </div>

            {media.nextEpisode ? (
              <p className="mt-3 text-xs text-primary">
                Episode {media.nextEpisode.episode} in{" "}
                {countdown(media.nextEpisode.airingAt)}
              </p>
            ) : null}

            {/* PREVIEW MODE (Default) */}
            {!isEditing ? (
              <div className="mt-4 space-y-4">
                {/* Status pill & rewatching badge */}
                <div className="flex flex-wrap items-center gap-2">
                  {entry?.status ? (
                    <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                      {statusLabel(entry.status, mode)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        ensureEntry();
                        setIsEditing(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground active:scale-95"
                    >
                      + Add to library
                    </button>
                  )}
                  {entry?.isRewatching ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-500">
                      <RefreshCw className="h-3 w-3" />
                      {mode === "MANGA" ? "Rereading" : "Rewatching"}
                    </span>
                  ) : null}
                </div>

                {/* Progress & Play Button: Progress is the only editable control in preview mode */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 active:scale-95"
                      onClick={() => bump(-1)}
                      aria-label="Decrease progress"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-sm font-semibold tabular-nums">
                      {progress}/{total ?? "?"}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 active:scale-95"
                      onClick={() => bump(1)}
                      aria-label="Increase progress"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Play Button: displayed if custom link exists */}
                  {primaryLink ? (
                    <a
                      href={primaryLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-95"
                      title={`Open ${primaryLink.url}`}
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>
                        {primaryLink.label.trim()
                          ? primaryLink.label
                          : mode === "MANGA"
                            ? "Read"
                            : "Play"}
                      </span>
                    </a>
                  ) : null}

                  {/* Read-only Score */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Score:</span>
                    <span className="font-semibold text-primary">
                      {entry?.score != null ? `${entry.score}/10` : "—"}
                    </span>
                  </div>

                  {media.siteUrl ? (
                    <a
                      href={media.siteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      AniList <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>

                {/* Read-only details list */}
                <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Public score</dt>
                    <dd className="font-medium">
                      {media.averageScore ? `${media.averageScore}%` : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Started</dt>
                    <dd className="font-medium">{entry?.startedAt || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Finished</dt>
                    <dd className="font-medium">{entry?.completedAt || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {mode === "MANGA" ? "Rereads" : "Rewatches"}
                    </dt>
                    <dd className="font-medium">{entry?.repeat ?? 0}</dd>
                  </div>
                </dl>

                {/* Read-only custom tags */}
                {entry?.tags && entry.tags.length > 0 ? (
                  <div className="border-t border-border pt-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Tags:
                    </span>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {entry.tags.map((t) => {
                        const tagLower = t.trim().toLowerCase();
                        return (
                          <Link
                            key={tagLower}
                            to="/library"
                            search={(prev: Record<string, unknown>) => ({
                              ...prev,
                              search: `#${tagLower}`,
                            })}
                            className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary transition-colors hover:bg-primary/20 active:scale-95"
                          >
                            #{tagLower}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              /* EDIT MODE */
              <div className="mt-4 space-y-4 rounded-xl border border-border/80 bg-surface/50 p-4">
                {/* Status selector */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {STATUS_ORDER.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 active:scale-95 ${
                          entry?.status === s
                            ? "border-primary bg-primary font-semibold text-primary-foreground"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {statusLabel(s, mode)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress, Score, and Remove */}
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Progress
                    </label>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 active:scale-95"
                        onClick={() => bump(-1)}
                        aria-label="Decrease progress"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <input
                        type="number"
                        min={0}
                        max={total ?? 9999}
                        value={progress}
                        onChange={(e) => {
                          const val = Math.max(
                            0,
                            parseInt(e.target.value, 10) || 0,
                          );
                          updateField("progress", val);
                        }}
                        className="h-8 w-16 rounded-md border border-border bg-surface px-2 text-center text-xs font-semibold tabular-nums focus:border-primary focus:outline-none"
                      />
                      <span className="text-xs text-muted-foreground">
                        / {total ?? "?"}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 active:scale-95"
                        onClick={() => bump(1)}
                        aria-label="Increase progress"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Score
                    </label>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={0.1}
                        value={entry?.score ?? ""}
                        placeholder="—"
                        onChange={(e) => {
                          const v = e.target.value;
                          updateField(
                            "score",
                            v === ""
                              ? null
                              : Math.min(10, Math.max(0, Number(v))),
                          );
                        }}
                        className="h-8 w-16 rounded-md border border-border bg-surface px-2 text-center text-xs font-semibold focus:border-primary focus:outline-none"
                      />
                      <span className="text-xs text-muted-foreground">/ 10</span>
                    </div>
                  </div>

                  {entry ? (
                    <div className="self-end pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          remove(media.id);
                          setIsEditing(false);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive active:scale-95"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove from library
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* Dates & Rewatching */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={entry?.startedAt?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        updateField("startedAt", e.target.value || null)
                      }
                      className="mt-1.5 block h-8 w-full rounded-md border border-border bg-surface px-2 text-xs focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Finish Date
                    </label>
                    <input
                      type="date"
                      value={entry?.completedAt?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        updateField("completedAt", e.target.value || null)
                      }
                      className="mt-1.5 block h-8 w-full rounded-md border border-border bg-surface px-2 text-xs focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {mode === "MANGA" ? "Rereads" : "Rewatches"}
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={entry?.repeat ?? 0}
                        onChange={(e) =>
                          updateField(
                            "repeat",
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        className="h-8 w-16 rounded-md border border-border bg-surface px-2 text-center text-xs focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateField("isRewatching", !entry?.isRewatching)
                        }
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                          entry?.isRewatching
                            ? "border-amber-500/40 bg-amber-500/20 font-semibold text-amber-500"
                            : "border-border bg-surface text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <RefreshCw className="h-3 w-3" />
                        {entry?.isRewatching
                          ? mode === "MANGA"
                            ? "Rereading"
                            : "Rewatching"
                          : `Mark ${mode === "MANGA" ? "Rereading" : "Rewatching"}`}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom Links Section (Feature 3) */}
                <div className="border-t border-border/80 pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-foreground">
                        Custom Links
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        Add streaming or platform links. Star one link to set it as
                        primary for the Play button.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addLink}
                      className="h-7 text-xs active:scale-95"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add link
                    </Button>
                  </div>

                  <div className="mt-2 space-y-2">
                    {(entry?.customLinks ?? []).length === 0 ? (
                      <p className="py-2 text-xs italic text-muted-foreground">
                        No custom links added yet. Click &quot;Add link&quot; above.
                      </p>
                    ) : (
                      (entry?.customLinks ?? []).map((link, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2"
                        >
                          <input
                            type="text"
                            value={link.label}
                            placeholder="Label (e.g. S1, Dub)"
                            onChange={(e) =>
                              updateLink(idx, { label: e.target.value })
                            }
                            className="h-7 w-28 shrink-0 rounded border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none"
                          />
                          <input
                            type="url"
                            value={link.url}
                            placeholder="https://..."
                            onChange={(e) =>
                              updateLink(idx, { url: e.target.value })
                            }
                            className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => togglePrimaryLink(idx)}
                            className={`rounded p-1.5 transition-all active:scale-95 ${
                              link.isPrimary
                                ? "bg-amber-500/20 text-amber-500"
                                : "text-muted-foreground hover:text-amber-500"
                            }`}
                            title={
                              link.isPrimary
                                ? "Primary link (starred)"
                                : "Mark as primary link"
                            }
                          >
                            <Star
                              className={`h-4 w-4 ${
                                link.isPrimary
                                  ? "fill-amber-400 text-amber-400"
                                  : ""
                              }`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLink(idx)}
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive active:scale-95"
                            title="Remove link"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Custom Tags Section */}
                <div className="border-t border-border/80 pt-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Custom Tags:
                  </span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {(entry?.tags ?? []).map((t) => {
                      const tagLower = t.trim().toLowerCase();
                      return (
                        <span
                          key={tagLower}
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
                        >
                          #{tagLower}
                          <button
                            type="button"
                            onClick={() => {
                              const nextTags = (entry?.tags ?? []).filter(
                                (tag) => tag.trim().toLowerCase() !== tagLower,
                              );
                              updateField("tags", nextTags);
                            }}
                            className="ml-0.5 text-primary/70 transition-colors hover:text-destructive active:scale-95"
                            title="Remove tag"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                    <TagAdder
                      allTags={Array.from(
                        new Set(
                          library
                            .flatMap((e) => e.tags ?? [])
                            .map((t) => t.trim().toLowerCase()),
                        ),
                      )}
                      onAdd={(newTag) => {
                        const clean = newTag
                          .trim()
                          .toLowerCase()
                          .replace(/^#/, "");
                        if (!clean) return;
                        const current = (entry?.tags ?? []).map((t) =>
                          t.trim().toLowerCase(),
                        );
                        if (!current.includes(clean)) {
                          updateField("tags", [...current, clean]);
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Done Button */}
                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="h-8 w-full text-xs font-semibold active:scale-95"
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Done Editing
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <ChatPanel
          animeId={media.id}
          title={`Ask about ${media.title}`}
          description="Toggle spoilers on when you want the full picture, or toggle notes to include your personal notes."
          compact
          notesContext={note?.body}
          context={`The user is asking about the ${copy.noun} "${media.title}"${
            media.seasonYear ? ` (${media.season} ${media.seasonYear})` : ""
          }. Genres: ${media.genres?.join(", ") || "unknown"}. Their progress: ${progress}/${
            total ?? "?"
          } ${copy.unit}${entry?.score ? `, their score ${entry.score}/10` : ""}.`}
          suggestions={[
            "Is it worth finishing?",
            mode === "MANGA"
              ? "How does the anime adaptation compare?"
              : "How faithful is it to the source?",
            `What should I ${copy.verb} after this?`,
          ]}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AiPanel
          title="Where was I? (AI Story Recap)"
          description={`Spoiler-free recap strictly up to your progress (${progress}/${total ?? "?"} ${copy.unit}).`}
          label="Generate Recap"
          spoilerFree
          prompt={() =>
            `The user is currently at ${copy.noun} progress ${progress}/${total ?? "?"} ${copy.unit} for "${media.title}". Provide a concise 3-4 sentence story recap of key events that occurred up to ${copy.unit} ${progress}. CRITICAL: Do NOT spoil anything beyond ${copy.unit} ${progress}. Keep it clean and spoiler-free.`
          }
        />
        <AiPanel
          title="Spoiler-free plot summary"
          description="Premise, tone and setting only — no characters, no twists."
          label="Summarise"
          prompt={() =>
            `Write a spoiler-free markdown summary of the ${copy.noun} "${media.title}" (${media.seasonYear ?? ""}). Sections: Premise (3-4 sentences), Tone & style, Themes, Who it's for. Do not name or describe any characters. Do not reveal any plot developments beyond the opening setup.`
          }
        />
        <AiPanel
          title="Latest news"
          description="Recent announcements about this title."
          label="Fetch news"
          search
          spoilerFree={false}
          prompt={() =>
            `Search the web for news from the last 30 days about the ${copy.noun} "${media.title}". Return short markdown bullets with bold dates. If there is nothing, say so plainly.`
          }
        />
        <AiPanel
          title={mode === "MANGA" ? "Reading guide" : "Watch guide"}
          description={
            mode === "MANGA"
              ? "Reading order, arcs, volumes and where the anime catches up."
              : "Order, adaptations, filler and where the season ends."
          }
          label="Build guide"
          search
          prompt={() =>
            mode === "MANGA"
              ? `Create an accurate, spoiler-free reading guide for the manga "${media.title}" (${media.volumes ? `${media.volumes} volumes` : ""}, ${media.chapters ? `${media.chapters} chapters` : ""}, status: ${media.airingStatus ?? "unknown"}). Search and verify real-world publication history. Include recommended reading order, canon spin-offs (if any), arc/volume milestones, and where any anime adaptation begins or ends. Markdown table where helpful. Do not hallucinate non-existent sequels. No plot spoilers.`
              : `Create an accurate, spoiler-free watch guide for the anime "${media.title}" (Format: ${media.format ?? "TV"}, Episodes: ${total ?? "unknown"}, Release Year: ${media.seasonYear ?? "unknown"}, Status: ${media.airingStatus ?? "unknown"}). CRITICAL: Search and verify the exact real-world franchise history. If this title has only 1 season or is standalone, state clearly that it is a single-season / standalone release and do NOT fabricate extra seasons. If multiple seasons, movies, or OVAs officially exist, provide the chronological vs release watch order, filler episodes to skip, and source material continuation. Markdown table where helpful. No plot spoilers.`
          }
        />
        <AiPanel
          title="Similar titles"
          description={`What to ${copy.verb} if you liked this (from across all anime & web).`}
          label="Find similar"
          search
          prompt={() =>
            `Recommend 5 standout ${copy.nounPlural} from across the entire anime/manga universe and web (explore beyond any specific list — include both well-known classics and hidden gems) that share similar themes, tone, vibe, or plot premise with "${media.title}" (genres: ${media.genres?.join(", ") || "unknown"}). For each recommendation, provide the title in bold (e.g. **Title**) and a 1-2 sentence spoiler-free explanation of why fans of "${media.title}" will enjoy it.`
          }
        />
      </div>

      {media.description ? (
        <section className="panel mt-4 p-5">
          <h2 className="font-display text-sm font-semibold">Synopsis</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {media.description}
          </p>
        </section>
      ) : null}

      <div className="mt-6">
        <h2 className="mb-3 font-display text-lg font-semibold">Your notes</h2>
        <NoteEditor animeId={media.id} title={media.title} mediaType={mode} />
      </div>
    </div>
  );
}

function TagAdder({
  onAdd,
  allTags = [],
}: {
  onAdd: (tag: string) => void;
  allTags?: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [tag, setTag] = useState("");

  function submit() {
    const trimmed = tag.trim().toLowerCase().replace(/^#/, "");
    if (trimmed) {
      onAdd(trimmed);
      setTag("");
    }
    setAdding(false);
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
      >
        + Add tag
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-1"
    >
      <input
        autoFocus
        list="tag-suggestions"
        value={tag}
        onChange={(e) => setTag(e.target.value.toLowerCase())}
        placeholder="e.g. ecchi, fav"
        className="h-6 w-28 rounded-full border border-border bg-surface px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
        onBlur={submit}
      />
      {allTags.length > 0 ? (
        <datalist id="tag-suggestions">
          {allTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      ) : null}
    </form>
  );
}
