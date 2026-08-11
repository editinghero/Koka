import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Loader2,
  Upload,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Database,
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

function ImportPage() {
  const { mode: mediaMode } = useMediaMode();
  const { mergeMany, replaceMany, library } = useLibrary();
  const { notes, setNotes, mergeNotes, replaceNotes } = useNotes();
  const { settings, update } = useSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("merge");
  const [log, setLog] = useState<string[]>([]);

  const modeNoun = mediaMode === "MANGA" ? "manga" : "anime";

  function say(line: string) {
    setLog((l) => [line, ...l].slice(0, 8));
  }

  function apply(
    entries: LibraryEntry[],
    incomingNotes: Note[],
    types: MediaType[],
  ) {
    const existingTagsMap = new Map(
      library.map((e) => [
        `${e.media.type ?? "ANIME"}-${e.media.id}`,
        e.tags ?? [],
      ]),
    );

    const preservedEntries = entries.map((entry) => {
      const typeKey = entry.media.type ?? "ANIME";
      const key = `${typeKey}-${entry.media.id}`;
      const existingTags = existingTagsMap.get(key) ?? [];
      return {
        ...entry,
        tags: normalizeTags([...existingTags, ...(entry.tags ?? [])]),
      };
    });

    if (mode === "replace") {
      replaceMany(preservedEntries, types);
      replaceNotes(incomingNotes, types);
    } else {
      mergeMany(preservedEntries);
      if (incomingNotes.length) mergeNotes(incomingNotes);
    }
  }

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
        const types: MediaType[] = ["ANIME", "MANGA"];
        apply(parsed.backup.library, parsed.backup.notes, types);
        say(
          `${parsed.source} (${mode}): ${parsed.backup.library.length} titles, ${parsed.backup.notes.length} notes`,
        );
        toast.success(mode === "replace" ? "Data replaced" : "Restored");
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

      apply(entries, imported, types.length ? types : ["ANIME"]);
      say(
        `${mode === "replace" ? "Replaced with" : "Imported"} ${entries.length} titles${
          imported.length ? ` and ${imported.length} notes` : ""
        }`,
      );
      toast.success(`${entries.length} titles imported`);
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
      apply(entries, listNotes, ["ANIME", "MANGA"]);
      say(
        `${mode === "replace" ? "Replaced list with" : "Synced"} ${entries.length} titles${
          listNotes.length ? ` and ${listNotes.length} list notes` : ""
        } from AniList (${anime.entries.length} anime, ${manga.entries.length} manga)`,
      );
      toast.success(`Synced ${entries.length} titles`);
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
              disabled={busy !== null}
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
    </>
  );
}
