import { useState } from "react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ExternalLink, ChevronRight } from "lucide-react";
import { toast } from "sonner";

function extractText(children: React.ReactNode): string {
  if (!children) return "";
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(extractText).join("");
  if (
    typeof children === "object" &&
    children !== null &&
    "props" in children
  ) {
    return extractText(
      (children as { props: { children?: React.ReactNode } }).props.children,
    );
  }
  return String(children);
}

function CopyAnimeButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const cleanTitle = text.trim().replace(/^["'#]+|["'#]+$/g, "");

  if (!cleanTitle) return null;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void navigator.clipboard.writeText(cleanTitle);
        setCopied(true);
        toast.success(`Copied "${cleanTitle}" — paste in search bar (⌘K)`);
        setTimeout(() => setCopied(false), 1800);
      }}
      title={`Copy "${cleanTitle}" to search`}
      className="inline-flex items-center ml-1 p-0.5 rounded text-muted-foreground/70 hover:text-primary hover:bg-secondary transition-colors align-middle"
      aria-label={`Copy ${cleanTitle}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-success animate-in zoom-in-50" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function hasLinkChild(children: React.ReactNode): boolean {
  if (!children) return false;
  if (Array.isArray(children)) return children.some(hasLinkChild);
  if (typeof children === "object" && children !== null && "type" in children) {
    const el = children as {
      type?: unknown;
      props?: { href?: string; children?: React.ReactNode };
    };
    if (el.type === "a" || el.props?.href) return true;
    if (el.props?.children) return hasLinkChild(el.props.children);
  }
  return false;
}

/** Preprocesses notes to handle CRLF, loose bold/italic syntax, line breaks, HTML tags, and CJK emphasis flanking. */
function preprocessMarkdown(text: string): string {
  if (!text) return "";
  let out = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Preserve multiple consecutive <br> tags as visible empty lines
  out = out.replace(/(?:<br\s*\/?>\s*){2,}/gi, (m) => {
    const count = (m.match(/<br/gi) || []).length;
    return "\n\n" + "&nbsp;\n\n".repeat(count - 1);
  });
  // Single <br> becomes a hard line break
  out = out.replace(/<br\s*\/?>/gi, "  \n");

  // Preserve multiple consecutive blank lines (prevent collapsing into a single paragraph)
  out = out.replace(/\n{3,}/g, (m) => "\n\n" + "&nbsp;\n\n".repeat(m.length - 2));

  // Normalize common HTML tags from AniList / MAL exports to Markdown equivalents
  out = out.replace(/<\/?(b|strong)>/gi, "**");
  out = out.replace(/<\/?(i|em)>/gi, "*");
  out = out.replace(/<\/?(s|strike|del)>/gi, "~~");

  // Fix loose bold/italic asterisks with inner whitespace like `*** something ***` or `** something **`
  out = out.replace(/(?<!\*)\*\*\*\s*([^\*\n]+?)\s*\*\*\*(?!\*)/g, "***$1***");
  out = out.replace(/(?<!\*)\*\*\s*([^\*\n]+?)\s*\*\*(?!\*)/g, "**$1**");
  out = out.replace(
    /(?<!\*)\*\s*([^\*\s\n](?:[^\*\n]*?[^\*\s\n])?)\s*\*(?!\*)/g,
    "*$1*",
  );

  // Fix loose underscore emphasis with inner whitespace like `___ something ___` or `__ something __`
  out = out.replace(/(?<!_)___\s*([^_\n]+?)\s*___(?!_)/g, "***$1***");
  out = out.replace(/(?<!_)__\s*([^_\n]+?)\s*__(?!_)/g, "**$1**");
  out = out.replace(
    /(?<!_)_\s*([^_\s\n](?:[^_\n]*?[^_\s\n])?)\s*_(?!_)/g,
    "*$1*",
  );

  // CJK emphasis flanking fix: CommonMark fails to parse _ surrounding CJK characters
  out = out.replace(
    /(?<=^|[\s\p{P}\p{S}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])_([^\s_]+?)_(?=[\s\p{P}\p{S}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|$)/gu,
    "*$1*",
  );

  return out;
}

type ContentSegment =
  | { type: "markdown"; content: string }
  | { type: "details"; summary: string; body: string };

function parseDetailsSegments(text: string): ContentSegment[] {
  const detailsRegex = /<details\b[^>]*>([\s\S]*?)<\/details>/gi;
  if (!detailsRegex.test(text)) {
    return [{ type: "markdown", content: text }];
  }
  detailsRegex.lastIndex = 0;

  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = detailsRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "markdown",
        content: text.slice(lastIndex, match.index),
      });
    }

    const fullInner = match[1];
    const summaryMatch = fullInner.match(
      /<summary\b[^>]*>([\s\S]*?)<\/summary>/i,
    );
    const summary = summaryMatch ? summaryMatch[1].trim() : "Details";
    const body = summaryMatch
      ? fullInner.replace(summaryMatch[0], "").trim()
      : fullInner.trim();

    segments.push({
      type: "details",
      summary,
      body,
    });

    lastIndex = detailsRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: "markdown",
      content: text.slice(lastIndex),
    });
  }

  return segments;
}

/** Remark plugin to treat single line breaks in text nodes as hard breaks (<br/>). */
function remarkBreaksPlugin() {
  return (tree: { children?: unknown[] }) => {
    function visit(node: {
      type?: string;
      value?: string;
      children?: unknown[];
    }) {
      if (!node.children || !Array.isArray(node.children)) return;
      if (
        node.type === "code" ||
        node.type === "inlineCode" ||
        node.type === "table" ||
        node.type === "tableRow" ||
        node.type === "tableCell"
      ) {
        return;
      }
      const nextChildren: unknown[] = [];
      for (const child of node.children as Array<{
        type?: string;
        value?: string;
      }>) {
        if (
          child.type === "text" &&
          typeof child.value === "string" &&
          child.value.includes("\n")
        ) {
          const parts = child.value.split("\n");
          for (let i = 0; i < parts.length; i++) {
            if (parts[i]) nextChildren.push({ type: "text", value: parts[i] });
            if (i < parts.length - 1) nextChildren.push({ type: "break" });
          }
        } else {
          visit(
            child as { type?: string; value?: string; children?: unknown[] },
          );
          nextChildren.push(child);
        }
      }
      node.children = nextChildren;
    }
    visit(tree);
  };
}

export interface MarkdownProps {
  children: string;
  copyAnimeTitles?: boolean;
}

export function Markdown({ children, copyAnimeTitles = false }: MarkdownProps) {
  const segments = parseDetailsSegments(children || "");

  const components = {
    table: ({
      children: tableChildren,
      ...props
    }: React.ComponentPropsWithoutRef<"table">) => (
      <div className="overflow-x-auto max-w-full my-2">
        <table {...props}>{tableChildren}</table>
      </div>
    ),
    em: ({ children: emChildren }: React.ComponentPropsWithoutRef<"em">) => (
      <em className="italic">{emChildren}</em>
    ),
    strong: ({
      children: strongChildren,
    }: React.ComponentPropsWithoutRef<"strong">) => {
      if (!copyAnimeTitles) {
        return (
          <strong className="font-semibold text-foreground">
            {strongChildren}
          </strong>
        );
      }

      const titleText = extractText(strongChildren).trim();
      const cleanTitle = titleText
        .replace(/^[:\s\-—]+|[:\s\-—]+$/g, "")
        .replace(/^["'#]+|["'#]+$/g, "");
      const isLabel =
        /^(note|summary|premise|themes|tone|overview|score|genre|status|format|warning|important|tip|caution|disclaimer|option \d+|season \d+|episodes?|chapters?):?$/i.test(
          cleanTitle,
        );
      const containsLink = hasLinkChild(strongChildren);

      return (
        <strong className="font-semibold text-foreground inline-flex items-center gap-0.5 flex-wrap">
          <span>{strongChildren}</span>
          {!containsLink &&
          !isLabel &&
          cleanTitle.length >= 2 &&
          cleanTitle.length <= 90 ? (
            <CopyAnimeButton text={cleanTitle} />
          ) : null}
        </strong>
      );
    },
    a: ({
      href,
      children: linkChildren,
    }: React.ComponentPropsWithoutRef<"a">) => {
      const titleText = extractText(linkChildren);

      // Handle internal /anime/ID links
      if (href && href.startsWith("/anime/")) {
        const rawId = href.replace("/anime/", "").trim();
        const isNumeric = /^\d+$/.test(rawId);

        if (isNumeric) {
          return (
            <span className="inline-flex items-center gap-0.5">
              <Link
                to="/anime/$id"
                params={{ id: rawId }}
                className="font-semibold text-primary underline hover:text-primary/80"
              >
                {linkChildren}
              </Link>
              {copyAnimeTitles && <CopyAnimeButton text={titleText} />}
            </span>
          );
        }

        return (
          <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
            <span>{linkChildren}</span>
            {copyAnimeTitles && <CopyAnimeButton text={titleText} />}
          </span>
        );
      }

      // Handle AniList URL e.g. https://anilist.co/anime/16498
      const anilistMatch = href?.match(/anilist\.co\/anime\/(\d+)/i);
      if (anilistMatch?.[1]) {
        return (
          <span className="inline-flex items-center gap-0.5">
            <Link
              to="/anime/$id"
              params={{ id: anilistMatch[1] }}
              className="font-semibold text-primary underline hover:text-primary/80"
            >
              {linkChildren}
            </Link>
            {copyAnimeTitles && <CopyAnimeButton text={titleText} />}
          </span>
        );
      }

      if (href) {
        return (
          <span className="inline-flex items-center gap-0.5">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline inline-flex items-center gap-0.5"
            >
              {linkChildren}
              <ExternalLink className="h-2.5 w-2.5 opacity-70" />
            </a>
            {copyAnimeTitles && <CopyAnimeButton text={titleText} />}
          </span>
        );
      }

      return (
        <span className="inline-flex items-center gap-0.5">
          <span>{linkChildren}</span>
          {copyAnimeTitles && <CopyAnimeButton text={titleText} />}
        </span>
      );
    },
  };

  return (
    <div className="md-body space-y-1">
      {segments.map((segment, idx) => {
        if (segment.type === "markdown") {
          const processed = preprocessMarkdown(segment.content);
          if (!processed.trim()) return null;
          return (
            <ReactMarkdown
              key={idx}
              remarkPlugins={[remarkGfm, remarkBreaksPlugin]}
              components={components}
            >
              {processed}
            </ReactMarkdown>
          );
        }

        const summaryProcessed = preprocessMarkdown(segment.summary);
        const bodyProcessed = preprocessMarkdown(segment.body);

        return (
          <details
            key={idx}
            className="my-2.5 rounded-lg border border-border/80 bg-secondary/30 p-2.5 sm:p-3 transition-colors open:bg-secondary/50 group"
          >
            <summary className="cursor-pointer font-medium text-xs sm:text-sm text-foreground hover:text-primary transition-colors select-none py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-primary flex items-center gap-1.5 list-none [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-open:rotate-90 transition-transform duration-200 shrink-0" />
              <span>{summaryProcessed || "Details"}</span>
            </summary>
            {bodyProcessed && (
              <div className="mt-2 pl-3 border-l-2 border-primary/30 pt-1 text-xs sm:text-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaksPlugin]}
                  components={components}
                >
                  {bodyProcessed}
                </ReactMarkdown>
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
