import { useState } from "react";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { askGemini, SPOILER_FREE_SYSTEM } from "@/lib/gemini";
import { Markdown } from "./Markdown";
import { Button } from "@/components/ui/button";

export function AiPanel({
  title,
  description,
  prompt,
  label = "Generate",
  search = false,
  spoilerFree = true,
  storageHint,
}: {
  title: string;
  description?: string;
  prompt: () => string;
  label?: string;
  search?: boolean;
  spoilerFree?: boolean;
  storageHint?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [sources, setSources] = useState<{ title: string; uri: string }[]>([]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await askGemini(prompt(), {
        ...(spoilerFree ? { system: SPOILER_FREE_SYSTEM } : {}),
        search,
      });
      setResult(res.text);
      setSources(res.sources);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {label}
        </Button>
      </div>

      {error ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 border-t border-border pt-4">
          <Markdown>{result}</Markdown>
          {sources.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sources.slice(0, 8).map((s, i) => (
                <a
                  key={i}
                  href={s.uri}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-primary"
                >
                  {s.title.slice(0, 40)}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : storageHint && !error ? (
        <p className="mt-3 text-xs text-muted-foreground">{storageHint}</p>
      ) : null}
    </section>
  );
}
