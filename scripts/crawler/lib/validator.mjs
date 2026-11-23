const VALID_TIERS = new Set(["flagship", "notable"]);
const VALID_CATEGORIES = new Set([
  "flagship",
  "reasoning",
  "open-weights",
  "multimodal",
  "compact",
]);
const LANGS = ["ja", "zh", "en"];

/**
 * Strictly validate orgs and merged models dataset. Throws an Error summarizing any violations.
 */
export function validateDataset({ orgs, models }) {
  const errors = [];

  if (!Array.isArray(orgs) || orgs.length === 0) {
    errors.push("orgs must be a non-empty array");
  }
  if (!Array.isArray(models) || models.length === 0) {
    errors.push("models must be a non-empty array");
  }

  const orgIds = new Set();
  if (Array.isArray(orgs)) {
    for (const org of orgs) {
      if (!org?.id) {
        errors.push("org missing id");
        continue;
      }
      if (orgIds.has(org.id)) {
        errors.push(`duplicate org id: ${org.id}`);
      }
      orgIds.add(org.id);
      for (const lang of LANGS) {
        if (!org.name?.[lang]?.trim()) {
          errors.push(`org ${org.id} missing name.${lang}`);
        }
      }
    }
  }

  const modelIds = new Set();
  if (Array.isArray(models)) {
    for (const m of models) {
      const ref = m?.id || m?.name || "<unknown>";
      if (!m?.id || typeof m.id !== "string") {
        errors.push(`model ${ref} missing string id`);
      } else if (modelIds.has(m.id)) {
        errors.push(`duplicate model id: ${m.id}`);
      } else {
        modelIds.add(m.id);
      }

      if (!orgIds.has(m?.orgId)) {
        errors.push(`model ${ref} references unknown orgId: ${m?.orgId}`);
      }

      if (!m?.name || typeof m.name !== "string" || !m.name.trim()) {
        errors.push(`model ${ref} missing name`);
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(m?.releaseDate || "")) {
        errors.push(`model ${ref} invalid releaseDate: ${m?.releaseDate}`);
      } else if (m?.releaseMonth !== m.releaseDate.slice(0, 7)) {
        errors.push(`model ${ref} releaseMonth (${m?.releaseMonth}) does not match releaseDate (${m.releaseDate})`);
      }

      if (!VALID_TIERS.has(m?.tier)) {
        errors.push(`model ${ref} invalid tier: ${m?.tier}`);
      }

      if (!Array.isArray(m?.categories) || m.categories.length === 0) {
        errors.push(`model ${ref} must have non-empty categories array`);
      } else {
        for (const cat of m.categories) {
          if (!VALID_CATEGORIES.has(cat)) {
            errors.push(`model ${ref} invalid category: ${cat}`);
          }
        }
      }

      if (typeof m?.openWeights !== "boolean") {
        errors.push(`model ${ref} openWeights must be boolean`);
      }

      for (const lang of LANGS) {
        if (typeof m?.summary?.[lang] !== "string" || !m.summary[lang].trim()) {
          errors.push(`model ${ref} missing summary.${lang}`);
        }
        if (
          !Array.isArray(m?.highlights?.[lang]) ||
          m.highlights[lang].length === 0 ||
          m.highlights[lang].some((h) => typeof h !== "string" || !h.trim())
        ) {
          errors.push(`model ${ref} invalid highlights.${lang}`);
        }
      }

      if (typeof m?.officialUrl !== "string" || !m.officialUrl.startsWith("https://")) {
        errors.push(`model ${ref} officialUrl must start with https:// (got ${m?.officialUrl})`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Dataset validation failed with ${errors.length} error(s):\n- ${errors.join("\n- ")}`);
  }

  return true;
}
