import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Markdown } from "@/components/Markdown";
import { useMediaMode, useNotes } from "@/lib/store";
import { Input } from "@/components/ui/input";

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
  const { notes } = useNotes();
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("ALL");

  const tags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) =>
      n.tags.forEach((t) => set.add(t.trim().toLowerCase())),
    );
    return [...set].sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return [...notes]
      .filter(
        (n) =>
          tag === "ALL" ||
          n.tags.some(
            (t) => t.trim().toLowerCase() === tag.trim().toLowerCase(),
          ),
      )
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.body.toLowerCase().includes(q),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, query, tag]);

  return (
    <>
      <PageHeader
        title="Notes"
        subtitle={`${notes.length} ${mode === "MANGA" ? "manga" : "anime"} notes · full markdown, searchable`}
      />

      <div className="mb-5 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            className="pl-9"
          />
        </div>
        {tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {["ALL", ...tags].map((t) => (
              <button
                key={t}
                onClick={() => setTag(t)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  tag === t
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "ALL" ? "All tags" : t}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((n) => (
            <article
              key={n.animeId}
              className="panel animate-in p-4 transition-all duration-300 fade-in-0 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
            >
              <Link
                to="/anime/$id"
                params={{ id: String(n.animeId) }}
                className="font-display text-sm font-semibold hover:text-primary"
              >
                {n.title}
              </Link>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Updated {new Date(n.updatedAt).toLocaleDateString()}
              </p>
              <div className="mt-3 max-h-56 overflow-hidden">
                <Markdown>{n.body || "_Empty note_"}</Markdown>
              </div>
              {n.tags.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {n.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="panel p-8 text-center text-sm text-muted-foreground">
          No notes yet — open any title and start writing.
        </p>
      )}
    </>
  );
}
