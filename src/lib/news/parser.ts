import type { NewsArticle } from "./types";

/** Decode basic XML / HTML entities */
export function decodeEntities(text: string): string {
  if (!text) return "";
  return text
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(Number(dec));
      } catch {
        return "";
      }
    });
}

/** Strip HTML tags and clean whitespace */
export function stripHtml(html: string): string {
  if (!html) return "";
  const noTags = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(noTags).replace(/\s+/g, " ").trim();
}

/** Extract text inside a single XML tag or CDATA */
export function getTagContent(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  if (!match || !match[1]) return "";
  let content = match[1].trim();
  // Strip CDATA if present
  const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/i);
  if (cdataMatch && cdataMatch[1]) {
    content = cdataMatch[1].trim();
  }
  return content;
}

/** Extract an attribute value from a tag */
export function getTagAttr(xml: string, tagName: string, attrName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*\\s+${attrName}=["']([^"']+)["'][^>]*\\/?>`, "i");
  const match = xml.match(regex);
  return match && match[1] ? match[1].trim() : "";
}

/** Extract image URL from item XML across all RSS / Atom formats */
export function extractImageUrl(itemXml: string): string | undefined {
  // 1. Check media:thumbnail tag content (e.g. MyAnimeList)
  const mediaThumbContent = itemXml.match(/<media:thumbnail[^>]*>([\s\S]*?)<\/media:thumbnail>/i);
  if (mediaThumbContent && mediaThumbContent[1]) {
    const candidate = decodeEntities(mediaThumbContent[1].trim());
    if (/^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }

  // 2. Check media:thumbnail url attribute
  const mediaThumbAttr = itemXml.match(/<media:thumbnail[^>]*\burl=["']([^"']+)["']/i);
  if (mediaThumbAttr && mediaThumbAttr[1] && /^https?:\/\//i.test(mediaThumbAttr[1])) {
    return decodeEntities(mediaThumbAttr[1].trim());
  }

  // 3. Check media:content url attribute (e.g. Crunchyroll)
  const mediaContentAttr = itemXml.match(/<media:content[^>]*\burl=["']([^"']+)["']/i);
  if (mediaContentAttr && mediaContentAttr[1] && /^https?:\/\//i.test(mediaContentAttr[1])) {
    return decodeEntities(mediaContentAttr[1].trim());
  }

  // 4. Check media:content tag content
  const mediaContentTag = itemXml.match(/<media:content[^>]*>([\s\S]*?)<\/media:content>/i);
  if (mediaContentTag && mediaContentTag[1]) {
    const candidate = decodeEntities(mediaContentTag[1].trim());
    if (/^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }

  // 5. Check enclosure url with image MIME or image extension (e.g. Kotaku)
  const enclosureMatch = itemXml.match(/<enclosure[^>]*\burl=["']([^"']+)["']/i);
  if (enclosureMatch && enclosureMatch[1] && /^https?:\/\//i.test(enclosureMatch[1])) {
    const encUrl = decodeEntities(enclosureMatch[1].trim());
    if (
      /\.(jpe?g|png|webp|gif|avif)($|\?)/i.test(encUrl) ||
      (enclosureMatch[0] && /image\//i.test(enclosureMatch[0]))
    ) {
      return encUrl;
    }
  }

  // 6. Check <img> tags inside content:encoded, description, or anywhere in item (e.g. Anime Trending, Anime News India, Anime Herald, Honey's Anime)
  const imgMatches = itemXml.matchAll(/<img[^>]*\bsrc=["']([^"']+)["']/gi);
  for (const m of imgMatches) {
    if (m && m[1]) {
      const src = decodeEntities(m[1].trim());
      if (
        /^https?:\/\//i.test(src) &&
        !src.includes("1x1") &&
        !src.includes("feedburner") &&
        !src.includes("gravatar.com") &&
        !src.includes("/emoji/") &&
        !src.includes("s.w.org")
      ) {
        return src;
      }
    }
  }

  // 7. Direct image url match inside item
  const urlMatch = itemXml.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>]*)?/i);
  if (urlMatch && urlMatch[0] && !urlMatch[0].includes("1x1") && !urlMatch[0].includes("/emoji/") && !urlMatch[0].includes("s.w.org")) {
    return decodeEntities(urlMatch[0]);
  }

  return undefined;
}

/** Parse XML string into Raw Item list */
export function parseRssFeed(xml: string, sourceId: string, sourceName: string): NewsArticle[] {
  const articles: NewsArticle[] = [];
  if (!xml) return articles;

  // Split items by <item> or <entry> (Atom)
  const itemMatches = xml.match(/<(?:item|entry)(?:[\s>][\s\S]*?<\/(?:item|entry)>)/gi) || [];

  for (const itemXml of itemMatches) {
    // Title
    const rawTitle = getTagContent(itemXml, "title");
    const title = decodeEntities(rawTitle).replace(/\s+/g, " ").trim();
    if (!title) continue;

    // Link
    let url = getTagContent(itemXml, "link");
    if (!url || !/^https?:\/\//i.test(url)) {
      url = getTagAttr(itemXml, "link", "href");
    }
    if (!url) {
      url = getTagContent(itemXml, "guid");
    }
    if (!url || !/^https?:\/\//i.test(url)) {
      continue;
    }

    // Publication Date
    const pubDateStr =
      getTagContent(itemXml, "pubDate") ||
      getTagContent(itemXml, "published") ||
      getTagContent(itemXml, "updated") ||
      getTagContent(itemXml, "dc:date");

    let publishedAt: string;
    if (pubDateStr) {
      const parsedDate = new Date(pubDateStr);
      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      } else {
        publishedAt = new Date().toISOString();
      }
    } else {
      publishedAt = new Date().toISOString();
    }

    // Description
    const rawDesc =
      getTagContent(itemXml, "description") ||
      getTagContent(itemXml, "summary") ||
      getTagContent(itemXml, "content:encoded");
    const description = rawDesc ? stripHtml(rawDesc).slice(0, 300) : undefined;

    // Image URL
    const imageUrl = extractImageUrl(itemXml);

    // Category
    const categoryRaw = getTagContent(itemXml, "category");
    const category = categoryRaw ? stripHtml(categoryRaw) : undefined;

    // Deterministic ID
    const hashSeed = `${sourceId}:${url}`;
    const id = `${sourceId}-${simpleHash(hashSeed)}`;

    articles.push({
      id,
      title,
      url,
      sourceId,
      sourceName,
      publishedAt,
      description: description && description.length > 0 ? description : undefined,
      imageUrl,
      category,
    });
  }

  return articles;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
