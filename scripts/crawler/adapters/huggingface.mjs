import { HUGGINGFACE_ORGS, fetchWithTimeout } from "../config.mjs";
import { cleanDisplayName, toIsoDate } from "../lib/normalizer.mjs";

/**
 * Crawl Hugging Face Hub API for recent open-weights model repositories by tracked organizations.
 */
export async function crawlHuggingFace({
  fetchFn = globalThis.fetch,
  orgs = HUGGINGFACE_ORGS,
} = {}) {
  const results = await Promise.allSettled(
    orgs.map(async ({ author, orgId }) => {
      const apiUrl = `https://huggingface.co/api/models?author=${encodeURIComponent(author)}&sort=createdAt&direction=-1&limit=35`;
      const resp = await fetchWithTimeout(apiUrl, {}, fetchFn);
      if (!resp.ok) {
        throw new Error(`${author}: HTTP ${resp.status}`);
      }
      const list = await resp.json();
      if (!Array.isArray(list)) {
        throw new Error(`${author}: invalid JSON array`);
      }

      const items = [];
      for (const item of list) {
        const repoId = String(item?.id || item?.modelId || "");
        if (!repoId) continue;
        const dateObj = toIsoDate(item?.createdAt);
        if (!dateObj) continue;

        const shortName = repoId.includes("/") ? repoId.split("/").slice(1).join("/") : repoId;
        const name = cleanDisplayName(shortName);
        if (!name) continue;

        const tags = Array.isArray(item?.tags) ? item.tags.join(" ") : "";

        items.push({
          orgId,
          name,
          releaseDate: dateObj.releaseDate,
          releaseMonth: dateObj.releaseMonth,
          description: tags,
          modality: String(item?.pipeline_tag || ""),
          contextTokens: null,
          openWeights: true,
          likes: Number(item?.likes || 0),
          downloads: Number(item?.downloads || 0),
          officialUrl: `https://huggingface.co/${repoId}`,
          sourceType: "huggingface",
          discoveredFrom: `Hugging Face (${author})`,
        });
      }
      return { fetchedCount: list.length, items };
    }),
  );

  const candidates = [];
  const errors = [];
  let fetchedCount = 0;
  let successOrgs = 0;

  for (const res of results) {
    if (res.status === "fulfilled") {
      successOrgs += 1;
      fetchedCount += res.value.fetchedCount;
      candidates.push(...res.value.items);
    } else {
      errors.push(res.reason instanceof Error ? res.reason.message : String(res.reason));
    }
  }

  return {
    source: "huggingface",
    ok: successOrgs > 0,
    fetchedCount,
    candidates,
    ...(errors.length > 0 ? { error: errors.join("; ") } : {}),
  };
}
