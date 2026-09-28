import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Loader2,
  Upload,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Database,
  Check,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { fetchByIds, fetchByMalIds, fetchUserList } from "@/lib/anilist";
import { parseImport, type ImportItem } from "@/lib/importers";
import {
  exportAll,
  useLibrary,
  useMediaMode,
  useNotes,
  useSettings,
} from "@/lib/store";
import {
  downloadFile,
  libraryFile,
  libraryToCsv,
  notesFile,
  stamp,
} from "@/lib/exporters";
import {
  normalizeTags,
  type AnimeMedia,
  type LibraryEntry,
  type MediaType,
  type Note,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "Import & Export Your Anime and Manga Lists — Koka" },
      {
        name: "description",
        content:
          "Import AniList or MyAnimeList JSON and XML exports with notes and dates, sync live from the AniList GraphQL API, or export your library as JSON and CSV.",
      },
      { property: "og:title", content: "Import & Export — Koka" },
      {
        property: "og:description",
        content:
          "AniList & MyAnimeList JSON/XML import with notes and dates, plus JSON/CSV export.",
      },
    ],
  }),
  component: ImportPage,
});

type Mode = "merge" | "replace";

type ReviewAction = "add" | "update" | "delete";

interface FieldDiff {
  label: string;
  before: string;
  after: string;
}

interface ReviewItem {
  key: string;
  action: ReviewAction;
  entry: LibraryEntry;
  mediaType: MediaType;
  incoming?: LibraryEntry;
  incomingNote?: Note;
  diffs: FieldDiff[];
  selected: boolean;
}

const entryKey = (entry: LibraryEntry) =>
  `${entry.media.type === "MANGA" ? "MANGA" : "ANIME"}:${entry.media.id}`;

const showValue = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

function ImportPage() {
  const { mode: mediaMode } = useMediaMode();
  const { mergeMany, library, all, remove } = useLibrary();
  const { notes, setNotes, mergeNotes, removeNote } = useNotes();
  const { settings, update } = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("merge");
  const [log, setLog] = useState<string[]>([]);

  const [review, setReview] = useState<ReviewItem[] | null>(null);
  const [reviewType, setReviewType] = useState<MediaType | "ALL">("ALL");

  const modeNoun = mediaMode === "MANGA" ? "manga" : "anime";

  function say(line: string) {
    setLog((l) => [line, ...l].slice(0, 8));
  }

  function createReview(
    entries: LibraryEntry[],
    incomingNotes: Note[],
    types: MediaType[],
  ) {
    const existingMap = new Map<string, LibraryEntry>();
    for (const e of all) {
      const t = e.media.type === "MANGA" ? "MANGA" : "ANIME";
      existingMap.set(`${t}:${e.media.id}`, e);
      existingMap.set(`${t}-${e.media.id}`, e);
      existingMap.set(`${e.media.id}`, e);
    }

    const preservedEntries = entries.map((entry) => {
      const t = entry.media.type === "MANGA" ? "MANGA" : "ANIME";
      const existing =
        existingMap.get(`${t}:${entry.media.id}`) ??
        existingMap.get(`${t}-${entry.media.id}`) ??
        existingMap.get(`${entry.media.id}`);

      const existingTags = existing?.tags ?? [];
      const incomingTags = entry.tags ?? [];
      const finalTags =
        existingTags.length > 0
          ? normalizeTags([...existingTags, ...incomingTags])
          : normalizeTags(incomingTags);

      const existingLinks = existing?.customLinks ?? [];
      const finalLinks =
        existingLinks.length > 0 ? existingLinks : (entry.customLinks ?? []);

      return {
        ...entry,
        tags: finalTags,
        customLinks: finalLinks,
      };
    });

    const noteMap = new Map(
      incomingNotes.map((note) => [
        `${note.mediaType ?? "ANIME"}:${note.animeId}`,
        note,
      ]),
    );
    const existingNotes = new Map(
      notes.map((note) => [
        `${note.mediaType ?? "ANIME"}:${note.animeId}`,
        note,
      ]),
    );
    const incomingKeys = new Set(preservedEntries.map(entryKey));
    const changes: ReviewItem[] = [];

    for (const incoming of preservedEntries) {
      const key = entryKey(incoming);
      const existing = existingMap.get(key);
      const incomingNote = noteMap.get(key);
      const oldNote = existingNotes.get(key);
      const diffs: FieldDiff[] = [];
      if (existing) {
        const fields: Array<
          [
            string,
            string | number | null | undefined,
            string | number | null | undefined,
          ]
        > = [
          ["Status", existing.status, incoming.status],
          ["Progress", existing.progress, incoming.progress],
          ["Rating", existing.score, incoming.score],
          ["Start date", existing.startedAt, incoming.startedAt],
          ["Finish date", existing.completedAt, incoming.completedAt],
          ["Repeat count", existing.repeat, incoming.repeat],
          [
            "Favourite",
            existing.favorite ? "Yes" : "No",
            incoming.favorite ? "Yes" : "No",
          ],
          [
            "Rewatching",
            existing.isRewatching ? "Yes" : "No",
            incoming.isRewatching ? "Yes" : "No",
          ],
          ["Air date", existing.media.startDate, incoming.media.startDate],
          [
            "Tags",
            (existing.tags ?? []).join(", "),
            (incoming.tags ?? []).join(", "),
          ],
        ];
        for (const [label, before, after] of fields) {
          if (before !== after)
            diffs.push({
              label,
              before: showValue(before),
              after: showValue(after),
            });
        }
      }
      if (incomingNote && oldNote?.body !== incomingNote.body) {
        diffs.push({
          label: "Notes",
          before: showValue(oldNote?.body),
          after: showValue(incomingNote.body),
        });
      }
      if (!existing || diffs.length) {
        changes.push({
          key,
          action: existing ? "update" : "add",
          entry: existing ?? incoming,
          mediaType: incoming.media.type === "MANGA" ? "MANGA" : "ANIME",
          incoming,
          incomingNote,
          diffs,
          selected: true,
        });
      }
    }
    return changes;
  }

    for (const existing of all) {
      const key = entryKey(existing);
      if (
        !types.includes(existing.media.type === "MANGA" ? "MANGA" : "ANIME") ||
        incomingKeys.has(key)
      )
        continue;
      changes.push({
        key,
        action: "delete",
        entry: existing,
        mediaType: existing.media.type === "MANGA" ? "MANGA" : "ANIME",
        diffs: [],
        // Merge retains unmatched entries; replace retains the old default of removing them.
        selected: mode === "replace",
      });
    }
    return changes;
  }

  function confirmReview() {
    if (!review) return;
    const selected = review.filter((item) => item.selected);
    const upserts = selected.flatMap((item) =>
      item.incoming ? [item.incoming] : [],
    );
    const incomingNotes = selected.flatMap((item) =>
      item.incomingNote ? [item.incomingNote] : [],
    );
    const deletions = selected.filter((item) => item.action === "delete");
    mergeMany(upserts);
    if (incomingNotes.length) mergeNotes(incomingNotes);
    for (const item of deletions) {
      remove(item.entry.media.id, item.mediaType);
      if (
        notes.some(
          (note) => `${note.mediaType ?? "ANIME"}:${note.animeId}` === item.key,
        )
      ) {
        removeNote(item.entry.media.id, item.mediaType);
      }
    }
    setReview(null);
    say(
      `Synced ${upserts.length} selected changes${deletions.length ? ` and deleted ${deletions.length} entries` : ""}`,
    );
    toast.success(`Synced ${selected.length} selected changes`);
  }

  const visibleReview = useMemo(
    () =>
      (review ?? []).filter(
        (item) => reviewType === "ALL" || item.mediaType === reviewType,
      ),
    [review, reviewType],
  );

  /** Resolve AniList metadata for parsed items of one media type. */
  async function resolve(items: ImportItem[], type: MediaType) {
    const withAl = items.filter((i) => i.anilistId);
    const onlyMal = items.filter((i) => !i.anilistId && i.malId);
    const media: AnimeMedia[] = [
      ...(withAl.length
        ? await fetchByIds(
            withAl.map((i) => i.anilistId!),
            type,
          )
        : []),
      ...(onlyMal.length
        ? await fetchByMalIds(
            onlyMal.map((i) => i.malId!),
            type,
          )
        : []),
    ];
    return media;
  }

  async function handleFile(file: File) {
    setBusy("file");
    try {
      const parsed = parseImport(await file.text());

      if (parsed.backup) {
        setReviewType("ALL");
        setReview(
          createReview(parsed.backup.library, parsed.backup.notes, [
            "ANIME",
            "MANGA",
          ]),
        );
        say(`${parsed.source}: review ready`);
        return;
      }

      say(`${parsed.source}: ${parsed.items.length} entries found`);

      const types = [
        ...new Set(parsed.items.map((i) => i.mediaType)),
      ] as MediaType[];
      const media: AnimeMedia[] = [];
      for (const type of types) {
        media.push(
          ...(await resolve(
            parsed.items.filter((i) => i.mediaType === type),
            type,
          )),
        );
      }

      const byAl = new Map(media.map((m) => [`${m.type}-${m.id}`, m]));
      const byMal = new Map(
        media.filter((m) => m.malId).map((m) => [`${m.type}-${m.malId}`, m]),
      );
      const now = Date.now();

      const entries: LibraryEntry[] = [];
      const imported: Note[] = [];

      for (const item of parsed.items) {
        const m =
          (item.anilistId
            ? byAl.get(`${item.mediaType}-${item.anilistId}`)
            : undefined) ??
          (item.malId
            ? byMal.get(`${item.mediaType}-${item.malId}`)
            : undefined);
        if (!m) continue;
        entries.push({
          media: m,
          status: item.status,
          progress: item.progress,
          score: item.score ?? null,
          startedAt: item.startedAt ?? null,
          completedAt: item.completedAt ?? null,
          repeat: item.repeat ?? null,
          updatedAt: now,
          addedAt: now,
        });
        if (item.notes) {
          imported.push({
            animeId: m.id,
            mediaType: m.type ?? "ANIME",
            title: m.title,
            body: item.notes,
            tags: ["imported"],
            updatedAt: now,
          });
        }
      }

      setReviewType("ALL");
      setReview(
        createReview(entries, imported, types.length ? types : ["ANIME"]),
      );
      say(`${parsed.source}: review ready for ${entries.length} titles`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Import failed";
      say(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function syncAniList() {
    if (!settings.anilistUser.trim()) {
      toast.error("Enter your AniList username first");
      return;
    }
    setBusy("api");
    try {
      const user = settings.anilistUser.trim();
      const anime = await fetchUserList(user, "ANIME");
      let manga: { entries: LibraryEntry[]; notes: Note[] } = {
        entries: [],
        notes: [],
      };
      try {
        manga = await fetchUserList(user, "MANGA");
      } catch {
        /* a user may have no manga list */
      }

      const entries = [...anime.entries, ...manga.entries];
      const listNotes = [...anime.notes, ...manga.notes];
      setReviewType("ALL");
      setReview(createReview(entries, listNotes, ["ANIME", "MANGA"]));
      say(
        `AniList review ready (${anime.entries.length} anime, ${manga.entries.length} manga)`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sync failed";
      say(`Error: ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function refreshMetadata() {
    setBusy("refresh");
    try {
      const media = await fetchByIds(
        library.map((e) => e.media.id),
        mediaMode,
      );
      const map = new Map(media.map((m) => [m.id, m]));
      mergeMany(
        library.map((e) => ({ ...e, media: map.get(e.media.id) ?? e.media })),
      );
      say(`Refreshed ${modeNoun} metadata`);
      toast.success("Metadata refreshed");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Import & export"
        subtitle="AniList and MyAnimeList data — JSON or XML, notes and dates included."
      />

      <section className="panel mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium">Import behaviour</p>
          <p className="text-xs text-muted-foreground">
            {mode === "merge"
              ? "Merge keeps titles that aren't in the file and appends imported notes."
              : "Replace wipes the lists and notes for the media types in the file first."}
          </p>
        </div>
        <div className="flex rounded-full border border-border p-0.5">
          {(["merge", "replace"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-3 py-1 text-xs capitalize transition-all duration-200 active:scale-95",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">
            File import (JSON or XML)
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            AniList exports, MyAnimeList JSON, MAL/AniList XML exports
            (including mal-exporter output), a Koka library file or a full Koka
            backup. Anime and manga entries are detected automatically; list
            notes, start/finish dates, decimal scores and rewatch counts come
            along.
          </p>
          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-8 transition-all duration-200 hover:border-primary hover:bg-secondary/40">
            {busy === "file" ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Upload className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {busy === "file" ? "Importing…" : "Choose a .json or .xml file"}
            </span>
            <input
              type="file"
              accept=".json,.xml,application/json,application/xml,text/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">
            AniList GraphQL sync
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pull your public anime and manga lists live from the AniList API —
            notes, decimal scores, dates and rewatches included. No login
            needed.
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="user">AniList username</Label>
            <Input
              id="user"
              value={settings.anilistUser}
              onChange={(e) => update({ anilistUser: e.target.value })}
              placeholder="e.g. kokaneko"
            />
            <Button
              className="w-full"
              onClick={syncAniList}
              disabled={busy !== null || review !== null}
            >
              {busy === "api" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {mode === "replace"
                ? "Replace list from AniList"
                : "Sync from AniList"}
            </Button>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">
            Export your data
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Library and CSV exports cover the {modeNoun} side you're viewing;
            the full backup contains everything.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!library.length}
              onClick={() => {
                downloadFile(
                  `koka-${modeNoun}-${stamp()}.json`,
                  JSON.stringify(libraryFile(library), null, 2),
                  "application/json",
                );
                toast.success("Library exported");
              }}
            >
              <Download className="h-3.5 w-3.5" /> Library JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!library.length}
              onClick={() => {
                downloadFile(
                  `koka-${modeNoun}-${stamp()}.csv`,
                  libraryToCsv(library),
                  "text/csv",
                );
                toast.success("CSV exported");
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Library CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!notes.length}
              onClick={() => {
                downloadFile(
                  `koka-notes-${stamp()}.json`,
                  JSON.stringify(notesFile(notes), null, 2),
                  "application/json",
                );
                toast.success("Notes exported");
              }}
            >
              <Download className="h-3.5 w-3.5" /> Notes JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadFile(
                  `koka-backup-${stamp()}.json`,
                  JSON.stringify(exportAll(), null, 2),
                  "application/json",
                );
                toast.success("Backup exported");
              }}
            >
              <Database className="h-3.5 w-3.5" /> Full backup
            </Button>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-display text-sm font-semibold">Maintenance</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Refresh schedules and public scores for the {modeNoun} list, or
            clear notes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshMetadata}
              disabled={busy !== null || library.length === 0}
            >
              {busy === "refresh" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh metadata
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!notes.length}
              onClick={() => {
                if (!confirm("Delete all notes? Export them first.")) return;
                setNotes([]);
                toast.success("Notes cleared");
              }}
            >
              Clear notes
            </Button>
          </div>
        </section>

        <section className="panel p-5 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold">Activity</h2>
          {log.length ? (
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {log.map((l, i) => (
                <li
                  key={i}
                  className="animate-in fade-in-0 slide-in-from-top-1"
                >
                  · {l}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Import results will appear here.
            </p>
          )}
        </section>
      </div>

      <Dialog
        open={review !== null}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden border-border bg-background p-0">
          <DialogHeader className="border-b border-border px-5 pb-4 pt-5 sm:px-6">
            <DialogTitle className="font-display">
              Review sync changes
            </DialogTitle>
            <DialogDescription>
              Nothing is saved until you confirm. Select only the additions,
              updates, and deletions you want to apply.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-1 border-b border-border px-5 py-3 sm:px-6">
            {(["ALL", "ANIME", "MANGA"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setReviewType(type)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  reviewType === type
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {type === "ALL" ? "All" : type === "ANIME" ? "Anime" : "Manga"}
              </button>
            ))}
          </div>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto px-5 py-4 sm:px-6">
            {visibleReview.length ? (
              visibleReview.map((item) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer gap-3 rounded-lg border border-border bg-secondary/20 p-3 transition-colors hover:bg-secondary/45"
                >
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={(checked) =>
                      setReview(
                        (items) =>
                          items?.map((candidate) =>
                            candidate.key === item.key
                              ? { ...candidate, selected: checked === true }
                              : candidate,
                          ) ?? null,
                      )
                    }
                    aria-label={`Include ${item.entry.media.title} in sync`}
                  />
                  {item.entry.media.cover ? (
                    <img
                      src={item.entry.media.cover}
                      alt=""
                      className="h-12 w-9 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-9 rounded bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {item.entry.media.title}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          item.action === "delete"
                            ? "bg-destructive/15 text-destructive"
                            : item.action === "add"
                              ? "bg-green-500/15 text-green-500"
                              : "bg-primary/15 text-primary",
                        )}
                      >
                        {item.action}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {item.mediaType}
                      </span>
                    </div>
                    {item.action === "delete" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Not present in the incoming list. Select to remove it.
                      </p>
                    ) : item.action === "add" ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        New entry: {item.incoming?.status} · progress{" "}
                        {item.incoming?.progress}
                      </p>
                    ) : (
                      <dl className="mt-2 space-y-1 text-xs">
                        {item.diffs.map((diff) => (
                          <div
                            key={diff.label}
                            className="grid grid-cols-[5.5rem_1fr] gap-2"
                          >
                            <dt className="text-muted-foreground">
                              {diff.label}
                            </dt>
                            <dd className="min-w-0 break-words">
                              <span className="text-destructive/80 line-through">
                                {diff.before}
                              </span>
                              <span className="mx-1.5 text-muted-foreground">
                                →
                              </span>
                              <span className="text-green-500">
                                {diff.after}
                              </span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </label>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No changes for this media type.
              </p>
            )}
          </div>
          <DialogFooter className="border-t border-border px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setReview(null)}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button
              onClick={confirmReview}
              disabled={!review?.some((item) => item.selected)}
            >
              <Check className="h-4 w-4" /> Confirm selected changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
