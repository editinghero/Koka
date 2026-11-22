import type { AnimeMedia, LibraryEntry, Note } from "./types";
import { toast } from "sonner";

function formatInlineMarkdown(text: string): string {
  if (!text) return "";
  let out = text;

  // Protect and parse links: [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="md-link">$1</a>',
  );

  // Images: ![alt](url)
  out = out.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="md-img" loading="lazy" />',
  );

  // Spoilers: ~!text!~ or ||text||
  out = out.replace(/(?:~!(.*?)!~|\|\|(.*?)\|\|)/g, (_, s1, s2) => {
    const content = s1 !== undefined ? s1 : s2;
    return `<span class="md-spoiler" title="Click to reveal spoiler" onclick="this.classList.toggle('revealed')">${content}</span>`;
  });

  // Inline code: `code`
  out = out.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

  // Bold & Italic (supporting CommonMark and loose spacing)
  out = out.replace(/\*\*\*([^\*\n]+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  out = out.replace(/___([^_\n]+?)___/g, "<strong><em>$1</em></strong>");
  out = out.replace(/\*\*([^\*\n]+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_\n]+?)__/g, "<strong>$1</strong>");
  out = out.replace(/\*([^\*\n]+?)\*/g, "<em>$1</em>");
  out = out.replace(/_([^_\n]+?)_/g, "<em>$1</em>");
  out = out.replace(/~~([^~\n]+?)~~/g, "<del>$1</del>");

  return out;
}

function renderTable(lines: string[]): string {
  const parseRow = (rowStr: string) =>
    rowStr
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const headerCells = parseRow(lines[0] ?? "");
  const separatorCells = parseRow(lines[1] ?? "");

  const alignments = separatorCells.map((sep) => {
    if (sep.startsWith(":") && sep.endsWith(":")) return "center";
    if (sep.endsWith(":")) return "right";
    return "left";
  });

  let html = '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
  headerCells.forEach((c, i) => {
    const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : "";
    html += `<th${align}>${formatInlineMarkdown(c)}</th>`;
  });
  html += "</tr></thead><tbody>";

  for (let i = 2; i < lines.length; i++) {
    const cells = parseRow(lines[i] ?? "");
    html += "<tr>";
    cells.forEach((c, idx) => {
      const align = alignments[idx]
        ? ` style="text-align:${alignments[idx]}"`
        : "";
      html += `<td${align}>${formatInlineMarkdown(c)}</td>`;
    });
    html += "</tr>";
  }

  html += "</tbody></table></div>";
  return html;
}

function renderList(lines: string[]): string {
  const isOrdered = /^\s*\d+\.\s+/.test(lines[0] ?? "");
  const tag = isOrdered ? "ol" : "ul";
  const cls = isOrdered ? "md-ol" : "md-ul";

  let html = `<${tag} class="${cls}">\n`;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Task list items: - [ ] or - [x]
    const taskMatch = trimmed.match(/^[*\-+]?\s*\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      const isChecked = (taskMatch[1] ?? "").toLowerCase() === "x";
      const taskBody = formatInlineMarkdown(taskMatch[2] ?? "");
      html += `  <li class="md-task-item${isChecked ? " md-task-checked" : ""}"><span class="md-checkbox${isChecked ? " checked" : ""}">${isChecked ? "✓" : ""}</span><span>${taskBody}</span></li>\n`;
      continue;
    }

    // Normal list item
    const itemMatch = trimmed.match(/^(?:[*\-+]|\d+\.)\s+(.*)$/);
    const itemText = itemMatch ? itemMatch[1] : trimmed;
    html += `  <li class="md-li">${formatInlineMarkdown(itemText ?? "")}</li>\n`;
  }
  html += `</${tag}>`;
  return html;
}

/** Comprehensive, rock-solid markdown & custom summary/synopsis converter */
function formatMarkdownToHtml(md: string): string {
  if (!md) return "";
  let text = md.replace(/\r\n/g, "\n");

  // Step 1: Extract and placeholder fenced code blocks
  const codeBlocks: string[] = [];
  text = text.replace(
    /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,
    (_, lang, code) => {
      const idx = codeBlocks.length;
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      codeBlocks.push(
        `<div class="md-code-block"><div class="md-code-header"><span class="md-code-lang">${lang || "code"}</span></div><pre class="md-pre"><code class="md-code">${escaped.trim()}</code></pre></div>`,
      );
      return `\n\n%%CODE_BLOCK_${idx}%%\n\n`;
    },
  );

  // Step 2: Extract and placeholder <details><summary> blocks (custom summary, synopsis, spoilers)
  const detailsBlocks: string[] = [];
  const detailsRegex = /<details\b([^>]*)>([\s\S]*?)<\/details>/gi;
  text = text.replace(detailsRegex, (_, attrs, inner) => {
    const idx = detailsBlocks.length;
    const isOpen = /\bopen\b/i.test(attrs);
    const summaryMatch = inner.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i);
    const summaryRaw = summaryMatch
      ? summaryMatch[1].trim()
      : "Details / Summary";
    const bodyRaw = summaryMatch
      ? inner.replace(summaryMatch[0], "").trim()
      : inner.trim();

    const summaryHtml = formatInlineMarkdown(summaryRaw);
    const bodyHtml = formatMarkdownToHtml(bodyRaw);

    detailsBlocks.push(
      `<details class="md-details"${isOpen ? " open" : ""}>` +
        `<summary class="md-summary">` +
        `<svg class="md-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
        `<polyline points="9 18 15 12 9 6"></polyline>` +
        `</svg>` +
        `<span class="md-summary-title">${summaryHtml}</span>` +
        `</summary>` +
        `<div class="md-details-body">${bodyHtml}</div>` +
        `</details>`,
    );
    return `\n\n%%DETAILS_BLOCK_${idx}%%\n\n`;
  });

  // Normalize divider spacing so preceding paragraphs do not leave huge whitespace
  text = text.replace(/\n\s*---\s*\n/g, "\n\n---\n\n");

  // Step 3: Split into blocks
  const rawBlocks = text.split(/\n{2,}/);
  const renderedBlocks: string[] = [];

  for (const block of rawBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Check placeholders
    if (/^%%CODE_BLOCK_\d+%%$/.test(trimmed)) {
      const idx = Number(trimmed.replace(/\D/g, ""));
      renderedBlocks.push(codeBlocks[idx] || "");
      continue;
    }
    if (/^%%DETAILS_BLOCK_\d+%%$/.test(trimmed)) {
      const idx = Number(trimmed.replace(/\D/g, ""));
      renderedBlocks.push(detailsBlocks[idx] || "");
      continue;
    }

    // Horizontal Rule (divider)
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      renderedBlocks.push('<hr class="md-hr" />');
      continue;
    }

    // Headings (# H1 to ###### H6)
    const hMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (hMatch) {
      const level = hMatch[1]?.length ?? 1;
      const content = formatInlineMarkdown(hMatch[2] ?? "");
      renderedBlocks.push(
        `<h${level} class="md-h${level}">${content}</h${level}>`,
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith(">")) {
      const quoteText = trimmed
        .split("\n")
        .map((l) => l.replace(/^>\s?/, ""))
        .join("\n");
      renderedBlocks.push(
        `<blockquote class="md-quote">${formatMarkdownToHtml(quoteText)}</blockquote>`,
      );
      continue;
    }

    // Table
    if (trimmed.includes("|") && trimmed.includes("\n")) {
      const lines = trimmed
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length >= 2 && lines[1]?.includes("-")) {
        const tableHtml = renderTable(lines);
        if (tableHtml) {
          renderedBlocks.push(tableHtml);
          continue;
        }
      }
    }

    // Check if the block consists purely of list items
    const lines = trimmed.split("\n");
    const isPureList = lines.every(
      (line) =>
        /^\s*([*\-+]|\d+\.)\s+/.test(line) || /^\s{2,}\S/.test(line),
    );

    if (isPureList) {
      renderedBlocks.push(renderList(lines));
      continue;
    }

    // Mixed block: split text, headings, dividers, and list items intelligently
    let currentParagraphLines: string[] = [];
    let currentListLines: string[] = [];

    const flushPara = () => {
      if (currentParagraphLines.length) {
        const pContent = currentParagraphLines
          .map((l) => formatInlineMarkdown(l))
          .join("<br/>");
        renderedBlocks.push(`<p class="md-p">${pContent}</p>`);
        currentParagraphLines = [];
      }
    };

    const flushList = () => {
      if (currentListLines.length) {
        renderedBlocks.push(renderList(currentListLines));
        currentListLines = [];
      }
    };

    for (const line of lines) {
      const lineTrim = line.trim();
      if (!lineTrim) continue;

      if (/^(\-{3,}|\*{3,}|_{3,})$/.test(lineTrim)) {
        flushPara();
        flushList();
        renderedBlocks.push('<hr class="md-hr" />');
      } else if (/^(#{1,6})\s+(.*)$/.test(lineTrim)) {
        flushPara();
        flushList();
        const m = lineTrim.match(/^(#{1,6})\s+(.*)$/);
        const lvl = m?.[1]?.length ?? 1;
        renderedBlocks.push(
          `<h${lvl} class="md-h${lvl}">${formatInlineMarkdown(m?.[2] ?? "")}</h${lvl}>`,
        );
      } else if (/^\s*([*\-+]|\d+\.)\s+/.test(line)) {
        flushPara();
        currentListLines.push(line);
      } else {
        flushList();
        currentParagraphLines.push(line);
      }
    }
    flushPara();
    flushList();
  }

  let finalHtml = renderedBlocks.join("\n");

  // Restore any leftover placeholders
  finalHtml = finalHtml.replace(
    /%%CODE_BLOCK_(\d+)%%/g,
    (_, i) => codeBlocks[Number(i)] || "",
  );
  finalHtml = finalHtml.replace(
    /%%DETAILS_BLOCK_(\d+)%%/g,
    (_, i) => detailsBlocks[Number(i)] || "",
  );

  return finalHtml;
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
  entry?: LibraryEntry | null | undefined;
  note?: Note | null | undefined;
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
      ? media.description.replace(/<br\s*\/?>/gi, "\n")
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

    /* ── Markdown Content Typography & Layout ── */
    .md-p {
      margin: 0 0 0.85rem 0;
      line-height: 1.7;
      color: var(--fg);
    }
    .md-p:last-child {
      margin-bottom: 0;
    }

    .md-h1 {
      font-family: "Outfit", sans-serif;
      font-size: 1.4rem;
      font-weight: 800;
      margin: 1.25rem 0 0.5rem;
      color: var(--fg);
      line-height: 1.3;
    }
    .md-h2 {
      font-family: "Outfit", sans-serif;
      font-size: 1.22rem;
      font-weight: 700;
      margin: 1.1rem 0 0.45rem;
      color: var(--fg);
      line-height: 1.35;
    }
    .md-h3 {
      font-family: "Outfit", sans-serif;
      font-size: 1.08rem;
      font-weight: 700;
      margin: 0.95rem 0 0.4rem;
      color: var(--fg);
    }
    .md-h4, .md-h5, .md-h6 {
      font-size: 0.95rem;
      font-weight: 700;
      margin: 0.85rem 0 0.35rem;
      color: var(--fg);
    }

    /* Clean divider with balanced spacing */
    .md-hr {
      border: 0;
      border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
      margin: 1.15rem 0;
      clear: both;
    }

    /* Lists */
    .md-ul, .md-ol {
      margin: 0.6rem 0 0.85rem;
      padding-left: 1.4rem;
      color: var(--fg);
      line-height: 1.65;
    }
    .md-li {
      margin-bottom: 0.35rem;
    }
    .md-li:last-child {
      margin-bottom: 0;
    }

    /* Task Checklists */
    .md-task-item {
      list-style: none;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 0.4rem;
      margin-left: -1.2rem;
    }
    .md-checkbox {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1.5px solid var(--border);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      color: var(--primary-fg);
      background: color-mix(in srgb, var(--card) 80%, transparent);
      flex-shrink: 0;
      margin-top: 3px;
    }
    .md-checkbox.checked {
      background: var(--primary);
      border-color: var(--primary);
    }
    .md-task-checked span {
      text-decoration: line-through;
      color: var(--muted);
    }

    /* Blockquotes */
    .md-quote {
      margin: 0.85rem 0;
      padding: 10px 16px;
      border-left: 3.5px solid var(--primary);
      background: color-mix(in srgb, var(--primary) 8%, transparent);
      border-radius: 0 12px 12px 0;
      color: var(--fg);
      font-style: italic;
    }

    /* Tables */
    .md-table-wrap {
      overflow-x: auto;
      max-width: 100%;
      margin: 1rem 0;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .md-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
      text-align: left;
    }
    .md-table th {
      background: color-mix(in srgb, var(--card) 85%, transparent);
      padding: 10px 14px;
      font-weight: 700;
      color: var(--primary);
      border-bottom: 1px solid var(--border);
      text-transform: uppercase;
      font-size: 0.76rem;
      letter-spacing: 0.05em;
    }
    .md-table td {
      padding: 9px 14px;
      border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
      color: var(--fg);
    }
    .md-table tr:last-child td {
      border-bottom: none;
    }

    /* Code Blocks & Inline Code */
    .md-code-block {
      margin: 0.95rem 0;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: color-mix(in srgb, var(--card) 90%, black);
      overflow: hidden;
    }
    .md-code-header {
      padding: 6px 14px;
      background: color-mix(in srgb, var(--card) 70%, black);
      border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
      font-size: 0.72rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--muted);
    }
    .md-pre {
      padding: 14px;
      margin: 0;
      overflow-x: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      line-height: 1.5;
      color: var(--fg);
    }
    .md-inline-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85em;
      padding: 2px 6px;
      border-radius: 6px;
      background: color-mix(in srgb, var(--primary) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--primary) 24%, transparent);
      color: var(--primary);
    }

    /* Links */
    .md-link {
      color: var(--primary);
      text-decoration: underline;
      text-underline-offset: 3px;
      transition: opacity 0.15s;
    }
    .md-link:hover {
      opacity: 0.8;
    }

    /* Spoilers */
    .md-spoiler {
      background: color-mix(in srgb, var(--card) 85%, transparent);
      color: transparent;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px dashed var(--border);
      cursor: pointer;
      user-select: none;
      transition: all 0.2s;
    }
    .md-spoiler:hover, .md-spoiler.revealed {
      background: color-mix(in srgb, var(--primary) 15%, transparent);
      color: var(--fg);
      border-color: var(--primary);
      user-select: auto;
    }

    /* ── Collapsible Interactive <details><summary> (Custom Summary, Synopsis & Spoilers) ── */
    .md-details {
      margin: 0.95rem 0;
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--border) 70%, rgba(255, 255, 255, 0.15));
      background: color-mix(in srgb, var(--card) 55%, rgba(255, 255, 255, 0.03));
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.08);
      overflow: hidden;
      transition: background 0.2s, border-color 0.2s;
    }
    .md-details[open] {
      background: color-mix(in srgb, var(--card) 72%, rgba(255, 255, 255, 0.05));
      border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
    }
    .md-summary {
      padding: 10px 14px;
      font-weight: 600;
      font-size: 0.9rem;
      color: var(--fg);
      cursor: pointer;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 8px;
      list-style: none;
      outline: none;
      transition: color 0.15s;
    }
    .md-summary::-webkit-details-marker {
      display: none;
    }
    .md-summary:hover {
      color: var(--primary);
    }
    .md-chevron {
      width: 15px;
      height: 15px;
      stroke: var(--primary);
      flex-shrink: 0;
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .md-details[open] .md-chevron {
      transform: rotate(90deg);
    }
    .md-summary-title {
      flex: 1;
      font-family: "Outfit", sans-serif;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .md-details-body {
      padding: 8px 14px 14px;
      border-top: 1px solid color-mix(in srgb, var(--border) 40%, transparent);
      border-left: 3px solid color-mix(in srgb, var(--primary) 40%, transparent);
      margin: 0 10px 10px 14px;
      border-radius: 0 0 10px 10px;
      font-size: 0.92rem;
      line-height: 1.65;
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
              ${(media.airingStatus || media.status) ? `<span class="pill">${(media.airingStatus || media.status)!.replace("_", " ")}</span>` : ""}
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
