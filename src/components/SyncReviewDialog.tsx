import * as React from "react";
import {
  Check,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Calendar,
  Sparkles,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeLineDiffHunks,
  type DiffHunk,
  type SyncDiffResult,
  type SyncReviewItem,
} from "@/lib/import-diff";
import type { LibraryEntry, MediaType, Note } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface SyncReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diffResult: SyncDiffResult;
  onCancel: () => void;
  onConfirm: (result: {
    entriesToMerge: LibraryEntry[];
    notesToMerge: Note[];
    itemsToDelete: { id: number; mediaType: MediaType }[];
  }) => Promise<void> | void;
  isApplying?: boolean;
}

type ScopeFilter = "ALL" | "ANIME" | "MANGA";

export function SyncReviewDialog({
  open,
  onOpenChange,
  diffResult,
  onCancel,
  onConfirm,
  isApplying = false,
}: SyncReviewDialogProps) {
  const { items, summary, unchangedCount } = diffResult;

  // Track ticked entries by key (`${mediaType}:${id}`)
  const [selectedKeys, setSelectedKeys] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of items) {
      if (item.defaultIncluded) {
        initial.add(item.key);
      }
    }
    return initial;
  });

  // Track note changes applied per item key
  const [noteApplyKeys, setNoteApplyKeys] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of items) {
      if (item.noteDiff?.hasDiff) {
        initial.add(item.key);
      }
    }
    return initial;
  });

  // Track expanded note diff views
  const [expandedNotes, setExpandedNotes] = React.useState<Set<string>>(
    () => new Set<string>(),
  );

  // Lazy cache of computed hunks for expanded items
  const [hunksCache, setHunksCache] = React.useState<
    Record<string, DiffHunk[]>
  >({});

  // Expanded blocks inside hunks
  const [expandedHunkBlocks, setExpandedHunkBlocks] = React.useState<
    Set<string>
  >(() => new Set<string>());

  // Scope filter (All / Anime / Manga)
  const [scope, setScope] = React.useState<ScopeFilter>("ALL");

  // Collapsible section states
  const [collapsedSections, setCollapsedSections] = React.useState<
    Record<string, boolean>
  >({
    updated: false,
    added: false,
    deleted: false,
  });

  // Pagination limits per section (50 items by default for 2000+ item performance)
  const [limits, setLimits] = React.useState<Record<string, number>>({
    updated: 50,
    added: 50,
    deleted: 50,
  });

  // Reset or update state whenever diffResult changes
  React.useEffect(() => {
    const initialSelected = new Set<string>();
    const initialNotes = new Set<string>();
    for (const item of items) {
      if (item.defaultIncluded) {
        initialSelected.add(item.key);
      }
      if (item.noteDiff?.hasDiff) {
        initialNotes.add(item.key);
      }
    }
    setSelectedKeys(initialSelected);
    setNoteApplyKeys(initialNotes);
    setExpandedNotes(new Set());
    setHunksCache({});
    setExpandedHunkBlocks(new Set());
  }, [diffResult, items]);

  // Filter items by media type scope (persisting checkbox selections across tabs)
  const filteredItems = React.useMemo(() => {
    if (scope === "ALL") return items;
    return items.filter((i) => i.mediaType === scope);
  }, [items, scope]);

  const updatedItems = React.useMemo(
    () => filteredItems.filter((i) => i.changeType === "updated"),
    [filteredItems],
  );
  const addedItems = React.useMemo(
    () => filteredItems.filter((i) => i.changeType === "added"),
    [filteredItems],
  );
  const deletedItems = React.useMemo(
    () => filteredItems.filter((i) => i.changeType === "deleted"),
    [filteredItems],
  );

  // Scope live counts
  const allCount = items.length;
  const animeCount = items.filter((i) => i.mediaType === "ANIME").length;
  const mangaCount = items.filter((i) => i.mediaType === "MANGA").length;

  // Selected totals
  const tickedAddedOrUpdated = React.useMemo(() => {
    return items.filter(
      (i) =>
        (i.changeType === "added" || i.changeType === "updated") &&
        selectedKeys.has(i.key),
    );
  }, [items, selectedKeys]);

  const tickedDeletions = React.useMemo(() => {
    return items.filter(
      (i) => i.changeType === "deleted" && selectedKeys.has(i.key),
    );
  }, [items, selectedKeys]);

  const tickedNotes = React.useMemo(() => {
    return items.filter(
      (i) =>
        selectedKeys.has(i.key) &&
        noteApplyKeys.has(i.key) &&
        i.noteDiff?.hasDiff &&
        i.incomingNote,
    );
  }, [items, selectedKeys, noteApplyKeys]);

  const totalSelectedChanges = tickedAddedOrUpdated.length;
  const totalSelectedDeletions = tickedDeletions.length;

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleNoteApply = (key: string) => {
    setNoteApplyKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpandNote = (item: SyncReviewItem) => {
    const key = item.key;
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Compute hunks lazily if not yet cached
        if (item.noteDiff && !hunksCache[key]) {
          const hunks = computeLineDiffHunks(
            item.noteDiff.oldBody,
            item.noteDiff.newBody,
          );
          setHunksCache((h) => ({ ...h, [key]: hunks }));
        }
      }
      return next;
    });
  };

  const selectAllDeletions = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const item of deletedItems) {
        next.add(item.key);
      }
      return next;
    });
  };

  const clearAllDeletions = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const item of deletedItems) {
        next.delete(item.key);
      }
      return next;
    });
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const showMore = (section: string) => {
    setLimits((prev) => ({
      ...prev,
      [section]: (prev[section] ?? 50) + 50,
    }));
  };

  const showAll = (section: string, count: number) => {
    setLimits((prev) => ({
      ...prev,
      [section]: count,
    }));
  };

  const handleConfirm = async () => {
    if (isApplying) return;

    const entriesToMerge: LibraryEntry[] = tickedAddedOrUpdated.map(
      (i) => i.entry,
    );
    const notesToMerge: Note[] = tickedNotes.map((i) => i.incomingNote as Note);
    const itemsToDelete: { id: number; mediaType: MediaType }[] =
      tickedDeletions.map((i) => ({
        id: i.id,
        mediaType: i.mediaType,
      }));

    await onConfirm({
      entriesToMerge,
      notesToMerge,
      itemsToDelete,
    });
  };

  // Dynamic button label
  let confirmLabel = "Sync changes";
  if (totalSelectedChanges === 0 && totalSelectedDeletions === 0) {
    confirmLabel = "Nothing selected (Close)";
  } else if (totalSelectedChanges > 0 && totalSelectedDeletions > 0) {
    confirmLabel = `Sync ${totalSelectedChanges} ${totalSelectedChanges === 1 ? "change" : "changes"} + delete ${totalSelectedDeletions}`;
  } else if (totalSelectedChanges > 0) {
    confirmLabel = `Sync ${totalSelectedChanges} ${totalSelectedChanges === 1 ? "change" : "changes"}`;
  } else {
    confirmLabel = `Delete ${totalSelectedDeletions} ${totalSelectedDeletions === 1 ? "entry" : "entries"}`;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isApplying) {
          onCancel();
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="w-[94vw] sm:w-[90vw] md:w-[84vw] lg:w-[80vw] max-w-4xl h-[88vh] sm:h-[80vh] max-h-[740px] p-0 flex flex-col gap-0 overflow-hidden rounded-2xl bg-card border border-border/80 shadow-2xl"
        onEscapeKeyDown={(e) => {
          if (isApplying) e.preventDefault();
          else onCancel();
        }}
        onPointerDownOutside={(e) => {
          if (isApplying) e.preventDefault();
        }}
      >
        {/* Sticky Header */}
        <DialogHeader className="shrink-0 border-b border-border/70 bg-card/95 backdrop-blur px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex flex-col gap-2.5 sm:gap-3">
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="min-w-0">
                <DialogTitle className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>Review sync</span>
                  <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 rounded-full bg-secondary border border-border">
                    {summary.totalVisible} items
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Review incoming additions, field updates, and deletion
                  candidates before writing to your library.
                </DialogDescription>
              </div>
            </div>

            {/* Summary chips & Scope Segmented Filter */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              {/* Summary chips */}
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                {summary.totalAdded > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20">
                    <span className="font-bold">+{summary.totalAdded}</span>{" "}
                    Added
                  </span>
                )}
                {summary.totalUpdated > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-secondary text-secondary-foreground border border-border">
                    <span className="font-bold">~{summary.totalUpdated}</span>{" "}
                    Updated
                  </span>
                )}
                {summary.totalNotesChanged > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-secondary text-secondary-foreground border border-border">
                    <FileText className="h-3 w-3 text-primary" />
                    <span className="font-bold">
                      {summary.totalNotesChanged}
                    </span>{" "}
                    Notes
                    {summary.totalNotesShortened > 0 && (
                      <span className="text-[10px] text-destructive font-semibold ml-0.5">
                        ({summary.totalNotesShortened} shortened)
                      </span>
                    )}
                  </span>
                )}
                {summary.totalDeletions > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 bg-destructive/10 text-destructive border border-destructive/20">
                    <span className="font-bold">-{summary.totalDeletions}</span>{" "}
                    To delete
                  </span>
                )}
              </div>

              {/* Segmented Filter (All / Anime / Manga) */}
              <div className="flex items-center rounded-full border border-border bg-secondary/50 p-0.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setScope("ALL")}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium transition-all",
                    scope === "ALL"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  All ({allCount})
                </button>
                <button
                  type="button"
                  onClick={() => setScope("ANIME")}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium transition-all",
                    scope === "ANIME"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Anime ({animeCount})
                </button>
                <button
                  type="button"
                  onClick={() => setScope("MANGA")}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium transition-all",
                    scope === "MANGA"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Manga ({mangaCount})
                </button>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Independently Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4 space-y-4 min-h-0 divide-y divide-border/60">
          {unchangedCount > 0 && (
            <div className="pb-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 inline-block" />
              <span>
                <strong className="text-foreground/80 font-medium">
                  {unchangedCount}
                </strong>{" "}
                {unchangedCount === 1 ? "entry is" : "entries are"} identical to
                your library and will not be changed.
              </span>
            </div>
          )}

          {/* Section: Updated */}
          {updatedItems.length > 0 && (
            <div className="pt-2 first:pt-0 space-y-2">
              <button
                type="button"
                onClick={() => toggleSection("updated")}
                className="w-full flex items-center justify-between text-left group py-1"
              >
                <div className="flex items-center gap-2">
                  {collapsedSections["updated"] ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Updated</span>
                    <Badge
                      variant="secondary"
                      className="text-[11px] h-5 px-1.5 font-normal"
                    >
                      {updatedItems.length}
                    </Badge>
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {collapsedSections["updated"] ? "Expand" : "Collapse"}
                </span>
              </button>

              {!collapsedSections["updated"] && (
                <div className="space-y-2 pt-1">
                  {updatedItems
                    .slice(0, limits["updated"] ?? 50)
                    .map((item) => renderRow(item))}

                  {updatedItems.length > (limits["updated"] ?? 50) && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => showMore("updated")}
                      >
                        Show 50 more (
                        {updatedItems.length - (limits["updated"] ?? 50)}{" "}
                        remaining)
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-muted-foreground"
                        onClick={() => showAll("updated", updatedItems.length)}
                      >
                        Show all ({updatedItems.length})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section: Added */}
          {addedItems.length > 0 && (
            <div className="pt-3 space-y-2">
              <button
                type="button"
                onClick={() => toggleSection("added")}
                className="w-full flex items-center justify-between text-left group py-1"
              >
                <div className="flex items-center gap-2">
                  {collapsedSections["added"] ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Added</span>
                    <Badge
                      variant="secondary"
                      className="text-[11px] h-5 px-1.5 font-normal"
                    >
                      {addedItems.length}
                    </Badge>
                  </h3>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {collapsedSections["added"] ? "Expand" : "Collapse"}
                </span>
              </button>

              {!collapsedSections["added"] && (
                <div className="space-y-2 pt-1">
                  {addedItems
                    .slice(0, limits["added"] ?? 50)
                    .map((item) => renderRow(item))}

                  {addedItems.length > (limits["added"] ?? 50) && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => showMore("added")}
                      >
                        Show 50 more (
                        {addedItems.length - (limits["added"] ?? 50)} remaining)
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-muted-foreground"
                        onClick={() => showAll("added", addedItems.length)}
                      >
                        Show all ({addedItems.length})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section: Not in this import (Deletions) */}
          {deletedItems.length > 0 && (
            <div className="pt-3 space-y-2">
              <div className="flex items-center justify-between py-1">
                <button
                  type="button"
                  onClick={() => toggleSection("deleted")}
                  className="flex items-center gap-2 text-left"
                >
                  {collapsedSections["deleted"] ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-2">
                    <span>Not in this import</span>
                    <Badge
                      variant="secondary"
                      className="text-[11px] h-5 px-1.5 font-normal text-muted-foreground"
                    >
                      {deletedItems.length}
                    </Badge>
                  </h3>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={selectAllDeletions}
                    className="text-[11px] text-destructive hover:underline px-1.5 py-0.5 rounded transition-colors"
                  >
                    Select all to delete
                  </button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button
                    type="button"
                    onClick={clearAllDeletions}
                    className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded transition-colors"
                  >
                    Keep all
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                These titles exist in your local library but are missing from
                this sync. They are kept by default unless you tick them for
                deletion.
              </p>

              {!collapsedSections["deleted"] && (
                <div className="space-y-2 pt-1">
                  {deletedItems
                    .slice(0, limits["deleted"] ?? 50)
                    .map((item) => renderRow(item))}

                  {deletedItems.length > (limits["deleted"] ?? 50) && (
                    <div className="flex items-center justify-center gap-2 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => showMore("deleted")}
                      >
                        Show 50 more (
                        {deletedItems.length - (limits["deleted"] ?? 50)}{" "}
                        remaining)
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 text-muted-foreground"
                        onClick={() => showAll("deleted", deletedItems.length)}
                      >
                        Show all ({deletedItems.length})
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {filteredItems.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">
              <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No items in this category</p>
              <p className="text-xs mt-1">
                All {scope.toLowerCase()} titles are up to date.
              </p>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <DialogFooter className="shrink-0 border-t border-border bg-surface/95 backdrop-blur px-4 py-3 sm:px-6 sm:py-3.5 flex flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isApplying}
            className="h-9 px-4 text-xs font-medium cursor-pointer"
          >
            <X className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={
              isApplying ||
              (totalSelectedChanges === 0 && totalSelectedDeletions === 0)
            }
            className={cn(
              "h-9 px-4 text-xs font-semibold shadow-sm cursor-pointer transition-all",
              totalSelectedDeletions > 0 && totalSelectedChanges === 0
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "",
            )}
          >
            {isApplying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                {confirmLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  /**
   * Renders a single row in the review dialog.
   */
  function renderRow(item: SyncReviewItem) {
    const isSelected = selectedKeys.has(item.key);
    const isNoteExpanded = expandedNotes.has(item.key);
    const isNoteApplied = noteApplyKeys.has(item.key);
    const isShortened = item.isShortenedNote;
    const isDeletion = item.changeType === "deleted";

    return (
      <div
        key={item.key}
        onClick={() => toggleSelect(item.key)}
        className={cn(
          "group cursor-pointer select-none rounded-xl border transition-all duration-150 p-3 sm:p-3.5 active:scale-[0.995]",
          // Normal updated / added
          !isDeletion &&
            !isShortened &&
            (isSelected
              ? "bg-card border-border hover:border-border/80 shadow-xs"
              : "bg-muted/15 border-border/40 opacity-60"),
          // Shortened note gets emphasis: destructive border + subtle background
          !isDeletion &&
            isShortened &&
            (isSelected
              ? "bg-destructive/5 border-destructive/40 shadow-xs"
              : "bg-destructive/5 border-destructive/20 opacity-60"),
          // Deletion: strongly destructive-looking when ticked
          isDeletion &&
            (isSelected
              ? "bg-destructive/10 border-destructive/60 text-destructive shadow-xs"
              : "bg-card/50 border-border/60 hover:border-border"),
        )}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox (pointer-events-none so tapping anywhere on the card toggles) */}
          <div className="pt-0.5">
            <Checkbox
              checked={isSelected}
              tabIndex={-1}
              aria-label={`Include ${item.title}`}
              className={cn(
                "pointer-events-none h-4 w-4 rounded transition-all",
                isDeletion && isSelected
                  ? "border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
                  : "",
              )}
            />
          </div>

          {/* Cover thumbnail */}
          <div className="shrink-0">
            {item.cover ? (
              <img
                src={item.cover}
                alt=""
                loading="lazy"
                className={cn(
                  "h-14 w-10 sm:h-16 sm:w-11 rounded-md object-cover border border-border/60 shadow-xs",
                  isDeletion && isSelected ? "grayscale opacity-75" : "",
                )}
              />
            ) : (
              <div className="h-14 w-10 sm:h-16 sm:w-11 rounded-md bg-secondary/80 border border-border/60 flex items-center justify-center text-[10px] text-muted-foreground">
                No art
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            {/* Title & Badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "text-xs sm:text-sm font-semibold truncate max-w-[280px] sm:max-w-md",
                  isDeletion && isSelected
                    ? "line-through text-destructive font-medium"
                    : "text-foreground",
                )}
                title={item.title}
              >
                {item.title}
              </span>

              <Badge
                variant="outline"
                className="text-[10px] h-4.5 px-1.5 font-normal tracking-wide text-muted-foreground uppercase"
              >
                {item.mediaType}
              </Badge>

              {item.changeType === "added" && (
                <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.2 rounded">
                  New
                </span>
              )}

              {isDeletion && (
                <span
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.2 rounded inline-flex items-center gap-1",
                    isSelected
                      ? "text-destructive bg-destructive/15 border border-destructive/30"
                      : "text-muted-foreground bg-secondary border border-border",
                  )}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                  {isSelected ? "Will be deleted" : "Keep in library"}
                </span>
              )}

              {isShortened && (
                <span className="text-[10px] font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Notes shortened −{item.noteDiff?.removedCount} lines
                </span>
              )}
            </div>

            {/* Field Changes and Notes Diff inline on the same row (wraps smoothly on mobile) */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
              {item.fieldChanges.map((change) => (
                <div
                  key={change.field}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px]",
                    change.isDate
                      ? "bg-primary/5 border-primary/20 text-foreground font-medium"
                      : "bg-secondary/60 border-border text-foreground/90",
                  )}
                >
                  {change.isDate && (
                    <Calendar className="h-3 w-3 text-primary mr-0.5" />
                  )}
                  <span className="text-muted-foreground">
                    {change.label}:
                  </span>
                  <span className="text-muted-foreground/80 line-through">
                    {String(change.oldVal ?? "—")}
                  </span>
                  <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/60" />
                  <span
                    className={cn(
                      "font-semibold",
                      change.isDate
                        ? "text-primary font-bold"
                        : "text-foreground",
                    )}
                  >
                    {String(change.newVal ?? "—")}
                  </span>
                </div>
              ))}

              {/* Note Diff Trigger Button inline on the same row */}
              {item.noteDiff?.hasDiff && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpandNote(item);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer active:scale-95",
                    isNoteExpanded
                      ? "bg-secondary border-primary/40 text-foreground"
                      : "bg-secondary/40 border-border hover:bg-secondary text-foreground/90",
                  )}
                >
                  <FileText className="h-3 w-3 text-primary" />
                  <span>Notes diff</span>
                  {/* Code-review-style counter */}
                  <span className="font-mono text-[10px] font-semibold ml-0.5">
                    <span className="text-destructive">
                      −{item.noteDiff.removedCount}
                    </span>{" "}
                    <span className="text-primary font-bold">
                      +{item.noteDiff.addedCount}
                    </span>
                  </span>
                  {isNoteExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              )}

              {item.noteDiff?.hasDiff && !isNoteApplied && (
                <span className="text-[10px] text-muted-foreground italic">
                  (Note overwrite skipped)
                </span>
              )}

              {/* Added Item Status & Progress preview */}
              {item.changeType === "added" && item.fieldChanges.length === 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] bg-secondary/60 border-border text-foreground/80">
                  <span className="font-medium text-foreground">
                    {item.entry.status}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span>
                    Progress: {item.entry.progress}/
                    {item.entry.media.episodes ??
                      item.entry.media.chapters ??
                      "?"}
                  </span>
                  {item.entry.score !== null && (
                    <>
                      <span className="text-muted-foreground">·</span>
                      <span>Score: {item.entry.score}</span>
                    </>
                  )}
                </span>
              )}

              {/* Deletion Item current library details */}
              {isDeletion && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] bg-secondary/40 border-border text-muted-foreground">
                  <span>{item.entry.status}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>
                    Progress: {item.entry.progress}/
                    {item.entry.media.episodes ??
                      item.entry.media.chapters ??
                      "?"}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Inline Unified Note Diff View (Code-Editor Style) */}
        {isNoteExpanded && item.noteDiff && (
          <div
            className="mt-3 pt-3 border-t border-border/60 space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <label
                className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isNoteApplied}
                  onCheckedChange={() => toggleNoteApply(item.key)}
                  className="h-3.5 w-3.5 rounded"
                />
                <span>Apply this note change</span>
                <span className="text-[11px] text-muted-foreground font-normal">
                  (uncheck to keep your existing note while applying other field
                  updates)
                </span>
              </label>

              <span className="text-[11px] font-mono text-muted-foreground">
                {item.noteDiff.oldLineCount} lines →{" "}
                {item.noteDiff.newLineCount} lines
              </span>
            </div>

            {/* Code diff container */}
            <div className="rounded-lg border border-border bg-secondary/20 overflow-hidden font-mono text-[11px] leading-relaxed select-text">
              {renderDiffHunks(
                item.key,
                hunksCache[item.key] ?? item.noteDiff.hunks ?? [],
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /**
   * Renders the unified line diff hunks for a note.
   */
  function renderDiffHunks(itemKey: string, hunks: DiffHunk[]) {
    if (!hunks || hunks.length === 0) {
      return (
        <div className="p-3 text-center text-xs text-muted-foreground">
          Computing line-by-line diff…
        </div>
      );
    }

    return (
      <div className="divide-y divide-border/40">
        {hunks.map((hunk) => {
          const hunkBlockKey = `${itemKey}:${hunk.id}`;
          const isBlockExpanded = expandedHunkBlocks.has(hunkBlockKey);

          if (hunk.collapsed && !isBlockExpanded) {
            return (
              <button
                key={hunk.id}
                type="button"
                onClick={() => {
                  setExpandedHunkBlocks((prev) => {
                    const next = new Set(prev);
                    next.add(hunkBlockKey);
                    return next;
                  });
                }}
                className="w-full py-1.5 px-3 bg-secondary/50 hover:bg-secondary text-muted-foreground text-center text-[10px] tracking-wide transition-colors cursor-pointer"
              >
                ··· Expand {hunk.collapsedCount ?? hunk.lines.length} unchanged
                lines ···
              </button>
            );
          }

          return (
            <div key={hunk.id} className="divide-y divide-border/20">
              {hunk.lines.map((line, lIdx) => (
                <div
                  key={lIdx}
                  className={cn(
                    "flex items-start px-2 py-0.5 transition-colors",
                    line.type === "add" &&
                      "bg-primary/10 text-primary border-l-2 border-primary",
                    line.type === "remove" &&
                      "bg-destructive/10 text-destructive border-l-2 border-destructive",
                    line.type === "equal" && "text-muted-foreground/90",
                  )}
                >
                  {/* Old line number */}
                  <span className="w-8 shrink-0 text-right pr-2 text-muted-foreground/40 select-none text-[10px]">
                    {line.oldLineNumber ?? ""}
                  </span>
                  {/* New line number */}
                  <span className="w-8 shrink-0 text-right pr-2 text-muted-foreground/40 select-none text-[10px]">
                    {line.newLineNumber ?? ""}
                  </span>
                  {/* Diff sign */}
                  <span className="w-4 shrink-0 text-center font-bold select-none">
                    {line.type === "add"
                      ? "+"
                      : line.type === "remove"
                        ? "−"
                        : " "}
                  </span>
                  {/* Line content */}
                  <span className="flex-1 whitespace-pre-wrap break-all min-w-0 pl-1">
                    {line.text || " "}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }
}
