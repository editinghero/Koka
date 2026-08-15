import { useState } from "react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ExternalLink } from "lucide-react";
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

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          strong: ({ children }) => {
            const titleText = extractText(children).trim();
            const cleanTitle = titleText
              .replace(/^[:\s\-—]+|[:\s\-—]+$/g, "")
              .replace(/^["'#]+|["'#]+$/g, "");
            const isLabel =
              /^(note|summary|premise|themes|tone|overview|score|genre|status|format|warning|important|tip|caution|disclaimer|option \d+|season \d+|episodes?|chapters?):?$/i.test(
                cleanTitle,
              );
            const containsLink = hasLinkChild(children);

            return (
              <strong className="font-semibold text-foreground inline-flex items-center gap-0.5 flex-wrap">
                <span>{children}</span>
                {!containsLink &&
                !isLabel &&
                cleanTitle.length >= 2 &&
                cleanTitle.length <= 90 ? (
                  <CopyAnimeButton text={cleanTitle} />
                ) : null}
              </strong>
            );
          },
          a: ({ href, children }) => {
            const titleText = extractText(children);

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
                      {children}
                    </Link>
                    <CopyAnimeButton text={titleText} />
                  </span>
                );
              }

              // Non-numeric placeholder like /anime/ID - render cleanly without crashing link
              return (
                <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                  <span>{children}</span>
                  <CopyAnimeButton text={titleText} />
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
                    {children}
                  </Link>
                  <CopyAnimeButton text={titleText} />
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
                    {children}
                    <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                  </a>
                  <CopyAnimeButton text={titleText} />
                </span>
              );
            }

            return (
              <span className="inline-flex items-center gap-0.5">
                <span>{children}</span>
                <CopyAnimeButton text={titleText} />
              </span>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
