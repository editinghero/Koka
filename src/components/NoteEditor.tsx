import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Link2,
  Code,
  CheckSquare,
  Eye,
  Pencil,
} from "lucide-react";
import { Markdown } from "./Markdown";
import { Button } from "@/components/ui/button";
import { useNotes } from "@/lib/store";
import { normalizeTags, type MediaType } from "@/lib/types";

const TOOLS = [
  { icon: Bold, label: "Bold", wrap: ["**", "**"] },
  { icon: Italic, label: "Italic", wrap: ["_", "_"] },
  { icon: Heading2, label: "Heading", wrap: ["\n## ", ""] },
  { icon: List, label: "Bullet list", wrap: ["\n- ", ""] },
  { icon: ListOrdered, label: "Numbered list", wrap: ["\n1. ", ""] },
  { icon: CheckSquare, label: "Task", wrap: ["\n- [ ] ", ""] },
  { icon: Quote, label: "Quote", wrap: ["\n> ", ""] },
  { icon: Code, label: "Code", wrap: ["`", "`"] },
  { icon: Link2, label: "Link", wrap: ["[", "](url)"] },
] as const;

export function NoteEditor({
  animeId,
  title,
  mediaType = "ANIME",
}: {
  animeId: number;
  title: string;
  mediaType?: MediaType;
}) {
  const { notes, saveNote } = useNotes(mediaType);
  const existing = notes.find((n) => n.animeId === animeId);
  const [body, setBody] = useState(existing?.body ?? "");
  const [tags, setTags] = useState((existing?.tags ?? []).join(", "));
  /** Notes open in reading mode; switch to Edit to write. */
  const [preview, setPreview] = useState(true);
  const ref = useRef<HTMLTextAreaElement>(null);
  const saved = useRef(existing?.body ?? "");

  useEffect(() => {
    setBody(existing?.body ?? "");
    saved.current = existing?.body ?? "";
    setTags((existing?.tags ?? []).join(", "));
    setPreview(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, mediaType]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (body === saved.current) return;
      saved.current = body;
      saveNote({
        animeId,
        mediaType,
        title,
        body,
        tags: normalizeTags(tags.split(",")),
        updatedAt: Date.now(),
      });
    }, 700);
    return () => clearTimeout(t);
  }, [body, tags, animeId, title, mediaType, saveNote]);

  function apply(before: string, after: string) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const next =
      body.slice(0, s) + before + body.slice(s, e) + after + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = s + before.length;
      el.selectionEnd = e + before.length;
    });
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.label}
            title={t.label}
            aria-label={t.label}
            onClick={() => apply(t.wrap[0], t.wrap[1])}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <t.icon className="h-3.5 w-3.5" />
          </button>
        ))}
        <div className="ml-auto">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? (
              <>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" /> Preview
              </>
            )}
          </Button>
        </div>
      </div>

      {preview ? (
        <div className="min-h-[220px] p-4">
          {body.trim() ? (
            <Markdown>{body}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing written yet.
            </p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            "## Thoughts\n\n- episode 4 was the turning point\n- [ ] rewatch the OP"
          }
          className="min-h-[220px] w-full resize-y bg-transparent p-4 font-mono text-[13px] leading-relaxed outline-none"
        />
      )}

      <div className="flex items-center gap-2 border-t border-border px-3 py-2">
        <span className="text-[11px] text-muted-foreground">Tags</span>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="comfort, rewatch, 2026"
          className="flex-1 bg-transparent text-xs outline-none"
        />
        <span className="text-[11px] text-muted-foreground">Autosaved</span>
      </div>
    </section>
  );
}
