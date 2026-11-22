import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Pin, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Markdown } from "@/components/Markdown";
import { NoteEditor } from "@/components/NoteEditor";
import { useMediaMode, useNotes } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/notes")({
  head: () => ({
    meta: [
      { title: "Notes — Koka Anime Dashboard" },
      {
        name: "description",
        content:
          "Keep private markdown notes for any anime or manga in your collection — thoughts, review drafts and episode commentary.",
      },
      { property: "og:title", content: "Notes — Koka Anime Dashboard" },
      {
        property: "og:description",
        content: "Searchable markdown notes for every anime you track.",
      },
    ],
  }),
  component: NotesPage,
});

function NotesPage() {
  const { mode } = useMediaMode();
  const { notes, all: allNotes, removeNote } = useNotes();
  const [query, setQuery] = useState("");
  const [openCustom, setOpenCustom] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("custom") === "1";
    }
    return false;
  });

  useEffect(() => {
    const handlePopState = () => {
      setOpenCustom(
        new URLSearchParams(window.location.search).get("custom") === "1",
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const showCustomNote = (show: boolean) => {
    setOpenCustom(show);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (show) {
        url.searchParams.set("custom", "1");
      } else {
        url.searchParams.delete("custom");
      }
      window.history.pushState(
        {},
        "",
        url.pathname + (url.search ? url.search : ""),
      );
    }
  };

  // The custom note is a single standalone note not linked to any specific anime/manga
  const customNote = useMemo(
    () => allNotes.find((n) => n.animeId === 0),
    [allNotes],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return [...notes]
      .filter((n) => n.animeId !== 0)
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query]);

  if (openCustom) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => showCustomNote(false)}
            className="gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Notes
          </Button>
          <span className="text-xs font-medium text-muted-foreground">
            Custom Notes (Standalone)
          </span>
        </div>

        <NoteEditor
          animeId={0}
          title="Custom Notes"
          mediaType="ANIME"
          fullPage
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Notes"
        subtitle={`${filtered.length} ${mode === "MANGA" ? "manga" : "anime"} notes · full markdown, searchable`}
      />

      {/* Pinned Single-Line Standalone Custom Note */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => showCustomNote(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            showCustomNote(true);
          }
        }}
        className="panel group mb-4 flex cursor-pointer items-center justify-between gap-3 p-3 transition-all duration-150 hover:border-primary/40 active:scale-[0.99] select-none"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Pin className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display truncate text-sm font-semibold text-foreground group-hover:text-primary">
                Custom Notes
              </span>
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Pinned
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {customNote?.body?.trim()
                ? customNote.body
                    .split("\n")[0]
                    ?.replace(/^[#*>\-\s]+/, "")
                    .slice(0, 80)
                : "Standalone notes, thoughts, and plans not linked to any specific title..."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
          {customNote?.updatedAt ? (
            <span>
              Last edited {new Date(customNote.updatedAt).toLocaleDateString()}
            </span>
          ) : (
            <span>Empty</span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      <div className="mb-5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((n) => (
            <article
              key={n.animeId}
              data-card-press
              className="panel card-pressable min-w-0 p-4 transition-all duration-150 active:scale-[0.98] active:opacity-85"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/anime/$id"
                    params={{ id: String(n.animeId) }}
                    className="font-display block truncate text-sm font-semibold transition-colors hover:text-primary active:opacity-80"
                  >
                    {n.title}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Last edited{" "}
                    {new Date(n.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm(`Delete note for "${n.title}"?`)) {
                      removeNote(n.animeId, n.mediaType ?? mode);
                      toast.success("Note deleted");
                    }
                  }}
                  title="Delete note"
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive active:scale-90"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 max-h-56 overflow-hidden">
                <Markdown>{n.body || "_Empty note_"}</Markdown>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="panel p-8 text-center text-sm text-muted-foreground">
          {query
            ? "No notes matching your search."
            : "No notes yet — open any title and start writing."}
        </p>
      )}
    </>
  );
}
