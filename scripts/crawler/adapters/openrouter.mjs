import { OPENROUTER_ORG_MAP, OPENROUTER_URL, fetchWithTimeout } from "../config.mjs";
import { cleanDisplayName, toIsoDate } from "../lib/normalizer.mjs";

/**
 * Crawl OpenRouter /api/v1/models catalog and normalize models belonging to tracked orgs.
 */
export async function crawlOpenRouter({ fetchFn = globalThis.fetch, url = OPENROUTER_URL } = {}) {
  try {
    const resp = await fetchWithTimeout(url, {}, fetchFn);
    if (!resp.ok) {
      return {
        source: "openrouter",
        ok: false,
        fetchedCount: 0,
        candidates: [],
        error: `HTTP ${resp.status}`,
      };
    }

    const payload = await resp.json();
    const list = Array.isArray(payload?.data) ? payload.data : [];
    const candidates = [];

    for (const item of list) {
      const id = String(item?.id || "");
      const slashIdx = id.indexOf("/");
      if (slashIdx <= 0) continue;

      const prefix = id.slice(0, slashIdx).toLowerCase();
      const orgId = OPENROUTER_ORG_MAP[prefix];
      if (!orgId) continue;

      const dateObj = toIsoDate(item?.created);
      if (!dateObj) continue;

      const rawName = item?.name || id.slice(slashIdx + 1);
      const name = cleanDisplayName(rawName);
      if (!name) continue;

      candidates.push({
        orgId,
        name,
        releaseDate: dateObj.releaseDate,
        releaseMonth: dateObj.releaseMonth,
        description: String(item?.description || "").trim(),
        modality: String(item?.architecture?.modality || ""),
        contextTokens: Number(item?.context_length || item?.top_provider?.context_length || 0) || null,
        openWeights: ["meta", "deepseek", "qwen"].includes(orgId),
        officialUrl: `https://openrouter.ai/models/${id}`,
        sourceType: "openrouter",
        discoveredFrom: "OpenRouter API",
      });
    }

    return {
      source: "openrouter",
      ok: true,
      fetchedCount: list.length,
      candidates,
    };
  } catch (err) {
    return {
      source: "openrouter",
      ok: false,
      fetchedCount: 0,
      candidates: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
