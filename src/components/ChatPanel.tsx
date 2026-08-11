import { useEffect, useRef, useState } from "react";
import {
  Loader2,
  Send,
  ShieldCheck,
  ShieldOff,
  Globe,
  Trash2,
} from "lucide-react";
import { chatGemini, SPOILER_FREE_SYSTEM, type ChatTurn } from "@/lib/gemini";
import {
  getAnimeChatHistory,
  getGlobalChatHistory,
  saveAnimeChatHistory,
  saveGlobalChatHistory,
  clearAnimeChatHistory,
  clearGlobalChatHistory,
} from "@/lib/chat-storage";
import { Markdown } from "./Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = ChatTurn & { sources?: { title: string; uri: string }[] };

const BASE_SYSTEM =
  "You are Koka, a calm and knowledgeable anime assistant inside a personal anime dashboard. " +
  "Answer in clean, compact markdown. Be direct and avoid filler.";

export function ChatPanel({
  title = "Ask Koka AI",
  description,
  context,
  suggestions = [],
  defaultSpoilerFree = true,
  className,
  compact = false,
  animeId,
}: {
  title?: string;
  description?: string;
  /** Extra grounding context injected into the system prompt. */
  context?: string | undefined;
  suggestions?: string[];
  defaultSpoilerFree?: boolean;
  className?: string;
  compact?: boolean;
  /** Optional animeId for per-anime title chat persistence */
  animeId?: number;
}) {
  const [messages, setMessages] = useState<Msg[]>(() => {
    return animeId ? getAnimeChatHistory(animeId) : getGlobalChatHistory();
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spoilerFree, setSpoilerFree] = useState(defaultSpoilerFree);
  const [search, setSearch] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Sync message state changes to local storage
  useEffect(() => {
    if (animeId) {
      saveAnimeChatHistory(animeId, messages);
    } else {
      saveGlobalChatHistory(messages);
    }
  }, [messages, animeId]);

  function handleClear() {
    setMessages([]);
    setError(null);
    if (animeId) {
      clearAnimeChatHistory(animeId);
    } else {
      clearGlobalChatHistory();
    }
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const system = [
        BASE_SYSTEM,
        context ? `Context about the user:\n${context}` : "",
        spoilerFree
          ? SPOILER_FREE_SYSTEM
          : "Spoilers are allowed — the user asked for full detail.",
      ]
        .filter(Boolean)
        .join("\n\n");
      const res = await chatGemini(
        next.map((m) => ({ role: m.role, text: m.text })),
        { system, search },
      );
      setMessages([
        ...next,
        { role: "model", text: res.text, sources: res.sources },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
      requestAnimationFrame(() =>
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight }),
      );
    }
  }

  return (
    <section className={cn("panel flex flex-col p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <Toggle
            active={spoilerFree}
            onClick={() => setSpoilerFree((s) => !s)}
            label={spoilerFree ? "Spoiler-free" : "Spoilers on"}
            icon={spoilerFree ? ShieldCheck : ShieldOff}
          />
          <Toggle
            active={search}
            onClick={() => setSearch((s) => !s)}
            label="Web"
            icon={Globe}
          />
          {messages.length ? (
            <Toggle
              active={false}
              onClick={handleClear}
              label="Clear chat"
              icon={Trash2}
            />
          ) : null}
        </div>
      </div>

      <div
        ref={scroller}
        className={cn(
          "mt-3 flex-1 space-y-3 overflow-y-auto",
          compact ? "max-h-[320px]" : "max-h-[460px]",
          messages.length ? "border-t border-border pt-3" : "",
        )}
      >
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p
              key={i}
              className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-[13px] text-primary-foreground"
            >
              {m.text}
            </p>
          ) : (
            <div key={i} className="max-w-full text-[13px]">
              <Markdown>{m.text}</Markdown>
              {m.sources?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.sources.slice(0, 6).map((s, j) => (
                    <a
                      key={j}
                      href={s.uri}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-primary"
                    >
                      {s.title.slice(0, 34)}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ),
        )}
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      {!messages.length && suggestions.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about anime…"
          className="h-9 text-sm"
        />
        <Button
          type="submit"
          size="icon"
          className="h-9 w-9"
          disabled={loading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}

function Toggle({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof Globe;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}
