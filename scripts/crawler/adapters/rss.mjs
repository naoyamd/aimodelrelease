import { RSS_FEEDS, fetchWithTimeout } from "../config.mjs";
import { toIsoDate } from "../lib/normalizer.mjs";
import { parseFeedXml } from "../lib/xml-parser.mjs";

/**
 * Crawl official and community-mirrored RSS/Atom feeds for model release announcements.
 */
export async function crawlRssFeeds({ fetchFn = globalThis.fetch, feeds = RSS_FEEDS } = {}) {
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const resp = await fetchWithTimeout(feed.url, {}, fetchFn);
      if (!resp.ok) {
        throw new Error(`${feed.id}: HTTP ${resp.status}`);
      }
      const xml = await resp.text();
      const entries = parseFeedXml(xml);
      const items = [];
      for (const entry of entries) {
        const dateObj = toIsoDate(entry.publishedAt);
        if (!dateObj) continue;
        items.push({
          orgId: feed.orgId,
          name: entry.title,
          releaseDate: dateObj.releaseDate,
          releaseMonth: dateObj.releaseMonth,
          description: entry.summary || "",
          modality: "",
          contextTokens: null,
          openWeights: feed.orgId === "mistral",
          officialUrl: entry.link,
          sourceType: "rss",
          discoveredFrom: feed.label,
        });
      }
      return { feedId: feed.id, fetchedCount: entries.length, items };
    }),
  );

  const candidates = [];
  const errors = [];
  let fetchedCount = 0;
  let successFeeds = 0;

  for (const res of results) {
    if (res.status === "fulfilled") {
      successFeeds += 1;
      fetchedCount += res.value.fetchedCount;
      candidates.push(...res.value.items);
    } else {
      errors.push(res.reason instanceof Error ? res.reason.message : String(res.reason));
    }
  }

  return {
    source: "rss",
    ok: successFeeds > 0,
    fetchedCount,
    candidates,
    ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
  };
}
