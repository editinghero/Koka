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
import {
  chatGemini,
  getSpoilerFreeSystem,
  SPOILER_FREE_SYSTEM,
  type ChatTurn,
} from "@/lib/gemini";
import {
  getAnimeChatHistory,
  getGlobalChatHistory,
  saveAnimeChatHistory,
  saveGlobalChatHistory,
  clearAnimeChatHistory,
  clearGlobalChatHistory,
} from "@/lib/chat-storage";
import {
  useLibrary,
  useMediaMode,
  useNotes,
  useSettings,
  useUserProfile,
} from "@/lib/store";
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
  const { settings } = useSettings();
  const { mode } = useMediaMode();
  const { library } = useLibrary();
  const { profile: userProfile } = useUserProfile();
  const { notes } = useNotes();
  const [spoilerFree, setSpoilerFree] = useState(
    defaultSpoilerFree && settings.spoilerFree
  );
  const [search, setSearch] = useState(true);
  const hasNotesAvailable = Boolean(notesContext || notes.length > 0);
  const [includeNotes, setIncludeNotes] = useState(Boolean(notesContext));
  const scroller = useRef<HTMLDivElement>(null);

  // Load chat history from localStorage after client hydration or when animeId changes
  useEffect(() => {
    const initial = animeId
      ? getAnimeChatHistory(animeId)
      : getGlobalChatHistory();
    // Older saved chats only have `text`; ChatPanel falls back to it when `parts` is missing.
    setMessages(initial as unknown as Msg[]);
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
      const isManga = mode === "MANGA";
      const baseSystem = isManga
        ? "You are Koka, a calm and knowledgeable manga reading assistant inside a personal manga reading dashboard. " +
          "Help the user explore manga, manhwa, manhua, and light novels, answer questions about chapters, volumes, publication status, suggest reading order, and keep track of what they read. " +
          "Answer in clean, compact markdown. Be direct and avoid filler. " +
          "When referencing any specific title from the user's library or given context that has a known numeric ID, format it as [Title Name](/anime/ID). " +
          "When recommending or discussing titles whose numeric ID is not known, write the title in bold (e.g. **Title Name**)."
        : BASE_SYSTEM;

      // Build rich user profile & taste context
      const userTasteContext =
        userProfile || library.length > 0
          ? `User Profile & Taste Context:
- User / Handle: ${userProfile?.name || settings.anilistUser || "User"}
- Library Size: ${library.length} titles (${library.filter((e) => e.status === "COMPLETED").length} completed, ${library.filter((e) => e.status === "CURRENT").length} currently ${isManga ? "reading" : "watching"})
- Favorite / Top-Rated: ${
              library
                .filter((e) => (e.score ?? 0) >= 8)
                .map((e) => e.media.title)
                .slice(0, 6)
                .join(", ") || "Diverse taste"
            }`
          : "";

      // Notes context
      const notesBlock = includeNotes
        ? `User's Personal Notes:
${notesContext ? `Notes for current title:\n${notesContext}\n` : ""}${
            notes.length > 0
              ? `Saved notes in user library:\n${notes
                  .slice(0, 15)
                  .map((n) => `• ${n.title}: ${n.body.slice(0, 140)}`)
                  .join("\n")}`
              : ""
          }`
        : "User notes: Not included.";

      // Spoiler status
      const spoilerBlock = spoilerFree
        ? getSpoilerFreeSystem(mode)
        : "SPOILERS ARE ALLOWED: The user explicitly turned spoilers ON. Feel free to openly discuss full endings, major plot twists, character deaths, and final outcomes.";

      const system = [
        baseSystem,
        userTasteContext,
        context ? `Title / Route Context:\n${context}` : "",
        notesBlock,
        spoilerBlock,
      ]
        .filter(Boolean)
        .join("\n\n");

      // Only pass getAnimeNote tool if search is disabled (Google Gemini API prohibits combining built-in search with function calling)
      const res = await chatGemini(
        next.map((m) => ({
          role: m.role,
          parts: m.parts ?? [{ text: m.text }],
        })),
        {
          system,
          search,
          ...(!search && allowNoteFetching ? { getAnimeNote } : {}),
        },
      );

      const newTurns: Msg[] = (res.newTurns ?? []).map((t) => ({
        ...t,
        text:
          t.parts
            ?.filter((p) => p.text)
            .map((p) => p.text)
            .join("") ?? "",
      }));

      // Find the final model response to append sources
      const lastTurn = newTurns[newTurns.length - 1];
      if (lastTurn && res.sources?.length) {
        lastTurn.sources = res.sources;
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
          {hasNotesAvailable ? (
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
                <Markdown copyAnimeTitles>{m.text ?? ""}</Markdown>
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
          aria-label="Send message"
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
