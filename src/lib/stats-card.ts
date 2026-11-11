/**
 * Frosted-glass stats card, drawn on a <canvas> (no extra dependencies).
 *
 * Look: a heavily blurred backdrop made from the user's top covers + theme
 * colours, with translucent "frosted" panels on top (re-blurred backdrop,
 * a white tint, a sheen, film grain and a hairline border).
 * Text colour is picked per panel so it always reaches 4.5:1 contrast.
 */
import { MODE_COPY, type LibraryEntry, type MediaType } from "./types";

export type CardFormat = "story" | "post";

export const CARD_FORMATS: Record<
  CardFormat,
  { w: number; h: number; label: string }
> = {
  story: { w: 1080, h: 1920, label: "Story 9:16" },
  post: { w: 1080, h: 1350, label: "Post 4:5" },
};

export type StatsCardData = {
  mode: MediaType;
  title: string;
  username: string | null;
  dateLabel: string;
  hours: number;
  days: number;
  titles: number;
  completed: number;
  completedPct: number;
  units: number;
  unitLabel: string;
  timeLabel: string;
  meanScore: number | null;
  genres: [string, number][];
  top: { title: string; cover: string | null; score: number }[];
};

export function buildStatsCardData(
  library: LibraryEntry[],
  mode: MediaType,
  username: string | null,
): StatsCardData {
  const copy = MODE_COPY[mode];
  const active = library.filter(
    (e) => e.status !== "PLANNING" && (e.progress ?? 0) > 0,
  );
  const minutes = active.reduce(
    (s, e) => s + e.progress * (mode === "MANGA" ? 5 : (e.media.duration ?? 24)),
    0,
  );
  const hours = Math.round(minutes / 60);
  const completed = library.filter((e) => e.status === "COMPLETED").length;
  const scored = library.filter((e) => (e.score ?? 0) > 0);
  const meanScore = scored.length
    ? scored.reduce((s, e) => s + (e.score ?? 0), 0) / scored.length
    : null;

  const counts: Record<string, number> = {};
  library.forEach((e) =>
    e.media.genres?.forEach((g) => (counts[g] = (counts[g] ?? 0) + 1)),
  );
  const genres = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const top = [...scored]
    .sort(
      (a, b) =>
        (b.score ?? 0) - (a.score ?? 0) ||
        Number(!!b.favorite) - Number(!!a.favorite) ||
        b.updatedAt - a.updatedAt,
    )
    .slice(0, 5)
    .map((e) => ({
      title: e.media.title,
      cover: e.media.cover ?? null,
      score: e.score ?? 0,
    }));

  return {
    mode,
    title: `My ${mode === "MANGA" ? "Manga" : "Anime"} Stats`,
    username: username && username.trim() ? username.trim() : null,
    dateLabel: new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    hours,
    days: Math.round((hours / 24) * 10) / 10,
    titles: active.length,
    completed,
    completedPct: library.length
      ? Math.round((completed / library.length) * 100)
      : 0,
    units: active.reduce((s, e) => s + e.progress, 0),
    unitLabel: copy.unit,
    timeLabel: copy.timeLabel,
    meanScore,
    genres,
    top,
  };
}

/* ------------------------------------------------------------------ env */

type Canvas = HTMLCanvasElement;
type Ctx = CanvasRenderingContext2D;
type Img = CanvasImageSource & { width: number; height: number };

export type CardEnv = {
  createCanvas: (w: number, h: number) => Canvas;
  loadImage: (url: string) => Promise<Img | null>;
  /** CSS colour strings + font stack of the active theme */
  theme: {
    background: string;
    foreground: string;
    mutedForeground: string;
    primary: string;
    primaryForeground: string;
    fontSans: string;
    fontDisplay: string;
  };
  prepareFonts?: () => Promise<void>;
};

export function browserEnv(): CardEnv {
  const cs = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback;
  const fontSans = get("--font-sans", "system-ui, sans-serif");
  const fontDisplay = get("--font-display", fontSans);
  return {
    createCanvas: (w, h) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return c;
    },
    loadImage: (url) =>
      new Promise((resolve) => {
        const img = new Image();
        // Anonymous CORS keeps the canvas exportable; a blocked image just
        // errors out and is replaced by a placeholder.
        img.crossOrigin = "anonymous";
        img.referrerPolicy = "no-referrer";
        const timer = setTimeout(() => resolve(null), 9000);
        img.onload = () => {
          clearTimeout(timer);
          resolve(img);
        };
        img.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };
        img.src = url;
      }),
    theme: {
      background: get("--background", "#141414"),
      foreground: get("--foreground", "#f2f2f2"),
      mutedForeground: get("--muted-foreground", "#a3a3a3"),
      primary: get("--primary", "#6fd6dc"),
      primaryForeground: get("--primary-foreground", "#141414"),
      fontSans,
      fontDisplay,
    },
    prepareFonts: async () => {
      try {
        await Promise.all([
          document.fonts.load(`700 40px ${fontDisplay}`),
          document.fonts.load(`500 28px ${fontSans}`),
          document.fonts.load(`700 28px ${fontSans}`),
        ]);
        await document.fonts.ready;
      } catch {
        /* fall back to whatever is loaded */
      }
    },
  };
}

/* --------------------------------------------------------------- colour */

type RGB = [number, number, number];

const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
function luminance(c: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Any CSS colour (hex, oklch, …) → sRGB triple, via a 1×1 canvas. */
function parseColor(css: string, env: CardEnv, fallback: RGB): RGB {
  try {
    const ctx = env.createCanvas(1, 1).getContext("2d");
    if (!ctx) return fallback;
    ctx.fillStyle = "#010203";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
  } catch {
    return fallback;
  }
}

/* --------------------------------------------------------------- pixels */

function boxPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  r: number,
  horizontal: boolean,
): void {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const stride = horizontal ? 4 : w * 4;
  const lineStride = horizontal ? w * 4 : 4;
  const div = 2 * r + 1;
  for (let l = 0; l < lines; l++) {
    const base = l * lineStride;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const idx = Math.min(len - 1, Math.max(0, i));
        sum += src[base + idx * stride + c] ?? 0;
      }
      for (let i = 0; i < len; i++) {
        dst[base + i * stride + c] = sum / div;
        const add = Math.min(len - 1, i + r + 1);
        const sub = Math.max(0, i - r);
        sum +=
          (src[base + add * stride + c] ?? 0) -
          (src[base + sub * stride + c] ?? 0);
      }
    }
  }
}

/** Gaussian-ish blur (3 box passes). Works everywhere, unlike ctx.filter. */
function blurCanvas(canvas: Canvas, radius: number, passes = 3): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tmp = new Uint8ClampedArray(img.data.length);
  for (let p = 0; p < passes; p++) {
    boxPass(img.data, tmp, img.width, img.height, radius, true);
    boxPass(tmp, img.data, img.width, img.height, radius, false);
  }
  ctx.putImageData(img, 0, 0);
}

function makeNoise(env: CardEnv): Canvas {
  const size = 160;
  const c = env.createCanvas(size, size);
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const img = ctx.createImageData(size, size);
  let seed = 123456789;
  for (let i = 0; i < size * size; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = seed >>> 24;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* --------------------------------------------------------------- shapes */

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawCover(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number) {
  const iw = img.width || 1;
  const ih = img.height || 1;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function font(ctx: Ctx, weight: number, size: number, family: string) {
  ctx.font = `${weight} ${size}px ${family}`;
}

function ellipsize(ctx: Ctx, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function fitFont(
  ctx: Ctx,
  text: string,
  maxW: number,
  start: number,
  min: number,
  weight: number,
  family: string,
): number {
  let size = start;
  font(ctx, weight, size, family);
  while (size > min && ctx.measureText(text).width > maxW) {
    size -= 2;
    font(ctx, weight, size, family);
  }
  return size;
}

function wrapLines(ctx: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : (words[i] as string);
    if (ctx.measureText(next).width <= maxW || !line) {
      line = next;
    } else {
      lines.push(line);
      line = words[i] as string;
      if (lines.length === maxLines - 1) {
        line = words.slice(i).join(" ");
        break;
      }
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines).map((l, i, all) =>
    i === all.length - 1 ? ellipsize(ctx, l, maxW) : ellipsize(ctx, l, maxW),
  );
}

function tracked(ctx: Ctx, text: string, x: number, y: number, spacing: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

/* ----------------------------------------------------------------- draw */

type Ink = { ink: RGB; sub: RGB };

/** Pick text colours that reach 4.5:1 against what is actually painted. */
function inkFor(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  fg: RGB,
  muted: RGB,
): Ink {
  const points: [number, number][] = [
    [0.12, 0.25],
    [0.5, 0.5],
    [0.88, 0.75],
    [0.5, 0.15],
    [0.2, 0.8],
  ];
  const samples: RGB[] = points.map(([px, py]) => {
    const sx = Math.max(0, Math.round(x + w * px - 4));
    const sy = Math.max(0, Math.round(y + h * py - 4));
    const d = ctx.getImageData(sx, sy, 8, 8).data;
    let r = 0;
    let g = 0;
    let b = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i] ?? 0;
      g += d[i + 1] ?? 0;
      b += d[i + 2] ?? 0;
    }
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)] as RGB;
  });
  const worst = (c: RGB) => Math.min(...samples.map((s) => contrast(c, s)));
  const avg = mix(mix(samples[0]!, samples[1]!, 0.5), mix(samples[2]!, samples[3]!, 0.5), 0.5);

  let ink = fg;
  if (worst(ink) < 4.5) {
    const light: RGB = [255, 255, 255];
    const dark: RGB = [12, 12, 16];
    ink = worst(light) >= worst(dark) ? light : dark;
  }
  let sub = worst(muted) >= 4.5 && ink === fg ? muted : mix(ink, avg, 0.28);
  if (worst(sub) < 4.5) sub = mix(ink, avg, 0.12);
  if (worst(sub) < 4.5) sub = ink;
  return { ink, sub };
}

export async function renderStatsCanvas(
  data: StatsCardData,
  format: CardFormat,
  env: CardEnv = browserEnv(),
): Promise<Canvas> {
  await env.prepareFonts?.();
  const { w: W, h: H } = CARD_FORMATS[format];
  const story = format === "story";
  const canvas = env.createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  const bg = parseColor(env.theme.background, env, [20, 20, 20]);
  const fg = parseColor(env.theme.foreground, env, [242, 242, 242]);
  const muted = parseColor(env.theme.mutedForeground, env, [163, 163, 163]);
  const primary = parseColor(env.theme.primary, env, [111, 214, 220]);
  const primaryFg = parseColor(env.theme.primaryForeground, env, [20, 20, 20]);
  const isDark = luminance(bg) < 0.25;
  const sans = env.theme.fontSans;
  const display = env.theme.fontDisplay;

  const covers = await Promise.all(
    data.top.map((t) => (t.cover ? env.loadImage(t.cover) : Promise.resolve(null))),
  );

  /* ---- backdrop (small canvas → blur → upscale) ---- */
  const k = 8;
  const sw = Math.ceil(W / k);
  const sh = Math.ceil(H / k);
  const amb = env.createCanvas(sw, sh);
  const actx = amb.getContext("2d");
  if (!actx) throw new Error("Canvas is not supported in this browser.");
  actx.fillStyle = rgba(bg, 1);
  actx.fillRect(0, 0, sw, sh);

  const blob = (cx: number, cy: number, r: number, c: RGB, a: number) => {
    const g = actx.createRadialGradient(cx * sw, cy * sh, 0, cx * sw, cy * sh, r * sw);
    g.addColorStop(0, rgba(c, a));
    g.addColorStop(1, rgba(c, 0));
    actx.fillStyle = g;
    actx.fillRect(0, 0, sw, sh);
  };
  blob(0.15, 0.1, 0.9, primary, 0.5);
  blob(0.95, 0.5, 0.8, mix(primary, fg, 0.35), 0.3);
  blob(0.2, 0.95, 0.9, mix(primary, bg, 0.4), 0.45);

  const loaded = covers.filter((c): c is Img => c !== null);
  if (loaded.length) {
    // Fill the whole card with large, offset covers; blur turns them into colour fields.
    const slots: [number, number, number, number][] = [
      [0, 0, 0.75, 0.42],
      [0.35, 0.18, 0.75, 0.42],
      [0, 0.5, 0.75, 0.42],
      [0.3, 0.68, 0.75, 0.42],
      [0.1, 0.32, 0.75, 0.42],
    ];
    loaded.forEach((img, i) => {
      const s = slots[i % slots.length]!;
      actx.globalAlpha = 0.9;
      drawCover(actx, img, s[0] * sw, s[1] * sh, s[2] * sw, s[3] * sh);
    });
    actx.globalAlpha = 1;
  }
  blurCanvas(amb, Math.max(3, Math.round(sw * 0.055)), 3);
  // Calm the backdrop so panels and headings stay readable.
  // Dark themes get a heavier wash so the theme's light text passes everywhere.
  actx.fillStyle = rgba(bg, isDark ? 0.7 : 0.55);
  actx.fillRect(0, 0, sw, sh);

  const frost = env.createCanvas(sw, sh);
  const fctx = frost.getContext("2d");
  if (!fctx) throw new Error("Canvas is not supported in this browser.");
  fctx.drawImage(amb, 0, 0);
  blurCanvas(frost, Math.max(2, Math.round(sw * 0.03)), 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(amb, 0, 0, W, H);

  const noise = makeNoise(env);
  const noisePattern = ctx.createPattern(noise, "repeat");

  /* ---- frosted panel ---- */
  const panel = (x: number, y: number, pw: number, ph: number, r: number): Ink => {
    ctx.save();
    roundRect(ctx, x, y, pw, ph, r);
    ctx.clip();
    ctx.drawImage(frost, 0, 0, W, H);
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.52)";
    ctx.fillRect(x, y, pw, ph);
    const sheen = ctx.createLinearGradient(0, y, 0, y + ph * 0.55);
    sheen.addColorStop(0, "rgba(255,255,255,0.14)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(x, y, pw, ph);
    if (noisePattern) {
      ctx.globalAlpha = isDark ? 0.05 : 0.035;
      ctx.fillStyle = noisePattern;
      ctx.fillRect(x, y, pw, ph);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.save();
    roundRect(ctx, x + 0.75, y + 0.75, pw - 1.5, ph - 1.5, r);
    const edge = ctx.createLinearGradient(x, y, x + pw, y + ph);
    edge.addColorStop(0, "rgba(255,255,255,0.55)");
    edge.addColorStop(0.5, "rgba(255,255,255,0.12)");
    edge.addColorStop(1, "rgba(255,255,255,0.32)");
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    return inkFor(ctx, x, y, pw, ph, fg, muted);
  };

  const L = story
    ? { m: 72, gap: 24, hdrY: 96, hero: [300, 400], mini: [724, 200], gen: [948, 424], top: [1396, 412], foot: 1862 }
    : { m: 60, gap: 20, hdrY: 64, hero: [206, 270], mini: [496, 150], gen: [666, 176], top: [862, 404], foot: 1314 };
  const s = story ? 1 : 0.8;
  const px = L.m;
  const pw = W - L.m * 2;
  const R = story ? 44 : 38;
  const pad = story ? 44 : 36;

  /* ---- header ---- */
  {
    const hh = story ? 170 : 130;
    const ink = inkFor(ctx, L.m, L.hdrY - 20, pw, hh, fg, muted);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = rgba(ink.ink, 1);
    font(ctx, 800, 26 * s + 2, sans);
    tracked(ctx, "KOKA", px, L.hdrY + 22, 7);
    font(ctx, 700, story ? 66 : 54, display);
    ctx.fillText(
      ellipsize(ctx, data.title, pw),
      px,
      L.hdrY + (story ? 92 : 78),
    );
    ctx.fillStyle = rgba(ink.sub, 1);
    font(ctx, 500, story ? 30 : 26, sans);
    const sub = [data.username ? `@${data.username}` : null, data.dateLabel]
      .filter(Boolean)
      .join("  ·  ");
    ctx.fillText(sub, px, L.hdrY + (story ? 138 : 114));
  }

  /* ---- hero ---- */
  {
    const [hy, hh] = L.hero as [number, number];
    const ink = panel(px, hy, pw, hh, R);
    const ringR = story ? 112 : 80;
    const ringW = story ? 26 : 20;
    const ringCx = px + pw - pad - ringR - ringW / 2;
    const ringCy = hy + hh / 2;

    ctx.textAlign = "left";
    ctx.fillStyle = rgba(ink.sub, 1);
    font(ctx, 700, story ? 26 : 22, sans);
    tracked(ctx, data.timeLabel.toUpperCase(), px + pad, hy + (story ? 76 : 50), 4);

    ctx.fillStyle = rgba(ink.ink, 1);
    const num = data.hours.toLocaleString("en-US");
    const maxNumW = ringCx - ringR - ringW - 28 - (px + pad);
    fitFont(ctx, num, maxNumW, story ? 200 : 128, 70, 800, display);
    ctx.fillText(num, px + pad, hy + (story ? 245 : 176));

    ctx.fillStyle = rgba(ink.sub, 1);
    font(ctx, 500, story ? 31 : 26, sans);
    const daysText = `≈ ${data.days.toLocaleString("en-US")} days`;
    const titlesText = `${data.titles.toLocaleString("en-US")} titles`;
    if (story) {
      ctx.fillText(daysText, px + pad, hy + 306);
      ctx.fillText(titlesText, px + pad, hy + 350);
    } else {
      ctx.fillText(`${daysText}  ·  ${titlesText}`, px + pad, hy + 232);
    }

    // completion ring
    ctx.lineCap = "round";
    ctx.lineWidth = ringW;
    ctx.strokeStyle = rgba(ink.ink, 0.16);
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    if (data.completedPct > 0) {
      const ringColor = contrast(primary, ink.ink) >= 1.6 || true ? primary : ink.ink;
      ctx.strokeStyle = rgba(ringColor, 1);
      ctx.beginPath();
      ctx.arc(
        ringCx,
        ringCy,
        ringR,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * Math.min(100, data.completedPct)) / 100,
      );
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = rgba(ink.ink, 1);
    font(ctx, 800, story ? 62 : 46, display);
    ctx.fillText(`${data.completedPct}%`, ringCx, ringCy + (story ? 14 : 8));
    ctx.fillStyle = rgba(ink.sub, 1);
    font(ctx, 600, story ? 24 : 19, sans);
    ctx.fillText("completed", ringCx, ringCy + (story ? 52 : 38));
    ctx.textAlign = "left";
  }

  /* ---- three mini stats ---- */
  {
    const [my, mh] = L.mini as [number, number];
    const mw = (pw - L.gap * 2) / 3;
    const items: [string, string][] = [
      [data.completed.toLocaleString("en-US"), "Completed"],
      [compact(data.units), data.unitLabel],
      [data.meanScore === null ? "—" : data.meanScore.toFixed(1), "Mean score"],
    ];
    items.forEach(([value, label], i) => {
      const mx = px + i * (mw + L.gap);
      const ink = panel(mx, my, mw, mh, R * 0.8);
      ctx.fillStyle = rgba(ink.ink, 1);
      ctx.textAlign = "left";
      fitFont(ctx, value, mw - 56, story ? 72 : 56, 36, 800, display);
      ctx.fillText(value, mx + 30, my + mh * 0.56);
      ctx.fillStyle = rgba(ink.sub, 1);
      font(ctx, 600, story ? 25 : 21, sans);
      ctx.fillText(ellipsize(ctx, label, mw - 56), mx + 30, my + mh * 0.82);
    });
  }

  /* ---- genres ---- */
  {
    const [gy, gh] = L.gen as [number, number];
    const ink = panel(px, gy, pw, gh, R);
    ctx.textAlign = "left";
    ctx.fillStyle = rgba(ink.ink, 1);
    font(ctx, 700, story ? 32 : 27, display);
    ctx.fillText("Top genres", px + pad, gy + (story ? 66 : 54));

    if (!data.genres.length) {
      ctx.fillStyle = rgba(ink.sub, 1);
      font(ctx, 500, 26, sans);
      ctx.fillText("Add genres by tracking a few titles.", px + pad, gy + 120);
    } else if (story) {
      const rows = data.genres.length;
      const top0 = gy + 104;
      const rowH = (gh - 104 - 28) / 5;
      const labelW = 250;
      const valW = 64;
      const barX = px + pad + labelW;
      const barW = pw - pad * 2 - labelW - valW;
      const max = data.genres[0]?.[1] ?? 1;
      for (let i = 0; i < rows; i++) {
        const [name, count] = data.genres[i]!;
        const cy = top0 + i * rowH + rowH / 2;
        ctx.fillStyle = rgba(ink.ink, 1);
        font(ctx, 600, 29, sans);
        ctx.fillText(ellipsize(ctx, name, labelW - 16), px + pad, cy + 10);
        ctx.fillStyle = rgba(ink.ink, 0.14);
        roundRect(ctx, barX, cy - 11, barW, 22, 11);
        ctx.fill();
        ctx.fillStyle = rgba(primary, 1);
        roundRect(ctx, barX, cy - 11, Math.max(22, (barW * count) / max), 22, 11);
        ctx.fill();
        ctx.fillStyle = rgba(ink.ink, 1);
        font(ctx, 700, 28, sans);
        ctx.textAlign = "right";
        ctx.fillText(String(count), px + pw - pad, cy + 10);
        ctx.textAlign = "left";
      }
    } else {
      // chips (compact layout)
      let cx = px + pad;
      let cy = gy + 84;
      const chipH = 46;
      data.genres.forEach(([name, count], i) => {
        font(ctx, 700, 24, sans);
        const label = `${name}  ${count}`;
        const cw = ctx.measureText(label).width + 40;
        if (cx + cw > px + pw - pad) {
          cx = px + pad;
          cy += chipH + 12;
        }
        if (cy + chipH > gy + gh - 14) return;
        const first = i === 0;
        ctx.fillStyle = first ? rgba(primary, 1) : rgba(ink.ink, 0.12);
        roundRect(ctx, cx, cy, cw, chipH, chipH / 2);
        ctx.fill();
        if (!first) {
          ctx.strokeStyle = rgba(ink.ink, 0.2);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.fillStyle = first ? rgba(primaryFg, 1) : rgba(ink.ink, 1);
        ctx.fillText(label, cx + 20, cy + chipH / 2 + 8);
        cx += cw + 12;
      });
    }
  }

  /* ---- top rated ---- */
  {
    const [ty, th] = L.top as [number, number];
    const ink = panel(px, ty, pw, th, R);
    ctx.textAlign = "left";
    ctx.fillStyle = rgba(ink.ink, 1);
    font(ctx, 700, story ? 32 : 27, display);
    ctx.fillText("Top rated", px + pad, ty + (story ? 66 : 54));

    if (!data.top.length) {
      ctx.fillStyle = rgba(ink.sub, 1);
      font(ctx, 500, 26, sans);
      ctx.fillText("Rate a few titles and they'll show up here.", px + pad, ty + 130);
    } else {
      const slots = 5;
      const gapC = story ? 18 : 14;
      const innerW = pw - pad * 2;
      const cw = (innerW - gapC * (slots - 1)) / slots;
      const ch = cw * 1.42;
      const cy = ty + (story ? 96 : 80);
      data.top.forEach((t, i) => {
        const cx = px + pad + i * (cw + gapC);
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.38)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        roundRect(ctx, cx, cy, cw, ch, 16);
        ctx.fill();
        ctx.restore();

        ctx.save();
        roundRect(ctx, cx, cy, cw, ch, 16);
        ctx.clip();
        const img = covers[i];
        if (img) {
          drawCover(ctx, img, cx, cy, cw, ch);
        } else {
          const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
          g.addColorStop(0, rgba(primary, 1));
          g.addColorStop(1, rgba(mix(primary, bg, 0.7), 1));
          ctx.fillStyle = g;
          ctx.fillRect(cx, cy, cw, ch);
          ctx.fillStyle = rgba(primaryFg, 0.9);
          ctx.textAlign = "center";
          font(ctx, 800, cw * 0.5, display);
          ctx.fillText((t.title.trim()[0] ?? "?").toUpperCase(), cx + cw / 2, cy + ch / 2 + cw * 0.17);
          ctx.textAlign = "left";
        }
        ctx.restore();

        // score badge
        const badge = `★ ${formatScore(t.score)}`;
        font(ctx, 800, story ? 22 : 19, sans);
        const bw = ctx.measureText(badge).width + 26;
        const bh = story ? 36 : 32;
        ctx.fillStyle = "rgba(0,0,0,0.66)";
        roundRect(ctx, cx + 10, cy + ch - bh - 10, bw, bh, bh / 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(badge, cx + 23, cy + ch - 10 - bh / 2 + (story ? 8 : 7));

        // title
        ctx.fillStyle = rgba(ink.sub, 1);
        font(ctx, 600, story ? 22 : 19, sans);
        const lh = story ? 26 : 22;
        wrapLines(ctx, t.title, cw, 2).forEach((line, li) =>
          ctx.fillText(line, cx, cy + ch + (story ? 38 : 32) + li * lh),
        );
      });
    }
  }

  /* ---- footer ---- */
  {
    const ink = inkFor(ctx, L.m, L.foot - 36, pw, 48, fg, muted);
    ctx.textAlign = "center";
    ctx.fillStyle = rgba(ink.sub, 1);
    font(ctx, 600, 24, sans);
    ctx.fillText("Made with Koka", W / 2, L.foot);
    ctx.textAlign = "left";
  }

  return canvas;
}

function compact(n: number): string {
  if (n >= 100000) return `${Math.round(n / 1000)}K`;
  if (n >= 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString("en-US");
}

function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function canvasToPngBlob(canvas: Canvas): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the image."))),
      "image/png",
    );
  });
}

export async function renderStatsBlob(
  data: StatsCardData,
  format: CardFormat,
): Promise<Blob> {
  const canvas = await renderStatsCanvas(data, format);
  return canvasToPngBlob(canvas);
}
