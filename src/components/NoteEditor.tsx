import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Sparkles,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Code2,
  Link2,
  Table,
  Minus,
  CornerDownLeft,
  ListCollapse,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { Markdown } from "./Markdown";
import { Button } from "@/components/ui/button";
import { useNotes } from "@/lib/store";
import { normalizeTags, type MediaType } from "@/lib/types";
import { toast } from "sonner";

interface ToolItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  wrap: [string, string];
  defaultText?: string;
}

const TOOL_GROUPS: { name: string; tools: ToolItem[] }[] = [
  {
    name: "Text style",
    tools: [
      { icon: Bold, label: "Bold (**text**)", wrap: ["**", "**"], defaultText: "bold text" },
      { icon: Italic, label: "Italic (_text_)", wrap: ["_", "_"], defaultText: "italic text" },
      { icon: Sparkles, label: "Bold & Italic (***text***)", wrap: ["***", "***"], defaultText: "bold italic" },
      { icon: Strikethrough, label: "Strikethrough (~~text~~)", wrap: ["~~", "~~"], defaultText: "strike text" },
      { icon: Code, label: "Inline code (`code`)", wrap: ["`", "`"], defaultText: "code" },
    ],
  },
  {
    name: "Headings",
    tools: [
      { icon: Heading1, label: "Heading 1 (# title)", wrap: ["\n# ", "\n"], defaultText: "Heading 1" },
      { icon: Heading2, label: "Heading 2 (## title)", wrap: ["\n## ", "\n"], defaultText: "Heading 2" },
      { icon: Heading3, label: "Heading 3 (### title)", wrap: ["\n### ", "\n"], defaultText: "Heading 3" },
    ],
  },
  {
    name: "Lists",
    tools: [
      { icon: List, label: "Bullet list (- item)", wrap: ["\n- ", ""], defaultText: "List item" },
      { icon: ListOrdered, label: "Numbered list (1. item)", wrap: ["\n1. ", ""], defaultText: "List item" },
      { icon: CheckSquare, label: "Task checklist (- [ ] task)", wrap: ["\n- [ ] ", ""], defaultText: "Task" },
    ],
  },
  {
    name: "Blocks & Structure",
    tools: [
      { icon: Quote, label: "Quote (> quote)", wrap: ["\n> ", "\n"], defaultText: "Quote text" },
      { icon: Code2, label: "Code block (```)", wrap: ["\n```\n", "\n```\n"], defaultText: "code block" },
      {
        icon: Table,
        label: "Table",
        wrap: ["\n\n| Column 1 | Column 2 |\n| :--- | :--- |\n| Item 1 | Item 2 |\n\n", ""],
      },
      { icon: Minus, label: "Divider line (---)", wrap: ["\n\n---\n\n", ""] },
      { icon: CornerDownLeft, label: "Line break (<br>)", wrap: ["<br>\n", ""] },
    ],
  },
  {
    name: "Interactive",
    tools: [
      { icon: Link2, label: "Link ([text](url))", wrap: ["[", "](https://)"], defaultText: "link text" },
      {
        icon: ListCollapse,
        label: "Spoiler / Summary (<details><summary>)",
        wrap: ["\n<details>\n<summary>Spoiler</summary>\n\n", "\n</details>\n"],
        defaultText: "Hidden spoiler notes...",
      },
    ],
  },
];

export function NoteEditor({
  animeId,
  title,
  mediaType = "ANIME",
}: {
  animeId: number;
  title: string;
  mediaType?: MediaType;
}) {
  const { notes, saveNote, removeNote } = useNotes(mediaType);
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

  function apply(before: string, after: string, defaultText = "") {
    if (preview) {
      setPreview(false);
      setTimeout(() => {
        const el = ref.current;
        if (!el) return;
        const s = body.length;
        const insertText = defaultText || "";
        const cleanBefore =
          s > 0 && !body.endsWith("\n") && before.startsWith("\n")
            ? "\n" + before.trimStart()
            : before;
        const next = body + cleanBefore + insertText + after;
        setBody(next);
        requestAnimationFrame(() => {
          el.focus();
          el.selectionStart = s + cleanBefore.length;
          el.selectionEnd = s + cleanBefore.length + insertText.length;
        });
      }, 50);
      return;
    }

    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = body.slice(s, e);
    const inner = selected || defaultText;

    // Clean leading newline if at start of textarea
    let effectiveBefore = before;
    if (s === 0 && effectiveBefore.startsWith("\n")) {
      effectiveBefore = effectiveBefore.replace(/^\n+/, "");
    }

    const next =
      body.slice(0, s) + effectiveBefore + inner + after + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      if (selected) {
        el.selectionStart = s + effectiveBefore.length;
        el.selectionEnd = s + effectiveBefore.length + inner.length;
      } else if (defaultText) {
        el.selectionStart = s + effectiveBefore.length;
        el.selectionEnd = s + effectiveBefore.length + defaultText.length;
      } else {
        el.selectionStart = s + effectiveBefore.length;
        el.selectionEnd = s + effectiveBefore.length;
      }
    });
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5 bg-secondary/20">
        {TOOL_GROUPS.map((group, gIdx) => (
          <div key={group.name} className="flex items-center gap-0.5">
            {group.tools.map((t) => (
              <button
                key={t.label}
                type="button"
                title={t.label}
                aria-label={t.label}
                onClick={() => apply(t.wrap[0], t.wrap[1], t.defaultText)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-secondary hover:text-foreground active:scale-90"
              >
                <t.icon className="h-3.5 w-3.5" />
              </button>
            ))}
            {gIdx < TOOL_GROUPS.length - 1 && (
              <div className="mx-1 h-3.5 w-px bg-border/60" />
            )}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1">
          {existing && (existing.body.trim() || existing.tags.length) ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
              title="Delete note"
              onClick={() => {
                if (confirm(`Delete note for "${title}"?`)) {
                  removeNote(animeId, mediaType);
                  setBody("");
                  setTags("");
                  saved.current = "";
                  toast.success("Note deleted");
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
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
