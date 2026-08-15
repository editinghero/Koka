import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader } from "@/components/AppShell";
import { AiPanel } from "@/components/AiPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { useLibrary, useMediaMode } from "@/lib/store";
import { MODE_COPY, STATUS_ORDER, statusLabel } from "@/lib/types";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Taste Insights — Koka Anime Dashboard" },
      {
        name: "description",
        content:
          "Visual stats, top genres, score distribution and watching habits analytics.",
      },
      { property: "og:title", content: "Taste Insights — Koka" },
      {
        property: "og:description",
        content:
          "Genre breakdowns, score distribution and AI analysis of your anime taste.",
      },
    ],
  }),
  component: InsightsPage,
});

function Bar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${max ? (value / max) * 100 : 0}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs tabular-nums">{value}</span>
    </div>
  );
}

function InsightsPage() {
  const { mode } = useMediaMode();
  const copy = MODE_COPY[mode];
  const { library } = useLibrary();

  const genres = useMemo(() => {
    const counts: Record<string, number> = {};
    library.forEach((e) =>
      e.media.genres?.forEach((g) => (counts[g] = (counts[g] ?? 0) + 1)),
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [library]);

  const studios = useMemo(() => {
    const counts: Record<string, number> = {};
    library.forEach((e) =>
      e.media.studios?.forEach((s) => (counts[s] = (counts[s] ?? 0) + 1)),
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [library]);

  const scores = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      label: `${i + 1}`,
      value: 0,
    }));
    library.forEach((e) => {
      const s = Math.round(e.score ?? 0);
      if (s >= 1 && s <= 10) buckets[s - 1]!.value += 1;
    });
    return buckets;
  }, [library]);

  const statusCounts = STATUS_ORDER.map((s) => ({
    label: statusLabel(s, mode),
    value: library.filter((e) => e.status === s).length,
  }));

  /** anime: episode length; manga: ~5 minutes per chapter (excludes PLANNING and 0 progress) */
  const activeLibrary = library.filter(
    (e) => e.status !== "PLANNING" && (e.progress ?? 0) > 0,
  );

  const hoursSpent = Math.round(
    activeLibrary.reduce(
      (s, e) =>
        s + e.progress * (mode === "MANGA" ? 5 : (e.media.duration ?? 24)),
      0,
    ) / 60,
  );

  const profile = library
    .filter((e) => e.score)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 40)
    .map((e) => `${e.media.title} ${e.score}/10 [${e.media.genres?.join("/")}]`)
    .join("; ");

  const backlog = library
    .filter((e) => e.status === "PLANNING")
    .slice(0, 40)
    .map((e) => e.media.title)
    .join(", ");

  const maxGenre = genres[0]?.[1] ?? 1;
  const maxStudio = studios[0]?.[1] ?? 1;
  const maxScore = Math.max(...scores.map((s) => s.value), 1);

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle={`${hoursSpent} ${copy.timeLabel.toLowerCase()} across ${activeLibrary.length} active ${copy.nounPlural} titles.`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel space-y-2.5 p-4">
          <h2 className="font-display text-sm font-semibold">Top genres</h2>
          {genres.length ? (
            genres.map(([g, v]) => (
              <Bar key={g} label={g} value={v} max={maxGenre} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          )}
        </section>

        <section className="panel space-y-2.5 p-4">
          <h2 className="font-display text-sm font-semibold">Studios</h2>
          {studios.length ? (
            studios.map(([s, v]) => (
              <Bar key={s} label={s} value={v} max={maxStudio} />
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          )}
        </section>

        <section className="panel space-y-2.5 p-4">
          <h2 className="font-display text-sm font-semibold">
            Score distribution
          </h2>
          {scores.map((s) => (
            <Bar
              key={s.label}
              label={`${s.label}/10`}
              value={s.value}
              max={maxScore}
            />
          ))}
        </section>

        <section className="panel space-y-2.5 p-4">
          <h2 className="font-display text-sm font-semibold">Status split</h2>
          {statusCounts.map((s) => (
            <Bar
              key={s.label}
              label={s.label}
              value={s.value}
              max={Math.max(...statusCounts.map((x) => x.value), 1)}
            />
          ))}
        </section>
      </div>

      <div className="mt-6">
        <ChatPanel
          title="Ask about your taste"
          description="A free-form chat that knows your ratings and backlog."
          allowNoteFetching
          context={`Rated titles: ${profile || "none"}. Planned backlog: ${backlog || "empty"}.`}
          suggestions={[
            "What genres am I avoiding?",
            "Build me a 5-title watch plan for this month",
            "Which of my ratings look inconsistent?",
          ]}
        />
      </div>

      <div className="mt-6 grid gap-4">
        <AiPanel
          title="Taste profile"
          description="What your ratings say about what you actually enjoy."
          label="Analyse"
          prompt={() =>
            `Analyse this rated ${copy.noun} list and write a markdown taste profile: dominant themes, tone preferences, pacing, what you consistently rate high vs low, and blind spots worth exploring. No spoilers, no character discussion.\n\nRatings: ${profile || "no rated titles"}`
          }
        />
        <AiPanel
          title="Backlog triage"
          description="Order your planned list into a sensible watch queue."
          label="Triage"
          prompt={() =>
            `Given my taste (${profile.slice(0, 1500) || "unknown"}), sort this planned backlog into a ${copy.verb} queue. Output a markdown table: Order, Title, Why now, Commitment (short/medium/long). Keep it spoiler-free.\n\nBacklog: ${backlog || "empty"}`
          }
        />
        <AiPanel
          title="Hidden gems"
          description="Recommendations outside the obvious picks."
          label="Find gems"
          search
          prompt={() =>
            `Based on my highly rated ${copy.nounPlural}, recommend 6 lesser-known ${copy.nounPlural} titles I likely haven't seen (exclude anything in the list). For each: title, year, one-line premise with no spoilers or character details, and why it fits my taste. Markdown list.\n\nMy list: ${profile || "unknown"}`
          }
        />
      </div>
    </>
  );
}
