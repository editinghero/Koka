import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchAnime } from "@/lib/anilist";
import { useLibrary, useMediaMode, useNotes } from "@/lib/store";
import { statusLabel } from "@/lib/types";

const PAGES = [
  { to: "/", label: "Dashboard" },
  { to: "/library", label: "Library" },
  { to: "/seasons", label: "Discover" },
  { to: "/news", label: "News radar" },
  { to: "/insights", label: "Insights" },
  { to: "/notes", label: "Notes" },
  { to: "/import", label: "Import & export" },
  { to: "/settings", label: "Settings" },
] as const;

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query);
  const navigate = useNavigate();
  const { mode } = useMediaMode();
  const { library } = useLibrary();
  const { notes } = useNotes();

  const q = query.toLowerCase().trim();
  const cleanQ = q.replace(/^#/, "").trim();

  const inLibrary = useMemo(
    () =>
      cleanQ
        ? library
            .filter((e) => {
              const titleMatch = e.media.title.toLowerCase().includes(cleanQ);
              const tagMatch = e.tags?.some((t) =>
                t.toLowerCase().includes(cleanQ),
              );
              const customListMatch = e.customLists?.some((c) =>
                c.toLowerCase().includes(cleanQ),
              );
              return titleMatch || tagMatch || customListMatch;
            })
            .slice(0, 10)
        : library.slice(0, 5),
    [library, cleanQ],
  );

  const noteHits = useMemo(
    () =>
      cleanQ
        ? notes
            .filter(
              (n) =>
                n.title.toLowerCase().includes(cleanQ) ||
                n.body.toLowerCase().includes(cleanQ) ||
                n.tags?.some((t) => t.toLowerCase().includes(cleanQ)),
            )
            .slice(0, 5)
        : [],
    [notes, cleanQ],
  );

  const pageHits = useMemo(
    () =>
      PAGES.filter((p) => !cleanQ || p.label.toLowerCase().includes(cleanQ)),
    [cleanQ],
  );

  const { data: remote = [], isFetching } = useQuery({
    queryKey: ["global-search", mode, debounced],
    queryFn: () => searchAnime(debounced, mode),
    enabled: open && debounced.trim().length > 1,
    staleTime: 1000 * 60 * 5,
  });

  const libraryIds = new Set(library.map((e) => e.media.id));

  function go(to: string, params?: Record<string, string>) {
    onOpenChange(false);
    setQuery("");
    void navigate({ to, params } as never);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={`Search ${mode === "MANGA" ? "manga" : "anime"}, tags (#ecchi), custom lists or notes…`}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isFetching ? "Searching…" : "Nothing found."}
        </CommandEmpty>

        {inLibrary.length ? (
          <CommandGroup
            heading={cleanQ ? "In your library" : "Recently updated"}
          >
            {inLibrary.map((e) => {
              const tagsStr = e.tags?.length ? ` #${e.tags.join(" #")}` : "";
              const listsStr = e.customLists?.length
                ? ` ${e.customLists.join(" ")}`
                : "";
              return (
                <CommandItem
                  key={`lib-${e.media.id}`}
                  value={`${e.media.title}${tagsStr}${listsStr} lib-${e.media.id}`}
                  onSelect={() => go("/anime/$id", { id: String(e.media.id) })}
                >
                  <span className="truncate">{e.media.title}</span>
                  {e.tags?.length ? (
                    <span className="ml-2 truncate text-[10px] text-primary/80">
                      #{e.tags[0]}
                    </span>
                  ) : null}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {statusLabel(e.status, mode)}
                    {e.score ? ` · ${e.score}/10` : ""}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {noteHits.length ? (
          <CommandGroup heading="Notes">
            {noteHits.map((n) => (
              <CommandItem
                key={`note-${n.animeId}`}
                value={`${n.title} ${n.body.slice(0, 60)} ${(n.tags ?? []).join(" ")} note-${n.animeId}`}
                onSelect={() => go("/anime/$id", { id: String(n.animeId) })}
              >
                <span className="truncate">{n.title}</span>
                <span className="ml-auto truncate text-[11px] text-muted-foreground">
                  {n.body.slice(0, 40)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {remote.filter((m) => !libraryIds.has(m.id)).length ? (
          <CommandGroup heading="AniList">
            {remote
              .filter((m) => !libraryIds.has(m.id))
              .slice(0, 8)
              .map((m) => (
                <CommandItem
                  key={`al-${m.id}`}
                  value={`${m.title} al-${m.id}`}
                  onSelect={() => go("/anime/$id", { id: String(m.id) })}
                >
                  <span className="truncate">{m.title}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {m.seasonYear ?? ""} {m.format ?? ""}
                  </span>
                </CommandItem>
              ))}
          </CommandGroup>
        ) : null}

        {pageHits.length ? (
          <CommandGroup heading="Pages">
            {pageHits.map((p) => (
              <CommandItem
                key={p.to}
                value={`${p.label} page-${p.to}`}
                onSelect={() => go(p.to)}
              >
                {p.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

export function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="flex-1 text-left">Search…</span>
      <kbd className="hidden rounded border border-border px-1 text-[10px] md:inline">
        ⌘K
      </kbd>
    </button>
  );
}

export function SearchSpinner() {
  return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
}
