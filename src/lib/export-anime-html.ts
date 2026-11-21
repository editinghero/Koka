import type { AnimeMedia, LibraryEntry, Note } from "./types";
import { toast } from "sonner";

/** Simple, reliable markdown to HTML converter for notes and synopsis */
function formatMarkdownToHtml(md: string): string {
  if (!md) return "";
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:1.15rem;font-weight:700;margin:1rem 0 0.5rem;color:var(--fg);">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:1.3rem;font-weight:700;margin:1.2rem 0 0.5rem;color:var(--fg);">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:1.5rem;font-weight:800;margin:1.4rem 0 0.6rem;color:var(--fg);">$1</h1>');

  // Dividers
  html = html.replace(/^---+$/gim, '<hr style="border:0;border-top:1px solid var(--border);margin:1.5rem 0;" />');

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.*?)~~/g, "<del>$1</del>");

  // Unordered lists
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom:0.35rem;padding-left:0.25rem;">$1</li>');
  html = html.replace(/(<li.*<\/li>)/gms, '<ul style="padding-left:1.5rem;margin:0.75rem 0;color:var(--fg);">$1</ul>');

  // Paragraphs
  const paragraphs = html.split(/\n{2,}/);
  return paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h1") ||
        trimmed.startsWith("<h2") ||
        trimmed.startsWith("<h3") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<hr")
      ) {
        return trimmed;
      }
      return `<p style="margin:0 0 0.85rem 0;line-height:1.65;">${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
}

function parseRgb(colorStr: string): [number, number, number] {
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return [18, 19, 22];
}

function getLuminance(rgb: [number, number, number]): number {
  const a = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * a[0]! + 0.7152 * a[1]! + 0.0722 * a[2]!;
}

export function exportAnimeAsHtml({
  media,
  entry,
  note,
}: {
  media: AnimeMedia;
  entry?: LibraryEntry | null;
  note?: Note | null;
}) {
  try {
    // Resolve active theme variables accurately from current document
    let bg = "#121316";
    let card = "#1c1e24";
    let fg = "#f2f4f8";
    let muted = "#949aa6";
    let primary = "#6fd6dc";
    let primaryFg = "#121316";
    let border = "rgba(255, 255, 255, 0.12)";
    let isDark = true;

    if (typeof document !== "undefined") {
      const probe = document.createElement("div");
      probe.style.display = "none";
      document.body.appendChild(probe);

      const resolveColor = (name: string, fallback: string): string => {
        try {
          probe.style.color = `var(${name})`;
          const computed = getComputedStyle(probe).color;
          if (computed && computed !== "rgba(0, 0, 0, 0)") return computed;
        } catch {}
        return fallback;
      };

      bg = resolveColor("--background", bg);
      card = resolveColor("--card", card);
      fg = resolveColor("--foreground", fg);
      muted = resolveColor("--muted-foreground", muted);
      primary = resolveColor("--primary", primary);
      primaryFg = resolveColor("--primary-foreground", primaryFg);
      border = resolveColor("--border", border);

      probe.remove();

      // Check luminance for dark vs light theme
      const bgRgb = parseRgb(bg);
      isDark = getLuminance(bgRgb) < 0.35;
    }

    const cleanSynopsis = media.description
      ? media.description.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
      : "No synopsis available.";

    const formattedSynopsisHtml = formatMarkdownToHtml(cleanSynopsis);
    const formattedNoteHtml = note?.body ? formatMarkdownToHtml(note.body) : "";

    const userScore = entry?.score !== undefined && entry?.score !== null ? entry.score : null;
    const userScoreDisplay = userScore !== null ? userScore.toFixed(userScore % 1 === 0 ? 0 : 1) : "—";
    const communityScore = media.meanScore ? `${media.meanScore}%` : "—";

    const statusDisplay = entry?.status
      ? entry.status.replace("_", " ").toLowerCase()
      : "Not in list";

    const titleSlug = media.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const exportDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>${media.title} — Koka</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: ${bg};
      --card: ${card};
      --fg: ${fg};
      --muted: ${muted};
      --primary: ${primary};
      --primary-fg: ${primaryFg};
      --border: ${border};
      --radius: 22px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px 48px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    /* Ambient background glow for genuine glassmorphism refraction */
    .ambient-glow {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 0;
      background:
        radial-gradient(circle 800px at 85% 15%, color-mix(in srgb, var(--primary) ${isDark ? "32%" : "20%"}, transparent), transparent 70%),
        radial-gradient(circle 600px at 15% 75%, color-mix(in srgb, var(--card) ${isDark ? "40%" : "25%"}, transparent), transparent 60%);
    }

    .container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 860px;
      margin: 0 auto;
    }

    /* Floating Glass Card with modern blur & specular sheen */
    .glass-card {
      background: color-mix(in srgb, var(--card) ${isDark ? "62%" : "78%"}, transparent);
      backdrop-filter: blur(32px) saturate(180%);
      -webkit-backdrop-filter: blur(32px) saturate(180%);
      border: 1px solid color-mix(in srgb, var(--border) 75%, rgba(255,255,255, ${isDark ? "0.2" : "0.6"}));
      border-radius: var(--radius);
      box-shadow:
        0 24px 64px -16px rgba(0, 0, 0, ${isDark ? "0.45" : "0.14"}),
        inset 0 1px 1px 0 rgba(255, 255, 255, ${isDark ? "0.20" : "0.60"});
      overflow: hidden;
      margin-bottom: 24px;
    }

    /* Hero Banner */
    .hero-banner {
      position: relative;
      width: 100%;
      height: 240px;
      overflow: hidden;
      background: color-mix(in srgb, var(--card) 90%, black);
    }

    .hero-banner img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center 25%;
    }

    .banner-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, var(--bg) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.2) 100%);
    }

    .card-content {
      padding: 0 28px 32px;
      position: relative;
      margin-top: -75px;
    }

    .header-layout {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    @media (min-width: 640px) {
      .header-layout {
        flex-direction: row;
        align-items: flex-start;
      }
    }

    /* Cover Art */
    .cover-box {
      width: 170px;
      height: 245px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 16px 36px rgba(0,0,0, ${isDark ? "0.55" : "0.22"});
      border: 2px solid rgba(255, 255, 255, ${isDark ? "0.25" : "0.8"});
      background: color-mix(in srgb, var(--card) 90%, black);
      flex-shrink: 0;
    }

    .cover-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .title-info {
      flex: 1;
      min-width: 0;
      padding-top: 10px;
    }

    .pill-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    .pill {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 4px 10px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--card) 75%, rgba(255,255,255,0.08));
      border: 1px solid var(--border);
      color: var(--muted);
    }

    .pill.format {
      background: color-mix(in srgb, var(--primary) 18%, transparent);
      color: var(--primary);
      border-color: color-mix(in srgb, var(--primary) 35%, transparent);
    }

    h1.anime-title {
      font-family: "Outfit", sans-serif;
      font-size: 1.85rem;
      font-weight: 800;
      line-height: 1.25;
      color: var(--fg);
      margin-bottom: 6px;
      word-break: break-word;
    }

    .sub-titles {
      font-size: 0.85rem;
      color: var(--muted);
      margin-bottom: 18px;
    }

    /* ── BIG USER RATING SHOWCASE ── */
    .rating-showcase {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;
      margin: 18px 0 20px;
      padding: 18px;
      border-radius: 18px;
      background: color-mix(in srgb, var(--card) 48%, rgba(255,255,255,0.04));
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid color-mix(in srgb, var(--primary) 35%, rgba(255,255,255,0.18));
      box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.15);
    }

    .rating-box.user-rating {
      border-right: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
      padding-right: 14px;
    }

    .rating-label {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin-bottom: 4px;
    }

    .rating-label.highlight {
      color: var(--primary);
    }

    .big-score {
      font-family: "Outfit", sans-serif;
      font-size: 2.4rem;
      font-weight: 800;
      line-height: 1;
      color: var(--primary);
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .big-score .star {
      font-size: 1.9rem;
    }

    .big-score .scale {
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--muted);
    }

    .secondary-score {
      font-family: "Outfit", sans-serif;
      font-size: 1.45rem;
      font-weight: 700;
      color: var(--fg);
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      font-weight: 600;
      text-transform: capitalize;
      color: var(--fg);
      margin-top: 8px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--primary);
    }

    /* Section Blocks */
    .section-block {
      margin-top: 24px;
      padding-top: 22px;
      border-top: 1px solid var(--border);
    }

    .section-heading {
      font-family: "Outfit", sans-serif;
      font-size: 0.9rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .synopsis-text {
      font-size: 0.95rem;
      color: var(--fg);
      line-height: 1.7;
    }

    /* User Personal Notes Box with Frosted Glass */
    .notes-box {
      margin-top: 24px;
      padding: 22px;
      border-radius: 18px;
      background: color-mix(in srgb, var(--card) 50%, rgba(255,255,255,0.04));
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid color-mix(in srgb, var(--border) 65%, rgba(255,255,255,0.15));
      box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.12);
    }

    .notes-heading {
      font-family: "Outfit", sans-serif;
      font-size: 0.85rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--primary);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .notes-content {
      font-size: 0.92rem;
      color: var(--fg);
      line-height: 1.65;
    }

    .empty-note {
      font-size: 0.85rem;
      font-style: italic;
      color: var(--muted);
    }

    /* Footer */
    footer.card-footer {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
      text-align: center;
      font-size: 0.78rem;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .koka-brand {
      font-family: "Outfit", sans-serif;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: var(--primary);
      text-transform: uppercase;
    }

    /* ── Mobile Responsiveness (< 640px) ── */
    @media (max-width: 639px) {
      body {
        padding: 12px 10px 36px;
      }
      .glass-card {
        border-radius: 20px;
      }
      .hero-banner {
        height: 180px;
      }
      .card-content {
        padding: 0 16px 24px;
        margin-top: -55px;
      }
      .header-layout {
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .cover-box {
        width: 145px;
        height: 210px;
        margin: 0 auto;
      }
      .pill-row {
        justify-content: center;
      }
      .anime-title {
        font-size: 1.45rem;
      }
      .rating-showcase {
        grid-template-columns: 1fr;
        gap: 14px;
        padding: 14px;
      }
      .rating-box.user-rating {
        border-right: none;
        border-bottom: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
        padding-right: 0;
        padding-bottom: 14px;
      }
      .big-score {
        justify-content: center;
        font-size: 2.2rem;
      }
      .status-badge {
        justify-content: center;
      }
      .secondary-score {
        justify-content: center;
      }
      .section-heading {
        justify-content: center;
      }
      .notes-heading {
        justify-content: center;
      }
      .card-footer {
        flex-direction: column;
        gap: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="ambient-glow"></div>

  <div class="container">
    <div class="glass-card">
      <!-- Banner image -->
      <div class="hero-banner">
        ${media.banner ? `<img src="${media.banner}" alt="${media.title}" referrerpolicy="no-referrer">` : ""}
        <div class="banner-overlay"></div>
      </div>

      <div class="card-content">
        <div class="header-layout">
          <!-- Cover Box -->
          <div class="cover-box">
            ${media.cover ? `<img src="${media.cover}" alt="${media.title}" referrerpolicy="no-referrer">` : ""}
          </div>

          <!-- Main Info -->
          <div class="title-info">
            <div class="pill-row">
              <span class="pill format">${media.format || "ANIME"}</span>
              ${media.status ? `<span class="pill">${media.status.replace("_", " ")}</span>` : ""}
              ${media.seasonYear ? `<span class="pill">${media.season ? `${media.season} ` : ""}${media.seasonYear}</span>` : ""}
              ${media.episodes ? `<span class="pill">${media.episodes} EPS</span>` : ""}
            </div>

            <h1 class="anime-title">${media.title}</h1>
            ${media.englishTitle && media.englishTitle !== media.title ? `<div class="sub-titles">${media.englishTitle}</div>` : ""}

            <!-- Big User Rating & Community Score Showcase -->
            <div class="rating-showcase">
              <div class="rating-box user-rating">
                <div class="rating-label highlight">Your Rating</div>
                <div class="big-score">
                  <span class="star">★</span> ${userScoreDisplay}
                  ${userScore !== null ? `<span class="scale">/10</span>` : ""}
                </div>
                <div class="status-badge">
                  <span class="status-dot"></span>
                  <span>${statusDisplay}${entry?.progress ? ` (${entry.progress}${media.episodes ? `/${media.episodes}` : ""} eps)` : ""}</span>
                </div>
              </div>

              <div class="rating-box">
                <div class="rating-label">Community Score</div>
                <div class="secondary-score">
                  <span>★</span> ${communityScore}
                </div>
                ${media.genres?.length ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:8px;">${media.genres.slice(0, 3).join(" · ")}</div>` : ""}
              </div>
            </div>
          </div>
        </div>

        <!-- Synopsis -->
        <div class="section-block">
          <div class="section-heading">Synopsis</div>
          <div class="synopsis-text">${formattedSynopsisHtml}</div>
        </div>

        <!-- Personal Notes Section -->
        <div class="notes-box">
          <div class="notes-heading">
            <span>📝</span> Your Personal Notes
          </div>
          <div class="notes-content">
            ${formattedNoteHtml || `<div class="empty-note">No personal notes written for this title yet.</div>`}
          </div>
        </div>

        <footer class="card-footer">
          <span class="koka-brand">koka.pages.dev</span>
          <span>Shared on ${exportDate}</span>
        </footer>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const fileName = `${titleSlug || "anime"}-koka-card.html`;

    // Auto-save download directly
    triggerDownload(blob, fileName);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to generate HTML card.");
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast.success(`HTML card saved as "${fileName}"`);
}
