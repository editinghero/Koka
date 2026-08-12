import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href && href.startsWith("/anime/")) {
              const id = href.replace("/anime/", "");
              return (
                <Link
                  to="/anime/$id"
                  params={{ id }}
                  className="font-semibold text-primary underline hover:text-primary/80"
                >
                  {children}
                </Link>
              );
            }
            if (href) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {children}
                </a>
              );
            }
            return <span>{children}</span>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
