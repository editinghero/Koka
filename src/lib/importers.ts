import type { LibraryEntry, MediaType, Note, WatchStatus } from "./types";

export type ImportItem = {
  anilistId?: number | undefined;
  malId?: number | undefined;
  mediaType: MediaType;
  title: string;
  status: WatchStatus;
  progress: number;
  score?: number | null;
  notes?: string | undefined;
  startedAt?: string | undefined;
  completedAt?: string | undefined;
  repeat?: number | undefined;
};

export type ParsedImport = {
  source: string;
  items: ImportItem[];
  backup?: { library: LibraryEntry[]; notes: Note[] };
};

const MAL_STATUS: Record<string, WatchStatus> = {
  watching: "CURRENT",
  reading: "CURRENT",
  completed: "COMPLETED",
  on_hold: "PAUSED",
  onhold: "PAUSED",
  dropped: "DROPPED",
  plan_to_watch: "PLANNING",
  plantowatch: "PLANNING",
  plan_to_read: "PLANNING",
  plantoread: "PLANNING",
  rewatching: "REPEATING",
  rereading: "REPEATING",
  "1": "CURRENT",
  "2": "COMPLETED",
  "3": "PAUSED",
  "4": "DROPPED",
  "6": "PLANNING",
};

const AL_STATUS: WatchStatus[] = [
  "CURRENT",
  "PLANNING",
  "COMPLETED",
  "PAUSED",
  "DROPPED",
  "REPEATING",
];

function toStatus(raw: unknown): WatchStatus {
  const s = String(raw ?? "").toUpperCase();
  if ((AL_STATUS as string[]).includes(s)) return s as WatchStatus;
  const key = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  return MAL_STATUS[key] ?? "PLANNING";
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Keeps decimals (AniList POINT_10_DECIMAL scores like 8.5). */
function score(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
}

type Loose = Record<string, unknown>;

function fromEntry(e: Loose): ImportItem | null {
  const media = (e["media"] ?? e["node"] ?? {}) as Loose;
  const listStatus = (e["list_status"] ?? e) as Loose;
  const titleObj = media["title"] as Loose | string | undefined;
  const title =
    (typeof titleObj === "string" ? titleObj : undefined) ??
    (typeof titleObj === "object"
      ? ((titleObj["english"] ?? titleObj["romaji"] ?? titleObj["native"]) as
          string | undefined)
      : undefined) ??
    (e["anime_title"] as string | undefined) ??
    (e["manga_title"] as string | undefined) ??
    (media["name"] as string | undefined) ??
    "Unknown";

  const anilistId =
    num(e["mediaId"]) ?? num(media["id"]) ?? num(e["anilist_id"]);
  const malId =
    num(e["anime_id"]) ??
    num(e["manga_id"]) ??
    num(media["idMal"]) ??
    num(e["mal_id"]) ??
    (e["node"] ? num(media["id"]) : undefined);

  if (!anilistId && !malId) return null;

  const rawType = String(
    media["type"] ?? e["type"] ?? e["media_type"] ?? "",
  ).toUpperCase();
  const looksManga =
    rawType.includes("MANGA") ||
    rawType.includes("NOVEL") ||
    rawType.includes("MANHWA") ||
    rawType.includes("MANHUA") ||
    e["manga_id"] !== undefined ||
    e["num_chapters_read"] !== undefined ||
    e["my_read_chapters"] !== undefined;

  return {
    anilistId,
    malId,
    mediaType: looksManga ? "MANGA" : "ANIME",
    title,
    status: toStatus(
      listStatus["status"] ?? e["status"] ?? e["my_status"] ?? "PLANNING",
    ),
    progress:
      Number(
        listStatus["num_episodes_watched"] ??
          listStatus["num_chapters_read"] ??
          e["num_watched_episodes"] ??
          e["num_read_chapters"] ??
          e["progress"] ??
          e["my_watched_episodes"] ??
          e["my_read_chapters"] ??
          0,
      ) || 0,
    score: score(listStatus["score"] ?? e["score"] ?? e["my_score"]),
    notes: text(
      listStatus["comments"] ?? e["notes"] ?? e["my_comments"] ?? e["comments"],
    ),
    startedAt: date(
      listStatus["start_date"] ??
        e["startedAt"] ??
        e["my_start_date"] ??
        e["started_at"],
    ),
    completedAt: date(
      listStatus["finish_date"] ??
        e["completedAt"] ??
        e["my_finish_date"] ??
        e["finished_at"],
    ),
    repeat:
      Number(
        listStatus["num_times_rewatched"] ??
          e["repeat"] ??
          e["my_times_watched"] ??
          e["my_times_read"] ??
          0,
      ) || undefined,
  };
}

function text(v: unknown): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : undefined;
}

/** Accepts "2023-05-01", MAL "0000-00-00" placeholders and AniList fuzzy dates. */
function date(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s || s.startsWith("0000")) return undefined;
    return s;
  }
  if (typeof v === "object") {
    const d = v as Loose;
    const y = Number(d["year"]);
    if (!Number.isFinite(y) || !y) return undefined;
    const p = (n: unknown) => String(Number(n) || 1).padStart(2, "0");
    return `${y}-${p(d["month"])}-${p(d["day"])}`;
  }
  return undefined;
}

function collect(node: unknown, out: ImportItem[], depth = 0) {
  if (!node || depth > 6) return;
  if (Array.isArray(node)) {
    for (const child of node) {
      if (child && typeof child === "object") {
        const item = fromEntry(child as Loose);
        if (item) out.push(item);
        else collect(child, out, depth + 1);
      }
    }
    return;
  }
  if (typeof node === "object") {
    for (const value of Object.values(node as Loose)) {
      collect(value, out, depth + 1);
    }
  }
}

/* ---------------- MyAnimeList / MAL-exporter XML ---------------- */

function xmlText(el: Element, tag: string): string {
  return el.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
}

function parseXml(raw: string): ParsedImport {
  if (typeof DOMParser === "undefined") {
    throw new Error("XML import needs a browser environment");
  }
  const doc = new DOMParser().parseFromString(raw, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) {
    throw new Error("That XML file could not be parsed");
  }

  const items: ImportItem[] = [];

  const push = (el: Element, mediaType: MediaType) => {
    const malId = num(
      xmlText(
        el,
        mediaType === "MANGA" ? "manga_mangadb_id" : "series_animedb_id",
      ),
    );
    const title =
      xmlText(el, mediaType === "MANGA" ? "manga_title" : "series_title") ||
      "Unknown";
    if (!malId) return;
    items.push({
      malId,
      mediaType,
      title,
      status: toStatus(xmlText(el, "my_status")),
      progress:
        Number(
          mediaType === "MANGA"
            ? xmlText(el, "my_read_chapters")
            : xmlText(el, "my_watched_episodes"),
        ) || 0,
      score: score(xmlText(el, "my_score")),
      notes: text(xmlText(el, "my_comments")),
      startedAt: date(xmlText(el, "my_start_date")),
      completedAt: date(xmlText(el, "my_finish_date")),
      repeat:
        Number(
          xmlText(
            el,
            mediaType === "MANGA" ? "my_times_read" : "my_times_watched",
          ),
        ) || undefined,
    });
  };

  for (const el of Array.from(doc.getElementsByTagName("anime"))) {
    push(el, "ANIME");
  }
  for (const el of Array.from(doc.getElementsByTagName("manga"))) {
    push(el, "MANGA");
  }

  if (!items.length) throw new Error("No list entries found in that XML file");

  const user = doc.getElementsByTagName("user_name")[0]?.textContent?.trim();
  return {
    source: `MyAnimeList XML export${user ? ` (${user})` : ""}`,
    items,
  };
}

export function parseImport(raw: string): ParsedImport {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<")) return parseXml(trimmed);

  const json = JSON.parse(trimmed) as Loose;

  const kind = json["kind"];
  if (
    kind === "koka-backup" ||
    kind === "koka-library" ||
    kind === "koka-notes" ||
    kind === "kuro-backup" ||
    kind === "kuro-library" ||
    kind === "kuro-notes"
  ) {
    return {
      source:
        kind === "koka-library" || kind === "kuro-library"
          ? "Koka library file"
          : kind === "koka-notes" || kind === "kuro-notes"
            ? "Koka notes file"
            : "Koka backup",
      items: [],
      backup: {
        library: (json["library"] as LibraryEntry[]) ?? [],
        notes: (json["notes"] as Note[]) ?? [],
      },
    };
  }

  const items: ImportItem[] = [];
  collect(json, items);

  const dedup = new Map<string, ImportItem>();
  for (const item of items) {
    dedup.set(
      `${item.mediaType}-${item.anilistId ?? "m"}-${item.malId ?? "a"}`,
      item,
    );
  }

  const source = JSON.stringify(json).includes("MediaListCollection")
    ? "AniList export"
    : "MyAnimeList export";

  return { source, items: [...dedup.values()] };
}
