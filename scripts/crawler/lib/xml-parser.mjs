const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decode XML/HTML entities and strip CDATA wrappers and HTML tags.
 */
export function decodeEntities(text) {
  if (!text) return "";
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&([a-zA-Z]+);/g, (full, name) => NAMED_ENTITIES[name] ?? full);
}

/**
 * Clean raw XML node text into normalized plain text.
 */
export function cleanXmlText(raw) {
  if (!raw) return "";
  const decoded = decodeEntities(raw);
  return decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block, tagNames) {
  for (const tag of tagNames) {
    const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = block.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }
  return "";
}

function extractAtomLink(block) {
  const linkTags = block.match(/<link\b[^>]*\/?>/gi) || [];
  let fallback = "";
  for (const tag of linkTags) {
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const relMatch = tag.match(/rel\s*=\s*["']([^"']+)["']/i);
    const rel = relMatch ? relMatch[1].toLowerCase() : "alternate";
    if (rel === "alternate") {
      return decodeEntities(hrefMatch[1]).trim();
    }
    if (!fallback) {
      fallback = decodeEntities(hrefMatch[1]).trim();
    }
  }
  const plainLink = extractTag(block, ["link", "id"]);
  return cleanXmlText(plainLink) || fallback;
}

/**
 * Parse RSS 2.0 (<item>) or Atom (<entry>) XML feeds without external dependencies.
 */
export function parseFeedXml(xmlText) {
  if (!xmlText || typeof xmlText !== "string") return [];

  const items = [];
  const rssMatches = [...xmlText.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];

  if (rssMatches.length > 0) {
    for (const match of rssMatches) {
      const block = match[1];
      const title = cleanXmlText(extractTag(block, ["title"]));
      const link = cleanXmlText(extractTag(block, ["link", "guid"]));
      const publishedAt = cleanXmlText(
        extractTag(block, ["pubDate", "dc:date", "published", "updated"]),
      );
      const summary = cleanXmlText(
        extractTag(block, ["description", "content:encoded", "summary"]),
      );
      if (title && link) {
        items.push({ title, link, publishedAt, summary });
      }
    }
    return items;
  }

  const atomMatches = [...xmlText.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
  for (const match of atomMatches) {
    const block = match[1];
    const title = cleanXmlText(extractTag(block, ["title"]));
    const link = extractAtomLink(block);
    const publishedAt = cleanXmlText(extractTag(block, ["published", "updated"]));
    const summary = cleanXmlText(extractTag(block, ["summary", "content"]));
    if (title && link) {
      items.push({ title, link, publishedAt, summary });
    }
  }

  return items;
}
