import { evaluateNotability } from "./notability-filter.mjs";
import { inferMetadata, toCanonicalKey } from "./normalizer.mjs";
import { localizeCandidate } from "./localizer.mjs";

const SOURCE_URL_PRIORITY = {
  rss: 4,
  github: 3,
  huggingface: 2,
  openrouter: 1,
};

function makeUniqueId(baseSlug, usedIds) {
  let slug = baseSlug.replace(/:/g, "-");
  if (!usedIds.has(slug)) {
    usedIds.add(slug);
    return slug;
  }
  let idx = 2;
  while (usedIds.has(`${slug}-${idx}`)) {
    idx += 1;
  }
  const unique = `${slug}-${idx}`;
  usedIds.add(unique);
  return unique;
}

/**
 * Deduplicate and merge curated models, existing crawled models, and new candidate detections.
 */
export async function mergeModels({
  curatedModels = [],
  existingCrawledModels = [],
  incomingCandidates = [],
  orgs = [],
  now = new Date(),
  fetchFn = null,
}) {
  const orgMap = new Map(orgs.map((o) => [o.id, o]));
  const orgOrderMap = new Map(orgs.map((o, idx) => [o.id, o.order ?? idx + 1]));

  const knownKeys = new Set();
  const usedIds = new Set();

  const registerModelKeys = (model) => {
    usedIds.add(model.id);
    knownKeys.add(toCanonicalKey(model.orgId, model.name));
    if (Array.isArray(model.aliases)) {
      for (const alias of model.aliases) {
        knownKeys.add(toCanonicalKey(model.orgId, alias));
      }
    }
  };

  for (const m of curatedModels) {
    registerModelKeys(m);
  }

  const sanitizedExistingCrawled = [];
  for (const m of existingCrawledModels) {
    const key = toCanonicalKey(m.orgId, m.name);
    if (knownKeys.has(key)) continue;
    registerModelKeys(m);
    sanitizedExistingCrawled.push(m);
  }

  // Group and deduplicate incoming candidates that pass notability filter
  const candidateByKey = new Map();
  let skippedCount = 0;

  for (const raw of incomingCandidates) {
    const verdict = evaluateNotability(raw, { now });
    if (!verdict.accepted) {
      skippedCount += 1;
      continue;
    }

    const displayName = verdict.canonicalName || raw.name;
    const key = toCanonicalKey(raw.orgId, displayName);
    const altKey = toCanonicalKey(raw.orgId, raw.name);

    if (knownKeys.has(key) || knownKeys.has(altKey)) {
      skippedCount += 1;
      continue;
    }

    const existing = candidateByKey.get(key);
    if (!existing) {
      candidateByKey.set(key, {
        ...raw,
        name: displayName,
        canonicalKey: key,
      });
    } else {
      // Merge attributes from multiple adapters (prefer official RSS/GitHub URL, keep richer context & earlier/valid date)
      const incomingPriority = SOURCE_URL_PRIORITY[raw.sourceType] || 0;
      const existingPriority = SOURCE_URL_PRIORITY[existing.sourceType] || 0;
      const bestUrl =
        incomingPriority > existingPriority && raw.officialUrl
          ? raw.officialUrl
          : existing.officialUrl || raw.officialUrl;

      candidateByKey.set(key, {
        ...existing,
        officialUrl: bestUrl,
        contextTokens: Math.max(Number(existing.contextTokens || 0), Number(raw.contextTokens || 0)) || null,
        openWeights: Boolean(existing.openWeights || raw.openWeights),
        description:
          (existing.description || "").length >= (raw.description || "").length
            ? existing.description
            : raw.description,
        releaseDate:
          raw.releaseDate < existing.releaseDate ? raw.releaseDate : existing.releaseDate,
        discoveredFrom: Array.from(
          new Set([existing.discoveredFrom, raw.discoveredFrom].filter(Boolean)),
        ).join(", "),
      });
    }
  }

  const addedModels = [];
  for (const cand of candidateByKey.values()) {
    const meta = inferMetadata({
      orgId: cand.orgId,
      name: cand.name,
      description: cand.description,
      modality: cand.modality,
      openWeights: cand.openWeights,
      contextTokens: cand.contextTokens,
    });

    const enriched = {
      ...cand,
      ...meta,
      releaseMonth: cand.releaseDate.slice(0, 7),
    };

    const localized = await localizeCandidate(enriched, orgMap.get(cand.orgId), { fetchFn });

    const record = {
      id: makeUniqueId(cand.canonicalKey, usedIds),
      orgId: cand.orgId,
      name: cand.name,
      releaseDate: cand.releaseDate,
      releaseMonth: cand.releaseDate.slice(0, 7),
      tier: meta.tier,
      categories: meta.categories,
      openWeights: meta.openWeights,
      contextWindow: meta.contextWindow,
      summary: localized.summary,
      highlights: localized.highlights,
      officialUrl: cand.officialUrl?.startsWith("https://")
        ? cand.officialUrl
        : orgMap.get(cand.orgId)?.website || "https://openrouter.ai/models",
      source: "crawled",
      discoveredFrom: cand.discoveredFrom || cand.sourceType || "crawler",
      aliases: [cand.name.toLowerCase()],
    };

    knownKeys.add(cand.canonicalKey);
    addedModels.push(record);
  }

  const crawledModels = [...sanitizedExistingCrawled, ...addedModels];
  const mergedModels = [...curatedModels, ...crawledModels].sort((a, b) => {
    const dateDiff = b.releaseDate.localeCompare(a.releaseDate);
    if (dateDiff !== 0) return dateDiff;
    const orderDiff = (orgOrderMap.get(a.orgId) ?? 99) - (orgOrderMap.get(b.orgId) ?? 99);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name);
  });

  return {
    crawledModels,
    mergedModels,
    addedModels,
    skippedCount,
  };
}
