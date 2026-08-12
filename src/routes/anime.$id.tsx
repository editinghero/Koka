import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Minus, Plus, Trash2 } from "lucide-react";
import { Cover, countdown } from "@/components/AnimeCard";
import { AiPanel } from "@/components/AiPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { NoteEditor } from "@/components/NoteEditor";
import { fetchByIds } from "@/lib/anilist";
import { useLibrary, useMediaMode } from "@/lib/store";
import {
  MODE_COPY,
  STATUS_ORDER,
  statusLabel,
  totalUnits,
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
          "Track progress, write markdown notes and generate spoiler-free AI summaries and news for a single anime or manga.",
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
  const entry = library.find((e) => e.media.id === animeId);

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

  function setStatus(status: WatchStatus) {
    if (!media) return;
    if (entry) patch(media.id, { status });
    else
      upsert({
        media: { ...media, type: mode },
        status,
        progress: 0,
        score: null,
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
        updatedAt: Date.now(),
        addedAt: Date.now(),
      });
  }

  return (
    <div className="animate-in duration-300 fade-in-0 slide-in-from-bottom-3">
      <Link
        to="/library"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to library
      </Link>

      <div className="panel overflow-hidden">
        {media.banner ? (
          <img
            src={media.banner}
            alt=""
            loading="lazy"
            className="h-32 w-full object-cover md:h-44"
          />
        ) : null}
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

            <div className="mt-4 flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 active:scale-95 ${
                    entry?.status === s
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {statusLabel(s, mode)}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => bump(-1)}
                  aria-label="Decrease progress"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="text-sm tabular-nums">
                  {progress}/{total ?? "?"}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => bump(1)}
                  aria-label="Increase progress"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Score
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  value={entry?.score ?? ""}
                  placeholder="—"
                  onChange={(e) => {
                    const v = e.target.value;
                    patch(media.id, {
                      score:
                        v === "" ? null : Math.min(10, Math.max(0, Number(v))),
                    });
                  }}
                  disabled={!entry}
                  className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                />
                <span>/10</span>
              </label>

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

              {entry ? (
                <button
                  onClick={() => remove(media.id)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              ) : null}
            </div>

            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Your score</dt>
                <dd className="font-medium text-primary">
                  {entry?.score ? `${entry.score}/10` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Public score</dt>
                <dd className="font-medium">
                  {media.averageScore ? `${media.averageScore}%` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Started</dt>
                <dd className="font-medium">{entry?.startedAt ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Finished</dt>
                <dd className="font-medium">{entry?.completedAt ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {mode === "MANGA" ? "Rereads" : "Rewatches"}
                </dt>
                <dd className="font-medium">{entry?.repeat ?? 0}</dd>
              </div>
            </dl>

            {/* Custom User Tags */}
            <div className="mt-4 border-t border-border pt-3">
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
                      <Link
                        to="/library"
                        search={(prev: Record<string, unknown>) => ({
                          ...prev,
                          search: `#${tagLower}`,
                        })}
                        className="hover:underline"
                      >
                        #{tagLower}
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          const nextTags = (entry?.tags ?? []).filter(
                            (tag) => tag.trim().toLowerCase() !== tagLower,
                          );
                          patch(media.id, { tags: nextTags });
                        }}
                        className="ml-0.5 text-primary/70 hover:text-destructive"
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
                    const clean = newTag.trim().toLowerCase().replace(/^#/, "");
                    if (!clean) return;
                    if (!entry) {
                      upsert({
                        media: { ...media, type: mode },
                        status: "PLANNING",
                        progress: 0,
                        tags: [clean],
                        updatedAt: Date.now(),
                        addedAt: Date.now(),
                      });
                    } else {
                      const current = (entry.tags ?? []).map((t) =>
                        t.trim().toLowerCase(),
                      );
                      if (!current.includes(clean)) {
                        patch(media.id, { tags: [...current, clean] });
                      }
                    }
                  }}
                />
              </div>
            </div>
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
          prompt={() =>
            mode === "MANGA"
              ? `Create a spoiler-free reading guide for the manga "${media.title}": recommended reading order including spin-offs, arc/volume structure, where any anime adaptation stops, and total reading commitment. Markdown table where useful. No plot spoilers or character details.`
              : `Create a spoiler-free watch guide for "${media.title}": recommended watch order across seasons/movies/OVAs, source-material mapping (volumes/chapters covered), any filler to skip, and total runtime. Markdown table where useful. No plot spoilers or character details.`
          }
        />
        <AiPanel
          title="Similar titles"
          description={`What to ${copy.verb} if you liked this.`}
          label="Find similar"
          prompt={() =>
            `Recommend 5 ${copy.nounPlural} similar in tone and themes to "${media.title}" (genres: ${media.genres?.join(", ")}). One line each explaining the overlap. Spoiler-free, no character details.`
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
