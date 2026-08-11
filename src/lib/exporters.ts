import type { LibraryEntry, Note } from "./types";

/* ---------------- library-only JSON ---------------- */

export type LibraryFile = {
  kind: "koka-library";
  version: 1;
  exportedAt: string;
  count: number;
  library: LibraryEntry[];
};

export function libraryFile(library: LibraryEntry[]): LibraryFile {
  return {
    kind: "koka-library",
    version: 1,
    exportedAt: new Date().toISOString(),
    count: library.length,
    library,
  };
}

export function notesFile(notes: Note[]) {
  return {
    kind: "koka-notes",
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
  };
}

/* ---------------- CSV ---------------- */

const CSV_COLUMNS = [
  "anilist_id",
  "mal_id",
  "media_type",
  "title",
  "status",
  "progress",
  "episodes",
  "chapters",
  "my_score",
  "public_score",
  "started_at",
  "completed_at",
  "rewatches",
  "genres",
  "studios",
] as const;

function cell(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function libraryToCsv(library: LibraryEntry[]): string {
  const rows = library.map((e) =>
    [
      e.media.id,
      e.media.malId ?? "",
      e.media.type ?? "ANIME",
      e.media.title,
      e.status,
      e.progress,
      e.media.episodes ?? "",
      e.media.chapters ?? "",
      e.score ?? "",
      e.media.averageScore ?? "",
      e.startedAt ?? "",
      e.completedAt ?? "",
      e.repeat ?? "",
      (e.media.genres ?? []).join("|"),
      (e.media.studios ?? []).join("|"),
    ]
      .map(cell)
      .join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\n");
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function stamp() {
  return new Date().toISOString().slice(0, 10);
}
