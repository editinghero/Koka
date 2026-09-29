import type { LibraryEntry, MediaType, Note, WatchStatus } from "./types.ts";
import { normalizeTags } from "./types.ts";

export type SyncChangeType = "added" | "updated" | "deleted";

export interface FieldDiff {
  field:
    "status" | "progress" | "score" | "startedAt" | "completedAt" | "repeat";
  label: string;
  oldVal: string | number | null;
  newVal: string | number | null;
  isDate?: boolean;
}

export interface LineDiffItem {
  type: "equal" | "add" | "remove";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  id: string;
  oldStart: number;
  newStart: number;
  lines: LineDiffItem[];
  collapsed?: boolean;
  collapsedCount?: number;
}

export interface NoteDiff {
  hasDiff: boolean;
  oldBody: string;
  newBody: string;
  addedCount: number;
  removedCount: number;
  isShortened: boolean;
  oldLineCount: number;
  newLineCount: number;
  oldCharCount: number;
  newCharCount: number;
  hunks?: DiffHunk[];
}

export interface SyncReviewItem {
  key: string; // `${mediaType}:${id}`
  id: number;
  mediaType: MediaType;
  title: string;
  cover?: string | null;
  changeType: SyncChangeType;
  entry: LibraryEntry;
  existingEntry?: LibraryEntry;
  fieldChanges: FieldDiff[];
  incomingNote?: Note;
  existingNote?: Note;
  noteDiff?: NoteDiff;
  isShortenedNote: boolean;
  defaultIncluded: boolean;
}

export interface SyncDiffSummary {
  totalAdded: number;
  totalUpdated: number;
  totalUnchanged: number;
  totalDeletions: number;
  totalNotesChanged: number;
  totalNotesShortened: number;
  totalVisible: number;
  animeCount: number;
  mangaCount: number;
}

export interface SyncDiffResult {
  items: SyncReviewItem[];
  summary: SyncDiffSummary;
  unchangedCount: number;
}

export const keyOf = (type: MediaType, id: number) => `${type}:${id}`;

/**
 * Compare two notes and compute added lines, removed lines, and shortened status.
 * Hunks can be computed immediately or lazily.
 */
export function computeNoteDiff(
  oldBody: string,
  newBody: string,
  generateHunks = false,
): NoteDiff {
  const normalizedOld = oldBody.replace(/\r\n/g, "\n");
  const normalizedNew = newBody.replace(/\r\n/g, "\n");

  if (normalizedOld.trim() === normalizedNew.trim()) {
    return {
      hasDiff: false,
      oldBody,
      newBody,
      addedCount: 0,
      removedCount: 0,
      isShortened: false,
      oldLineCount: 0,
      newLineCount: 0,
      oldCharCount: normalizedOld.length,
      newCharCount: normalizedNew.length,
    };
  }

  const oldLines = normalizedOld ? normalizedOld.split("\n") : [];
  const newLines = normalizedNew ? normalizedNew.split("\n") : [];

  const oldLineCount = oldLines.length;
  const newLineCount = newLines.length;
  const oldCharCount = normalizedOld.length;
  const newCharCount = normalizedNew.length;

  const isShortened =
    newLineCount < oldLineCount || newCharCount < oldCharCount;

  // Pathological input check
  if (oldLineCount > 5000 || newLineCount > 5000) {
    return {
      hasDiff: true,
      oldBody,
      newBody,
      addedCount: newLineCount,
      removedCount: oldLineCount,
      isShortened,
      oldLineCount,
      newLineCount,
      oldCharCount,
      newCharCount,
    };
  }

  // If hunks are requested now
  let hunks: DiffHunk[] | undefined;
  let addedCount = 0;
  let removedCount = 0;

  if (generateHunks) {
    hunks = computeLineDiffHunks(normalizedOld, normalizedNew);
    for (const h of hunks) {
      for (const line of h.lines) {
        if (line.type === "add") addedCount++;
        else if (line.type === "remove") removedCount++;
      }
    }
  } else {
    // Quick estimation of counts via line sets or fast diff
    const oldSet = new Set(oldLines);
    const newSet = new Set(newLines);
    for (const l of newLines) if (!oldSet.has(l)) addedCount++;
    for (const l of oldLines) if (!newSet.has(l)) removedCount++;
    // If lines were edited without set difference, ensure at least 1 count
    if (
      addedCount === 0 &&
      removedCount === 0 &&
      normalizedOld !== normalizedNew
    ) {
      addedCount = Math.max(1, newLineCount - oldLineCount);
      removedCount = Math.max(1, oldLineCount - newLineCount);
    }
  }

  return {
    hasDiff: true,
    oldBody,
    newBody,
    addedCount,
    removedCount,
    isShortened,
    oldLineCount,
    newLineCount,
    oldCharCount,
    newCharCount,
    hunks,
  };
}

/**
 * Line-based diff with Myers/LCS algorithm and collapsed unchanged runs.
 */
export function computeLineDiffHunks(
  oldBody: string,
  newBody: string,
  contextSize = 3,
): DiffHunk[] {
  const normalizedOld = oldBody.replace(/\r\n/g, "\n");
  const normalizedNew = newBody.replace(/\r\n/g, "\n");

  const oldLines = normalizedOld.length ? normalizedOld.split("\n") : [];
  const newLines = normalizedNew.length ? normalizedNew.split("\n") : [];

  if (oldLines.length > 5000 || newLines.length > 5000) {
    return [
      {
        id: "too-large",
        oldStart: 1,
        newStart: 1,
        lines: [
          ...oldLines.map((t, i) => ({
            type: "remove" as const,
            text: t,
            oldLineNumber: i + 1,
          })),
          ...newLines.map((t, i) => ({
            type: "add" as const,
            text: t,
            newLineNumber: i + 1,
          })),
        ],
      },
    ];
  }

  // 1. Prefix trim
  let prefix = 0;
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix++;
  }

  // 2. Suffix trim
  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] ===
      newLines[newLines.length - 1 - suffix]
  ) {
    suffix++;
  }

  const middleOld = oldLines.slice(prefix, oldLines.length - suffix);
  const middleNew = newLines.slice(prefix, newLines.length - suffix);

  // 3. LCS on middle
  const n = middleOld.length;
  const m = middleNew.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      if (middleOld[i] === middleNew[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1;
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack middle
  const middleOps: Array<{ type: "equal" | "add" | "remove"; text: string }> =
    [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && middleOld[i - 1] === middleNew[j - 1]) {
      middleOps.push({ type: "equal", text: middleOld[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      middleOps.push({ type: "add", text: middleNew[j - 1] });
      j--;
    } else {
      middleOps.push({ type: "remove", text: middleOld[i - 1] });
      i--;
    }
  }
  middleOps.reverse();

  // Combine prefix + middle + suffix into full ops
  const allOps: LineDiffItem[] = [];
  let oldLine = 1;
  let newLine = 1;

  for (let k = 0; k < prefix; k++) {
    allOps.push({
      type: "equal",
      text: oldLines[k],
      oldLineNumber: oldLine++,
      newLineNumber: newLine++,
    });
  }

  for (const op of middleOps) {
    if (op.type === "equal") {
      allOps.push({
        type: "equal",
        text: op.text,
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
    } else if (op.type === "remove") {
      allOps.push({
        type: "remove",
        text: op.text,
        oldLineNumber: oldLine++,
      });
    } else if (op.type === "add") {
      allOps.push({
        type: "add",
        text: op.text,
        newLineNumber: newLine++,
      });
    }
  }

  for (let k = oldLines.length - suffix; k < oldLines.length; k++) {
    allOps.push({
      type: "equal",
      text: oldLines[k],
      oldLineNumber: oldLine++,
      newLineNumber: newLine++,
    });
  }

  // 4. Group into hunks with context collapsing
  if (allOps.length === 0) return [];

  // Find change indices
  const changeIndices = new Set<number>();
  allOps.forEach((op, idx) => {
    if (op.type !== "equal") {
      for (
        let c = Math.max(0, idx - contextSize);
        c <= Math.min(allOps.length - 1, idx + contextSize);
        c++
      ) {
        changeIndices.add(c);
      }
    }
  });

  // If no changes at all
  if (changeIndices.size === 0) {
    return [
      {
        id: "hunk-0",
        oldStart: 1,
        newStart: 1,
        lines: allOps,
      },
    ];
  }

  const hunks: DiffHunk[] = [];
  let currentLines: LineDiffItem[] = [];
  let hunkIndex = 0;

  for (let idx = 0; idx < allOps.length; idx++) {
    const isContextOrChange = changeIndices.has(idx);

    if (isContextOrChange) {
      currentLines.push(allOps[idx]);
    } else {
      // We entered an unchanged run
      if (currentLines.length > 0) {
        hunks.push({
          id: `hunk-${hunkIndex++}`,
          oldStart: currentLines[0].oldLineNumber ?? 1,
          newStart: currentLines[0].newLineNumber ?? 1,
          lines: currentLines,
        });
        currentLines = [];
      }

      // Gather all consecutive collapsed lines
      const collapsedLines: LineDiffItem[] = [];
      while (idx < allOps.length && !changeIndices.has(idx)) {
        collapsedLines.push(allOps[idx]);
        idx++;
      }
      idx--; // step back since for loop increments

      if (collapsedLines.length > 0) {
        hunks.push({
          id: `collapsed-${hunkIndex++}`,
          oldStart: collapsedLines[0].oldLineNumber ?? 1,
          newStart: collapsedLines[0].newLineNumber ?? 1,
          lines: collapsedLines,
          collapsed: true,
          collapsedCount: collapsedLines.length,
        });
      }
    }
  }

  if (currentLines.length > 0) {
    hunks.push({
      id: `hunk-${hunkIndex++}`,
      oldStart: currentLines[0].oldLineNumber ?? 1,
      newStart: currentLines[0].newLineNumber ?? 1,
      lines: currentLines,
    });
  }

  return hunks;
}

/**
 * Compute the complete change set for merge sync.
 * Pure and side-effect free.
 */
export function computeSyncDiff(
  existingLibrary: LibraryEntry[],
  existingNotes: Note[],
  incomingEntries: LibraryEntry[],
  incomingNotes: Note[],
  types: MediaType[],
): SyncDiffResult {
  // Scope existing entries to touched types
  const existingMap = new Map<string, LibraryEntry>();
  for (const e of existingLibrary) {
    const t = e.media.type === "MANGA" ? "MANGA" : "ANIME";
    if (types.includes(t)) {
      existingMap.set(keyOf(t, e.media.id), e);
    }
  }

  // Build fallback map of media ID to MediaType from existing and incoming entries
  const knownMediaTypeMap = new Map<number, MediaType>();
  for (const e of existingLibrary) {
    knownMediaTypeMap.set(e.media.id, e.media.type === "MANGA" ? "MANGA" : "ANIME");
  }
  for (const e of incomingEntries) {
    knownMediaTypeMap.set(e.media.id, e.media.type === "MANGA" ? "MANGA" : "ANIME");
  }

  const resolveNoteType = (n: Note): MediaType => {
    if (n.mediaType === "MANGA" || n.mediaType === "ANIME") return n.mediaType;
    return knownMediaTypeMap.get(n.animeId) ?? "ANIME";
  };

  // Scope existing notes to touched types
  const existingNotesMap = new Map<string, Note>();
  for (const n of existingNotes) {
    const t = resolveNoteType(n);
    if (types.includes(t)) {
      existingNotesMap.set(keyOf(t, n.animeId), n);
    }
  }

  // Map incoming notes
  const incomingNotesMap = new Map<string, Note>();
  for (const n of incomingNotes) {
    const t = resolveNoteType(n);
    incomingNotesMap.set(keyOf(t, n.animeId), n);
  }

  const items: SyncReviewItem[] = [];
  const processedKeys = new Set<string>();

  let totalAdded = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let totalNotesChanged = 0;
  let totalNotesShortened = 0;

  for (const incoming of incomingEntries) {
    const t: MediaType = incoming.media.type === "MANGA" ? "MANGA" : "ANIME";
    const k = keyOf(t, incoming.media.id);
    processedKeys.add(k);

    const existing = existingMap.get(k);
    const existingNote = existingNotesMap.get(k);
    const incomingNote = incomingNotesMap.get(k);

    // Tags and custom links are merged preserving existing
    const existingTags = existing?.tags ?? [];
    const incomingTags = incoming.tags ?? [];
    const finalTags =
      existingTags.length > 0
        ? normalizeTags([...existingTags, ...incomingTags])
        : normalizeTags(incomingTags);

    const existingLinks = existing?.customLinks ?? [];
    const finalLinks =
      existingLinks.length > 0 ? existingLinks : (incoming.customLinks ?? []);

    const sanitizedIncoming: LibraryEntry = {
      ...incoming,
      tags: finalTags,
      customLinks: finalLinks,
      media: { ...existing?.media, ...incoming.media },
      addedAt: existing?.addedAt ?? incoming.addedAt,
    };

    if (!existing) {
      // ADDED entry
      totalAdded++;

      let noteDiff: NoteDiff | undefined;
      const isShortenedNote = false;

      if (incomingNote && incomingNote.body.trim()) {
        noteDiff = computeNoteDiff("", incomingNote.body);
        totalNotesChanged++;
      }

      items.push({
        key: k,
        id: incoming.media.id,
        mediaType: t,
        title: incoming.media.title,
        cover: incoming.media.cover ?? null,
        changeType: "added",
        entry: sanitizedIncoming,
        fieldChanges: [],
        incomingNote,
        existingNote: undefined,
        noteDiff,
        isShortenedNote,
        defaultIncluded: true,
      });
    } else {
      // Check for field changes
      const fieldChanges: FieldDiff[] = [];

      if (existing.status !== incoming.status) {
        fieldChanges.push({
          field: "status",
          label: "Status",
          oldVal: existing.status,
          newVal: incoming.status,
        });
      }

      if (existing.progress !== incoming.progress) {
        fieldChanges.push({
          field: "progress",
          label: "Progress",
          oldVal: existing.progress,
          newVal: incoming.progress,
        });
      }

      const oldScore = existing.score ?? null;
      const newScore = incoming.score ?? null;
      if (oldScore !== newScore) {
        fieldChanges.push({
          field: "score",
          label: "Score",
          oldVal: oldScore,
          newVal: newScore,
        });
      }

      const oldStarted = existing.startedAt ?? null;
      const newStarted = incoming.startedAt ?? null;
      if (oldStarted !== newStarted) {
        fieldChanges.push({
          field: "startedAt",
          label: "Started",
          oldVal: oldStarted,
          newVal: newStarted,
          isDate: true,
        });
      }

      const oldCompleted = existing.completedAt ?? null;
      const newCompleted = incoming.completedAt ?? null;
      if (oldCompleted !== newCompleted) {
        fieldChanges.push({
          field: "completedAt",
          label: "Completed",
          oldVal: oldCompleted,
          newVal: newCompleted,
          isDate: true,
        });
      }

      const oldRepeat = existing.repeat ?? null;
      const newRepeat = incoming.repeat ?? null;
      if (oldRepeat !== newRepeat) {
        fieldChanges.push({
          field: "repeat",
          label: "Repeat",
          oldVal: oldRepeat,
          newVal: newRepeat,
        });
      }

      // Check note diff
      let noteDiff: NoteDiff | undefined;
      let hasNoteChange = false;
      let isShortenedNote = false;

      if (incomingNote) {
        const oldBody = existingNote?.body ?? "";
        const newBody = incomingNote.body ?? "";
        if (oldBody.trim() !== newBody.trim()) {
          noteDiff = computeNoteDiff(oldBody, newBody);
          if (noteDiff.hasDiff) {
            hasNoteChange = true;
            totalNotesChanged++;
            if (noteDiff.isShortened) {
              isShortenedNote = true;
              totalNotesShortened++;
            }
          }
        }
      }

      if (fieldChanges.length > 0 || hasNoteChange) {
        totalUpdated++;
        items.push({
          key: k,
          id: incoming.media.id,
          mediaType: t,
          title: incoming.media.title,
          cover: incoming.media.cover ?? null,
          changeType: "updated",
          entry: sanitizedIncoming,
          existingEntry: existing,
          fieldChanges,
          incomingNote,
          existingNote,
          noteDiff,
          isShortenedNote,
          defaultIncluded: true,
        });
      } else {
        totalUnchanged++;
      }
    }
  }

  // Deletions: entries in local library for touched types that are missing from import
  let totalDeletions = 0;
  for (const [k, existing] of existingMap) {
    if (!processedKeys.has(k)) {
      totalDeletions++;
      const t = existing.media.type === "MANGA" ? "MANGA" : "ANIME";
      items.push({
        key: k,
        id: existing.media.id,
        mediaType: t,
        title: existing.media.title,
        cover: existing.media.cover ?? null,
        changeType: "deleted",
        entry: existing,
        existingEntry: existing,
        fieldChanges: [],
        isShortenedNote: false,
        defaultIncluded: false, // Default = unticked (keep)
      });
    }
  }

  // Sort items:
  // In "updated", items with shortened notes are sorted to the very top!
  const updatedItems = items
    .filter((i) => i.changeType === "updated")
    .sort((a, b) => {
      if (a.isShortenedNote && !b.isShortenedNote) return -1;
      if (!a.isShortenedNote && b.isShortenedNote) return 1;
      return a.title.localeCompare(b.title);
    });

  const addedItems = items
    .filter((i) => i.changeType === "added")
    .sort((a, b) => a.title.localeCompare(b.title));

  const deletedItems = items
    .filter((i) => i.changeType === "deleted")
    .sort((a, b) => a.title.localeCompare(b.title));

  const sortedItems = [...updatedItems, ...addedItems, ...deletedItems];

  const animeCount = sortedItems.filter((i) => i.mediaType === "ANIME").length;
  const mangaCount = sortedItems.filter((i) => i.mediaType === "MANGA").length;

  return {
    items: sortedItems,
    summary: {
      totalAdded,
      totalUpdated,
      totalUnchanged,
      totalDeletions,
      totalNotesChanged,
      totalNotesShortened,
      totalVisible: sortedItems.length,
      animeCount,
      mangaCount,
    },
    unchangedCount: totalUnchanged,
  };
}
