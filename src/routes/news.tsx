import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { AiPanel } from "@/components/AiPanel";
import { LiveNewsFeed } from "@/components/LiveNewsFeed";
import { useLibrary } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Anime News Radar — Koka" },
      {
        name: "description",
        content:
          "AI-curated anime news digests, trailer releases, production updates and live anime news feed.",
      },
      { property: "og:title", content: "Anime News Radar — Koka" },
      {
        property: "og:description",
        content:
          "Live anime news feed and AI-generated digests for the anime you watch.",
      },
    ],
  }),
  component: NewsPage,
});

function NewsPage() {
  const { library } = useLibrary();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [scope, setScope] = useState<"watching" | "recent" | "custom">(
    "watching",
  );
  const [custom, setCustom] = useState("");

  const titles =
    scope === "custom"
      ? custom
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : scope === "watching"
        ? library
            .filter((e) => e.status === "CURRENT" || e.status === "REPEATING")
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 40)
            .map((e) => e.media.title)
        : [...library]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 10)
            .map((e) => e.media.title);

  const range =
    from || to
      ? `between ${from || "any earlier date"} and ${to || "today"}`
      : "in the last 14 days";

  return (
    <>
      <PageHeader
        title="News radar"
        subtitle="Grounded, AI-written news digests and live RSS feeds from major anime networks."
      />

      <section className="panel mb-5 space-y-4 p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["watching", "Currently watching"],
              ["recent", "Latest 10 titles"],
              ["custom", "Custom titles"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setScope(key)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                scope === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {scope === "custom" ? (
          <div className="space-y-1.5">
            <Label htmlFor="custom">Titles (comma separated)</Label>
            <Input
              id="custom"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Frieren, Vinland Saga, Dandadan"
            />
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave dates empty for the latest news. {titles.length} titles
          selected.
        </p>
      </section>

      <div className="grid gap-4">
        <AiPanel
          title="News digest"
          description={`Headlines ${range}, grouped by title, with web sources.`}
          label="Fetch news"
          search
          spoilerFree={false}
          prompt={() =>
            `Perform a web search to find recent news, trailers, production updates, and announcements published ${range} for these anime: ${titles.join(", ") || "none"}. Group the findings by title using h3 headers. Provide bullet points with dates in bold and source details for each title where news is found. Only list titles that have actual news or updates.`
          }
        />
        <AiPanel
          title="Release & schedule watch"
          description="Confirmed dates, delays, new seasons and movie announcements."
          label="Check releases"
          search
          spoilerFree={false}
          prompt={() =>
            `Perform a web search for confirmed release-date news (new seasons, movies, delays, streaming windows) ${range} for these anime: ${titles.join(", ") || "none"}. Return a markdown table with columns Title, Announcement / Release Date, Status, Source. Only include verifiable items found via search.`
          }
        />
      </div>

      <LiveNewsFeed />
    </>
  );
}
