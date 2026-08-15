import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  NotebookPen,
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
import { useNotes } from "@/lib/store";
import { Markdown } from "./Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Msg = ChatTurn & { sources?: { title: string; uri: string }[] };

const BASE_SYSTEM =
  "You are Koka, a calm and knowledgeable anime assistant inside a personal anime dashboard. " +
  "Answer in clean, compact markdown. Be direct and avoid filler. " +
  "When referencing any specific anime/manga title from the user's library or given context that has a known numeric ID, format it as [Title Name](/anime/ID). " +
  "When recommending or discussing titles from the wider medium or web whose numeric ID is not known, write the title in bold (e.g. **Title Name**) or with an AniList link if known, and do NOT use placeholder IDs like /anime/ID.";

export function ChatPanel({
  title = "Ask Koka AI",
  description,
  context,
  notesContext,
  suggestions = [],
  defaultSpoilerFree = true,
  className,
  compact = false,
  animeId,
  allowNoteFetching = false,
}: {
  title?: string;
  description?: string;
  /** Extra grounding context injected into the system prompt. */
  context?: string | undefined;
  /** User's personal notes for this specific title. */
  notesContext?: string | undefined;
  suggestions?: string[];
  defaultSpoilerFree?: boolean;
  className?: string;
  compact?: boolean;
  /** Optional animeId for per-anime title chat persistence */
  animeId?: number;
  /** If true, the AI can call the getAnimeNote tool to fetch arbitrary notes from the user's library. */
  allowNoteFetching?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spoilerFree, setSpoilerFree] = useState(defaultSpoilerFree);
  const [search, setSearch] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(Boolean(notesContext));
  const scroller = useRef<HTMLDivElement>(null);
  const { notes } = useNotes();

  // Load chat history from localStorage after client hydration or when animeId changes
  useEffect(() => {
    const initial = animeId
      ? getAnimeChatHistory(animeId)
      : getGlobalChatHistory();
    setMessages(initial as Msg[]);
    setHydrated(true);
  }, [animeId]);

  // Sync message state changes to local storage only after initial hydration
  useEffect(() => {
    if (!hydrated) return;
    if (animeId) {
      saveAnimeChatHistory(animeId, messages as any);
    } else {
      saveGlobalChatHistory(messages as any);
    }
  }, [messages, animeId, hydrated]);

  function handleClear() {
    setMessages([]);
    setError(null);
    if (animeId) {
      clearAnimeChatHistory(animeId);
    } else {
      clearGlobalChatHistory();
    }
  }

  const getAnimeNote = useCallback(
    (targetTitle: string) => {
      const query = targetTitle.toLowerCase();
      const note = notes.find((n) => n.title.toLowerCase().includes(query));
      if (note) {
        return `Note for ${note.title}:\n\n${note.body}`;
      }
      return `No notes found for ${targetTitle}.`;
    },
    [notes],
  );

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [
      ...messages,
      { role: "user", parts: [{ text: q }], text: q },
    ];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const system = [
        BASE_SYSTEM,
        allowNoteFetching
          ? "You can use the `getAnimeNote` tool to fetch the user's personal notes for any specific anime or manga. Only call this if the user asks about their notes, or if checking their thoughts on a specific title is highly relevant to answering their question."
          : "",
        context ? `Context about the user:\n${context}` : "",
        includeNotes && notesContext
          ? `User's personal notes for this title:\n${notesContext}`
          : "",
        spoilerFree
          ? SPOILER_FREE_SYSTEM
          : "Spoilers are allowed — the user asked for full detail.",
      ]
        .filter(Boolean)
        .join("\n\n");
      const res = await chatGemini(
        next.map((m) => ({
          role: m.role,
          parts: m.parts ?? [{ text: m.text }],
        })),
        {
          system,
          search,
          getAnimeNote: allowNoteFetching ? getAnimeNote : undefined,
        },
      );

      const newTurns = (res.newTurns ?? []).map((t) => ({
        ...t,
        text:
          t.parts
            ?.filter((p) => p.text)
            .map((p) => p.text)
            .join("") ?? "",
      }));

      // Find the final model response to append sources
      if (newTurns.length > 0 && res.sources?.length) {
        newTurns[newTurns.length - 1].sources = res.sources;
      }

      setMessages([...next, ...newTurns]);
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
        <div className="flex flex-wrap items-center gap-1.5">
          {notesContext ? (
            <Toggle
              active={includeNotes}
              onClick={() => setIncludeNotes((n) => !n)}
              label={includeNotes ? "Notes on" : "Notes off"}
              icon={NotebookPen}
            />
          ) : null}
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
          "mt-3 flex-1 space-y-3 overflow-y-auto scrollbar-thin transition-all duration-200",
          compact
            ? "max-h-[320px] min-h-[120px]"
            : "max-h-[460px] min-h-[160px]",
          messages.length ? "border-t border-border pt-3" : "",
        )}
      >
        {messages
          .filter((m) => m.role === "user" || (m.role === "model" && m.text))
          .map((m, i) =>
            m.role === "user" ? (
              <p
                key={i}
                className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-[13px] text-primary-foreground"
              >
                {m.text}
              </p>
            ) : (
              <div key={i} className="max-w-full text-[13px]">
                <Markdown>{m.text ?? ""}</Markdown>
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
