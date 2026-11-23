const ORG_PREFIX_RE = /^(openai|anthropic|google|deepmind|meta(?:-llama)?|deepseek(?:-ai)?|x-?ai|mistral(?:ai)?|qwen(?:lm)?|z-?ai|zhipu|moonshot(?:ai)?|minimax(?:ai)?|bytedance(?:-seed)?|nvidia|microsoft|cohere|amazon|black-forest-labs|bfl|allenai|pfnet|preferred|llm-jp|sakana(?:ai)?|tokyotech-llm|sbintuitions|rakuten|stockmark|elyza|cyberagent|ntt)\s*[:\/]\s*/i;
const TRAILING_TAG_RE = /(?::free|:beta|:extended|:thinking|:nitro|:online|:exacto)+$/gi;
const DATE_SUFFIX_RE = /[-_\s](?:\d{4}-\d{2}-\d{2}|\d{8})$/g;
const PAREN_BUILD_RE = /\s*\((?:build\s*)?\d{8}\)\s*$/i;

/**
 * Strip org prefix, routing tags, and date/build suffixes to produce a stable canonical slug.
 */
export function toCanonicalKey(orgId, rawName) {
  if (!rawName) return `${orgId || "unknown"}:unknown`;
  let cleaned = String(rawName)
    .trim()
    .replace(ORG_PREFIX_RE, "")
    .replace(TRAILING_TAG_RE, "")
    .replace(PAREN_BUILD_RE, "");

  // Clean common announcement prefixes from RSS/GitHub titles
  cleaned = cleaned
    .replace(/^(?:introducing|announcing|releasing|launch(?:ing)?|meet)\s+/i, "")
    .replace(/\s+(?:announcement|release|model card|technical report)$/i, "");

  // Normalize version dots (e.g. 3.5 -> 3-5) vs keeping crisp slug
  let slug = cleaned
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\./g, ".")
    .replace(/[^a-z0-9.+]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  slug = slug.replace(DATE_SUFFIX_RE, "");
  slug = slug.replace(/-(?:instruct|chat|base|hf|fp8|bf16)$/i, "");

  // Normalize dots to dashes for matching consistency across "3.5" vs "3-5"
  const normalizedSlug = slug.replace(/\./g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return `${orgId}:${normalizedSlug}`;
}

/**
 * Clean display name for a model candidate.
 */
export function cleanDisplayName(rawName) {
  if (!rawName) return "";
  return String(rawName)
    .trim()
    .replace(ORG_PREFIX_RE, "")
    .replace(TRAILING_TAG_RE, "")
    .replace(/^(?:introducing|announcing|releasing|launch(?:ing)?|meet)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format numeric context tokens into compact human labels like 128K or 1M.
 */
export function formatContextWindow(tokens) {
  const num = Number(tokens);
  if (!Number.isFinite(num) || num < 1024) return null;

  if (num >= 1_000_000) {
    const millions = num / 1_000_000;
    // Handle binary million (1048576) or exact million nicely
    if (Math.abs(millions - Math.round(millions)) < 0.08) {
      return `${Math.round(millions)}M`;
    }
    return `${Number(millions.toFixed(1))}M`;
  }

  const thousands = num / 1000;
  if (Math.abs(thousands - 128) <= 4 || num === 131072) return "128K";
  if (Math.abs(thousands - 200) <= 5) return "200K";
  if (Math.abs(thousands - 256) <= 10 || num === 262144) return "256K";
  if (Math.abs(thousands - 400) <= 10) return "400K";
  if (Math.abs(thousands - 512) <= 15) return "512K";
  return `${Math.round(thousands)}K`;
}

/**
 * Convert Unix seconds, Unix ms, ISO date, or RFC 2822 strings into YYYY-MM-DD and YYYY-MM.
 */
export function toIsoDate(input) {
  if (input === null || input === undefined || input === "") return null;

  let date;
  if (typeof input === "number" || /^\d{9,13}$/.test(String(input).trim())) {
    const num = Number(input);
    if (!Number.isFinite(num)) return null;
    // Heuristic: < 1e12 is seconds, >= 1e12 is ms
    const ms = num < 1e12 ? num * 1000 : num;
    date = new Date(ms);
  } else {
    date = new Date(String(input).trim());
  }

  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  const releaseDate = iso.slice(0, 10);
  return {
    releaseDate,
    releaseMonth: releaseDate.slice(0, 7),
  };
}

/**
 * Infer tier, semantic categories, openWeights boolean, and formatted context window.
 */
export function inferMetadata({
  orgId,
  name = "",
  description = "",
  modality = "",
  openWeights = false,
  contextTokens = null,
}) {
  const haystack = `${name} ${description} ${modality}`.toLowerCase();
  const categories = new Set();

  const isCompact = /\b(mini|nano|haiku|flash|lite|small|tiny|1b|2b|3b|4b|7b|8b|9b|12b|14b|24b|27b|32b)\b/i.test(
    name,
  );
  const isReasoning =
    /\b(o1|o3|o4|r1|r2|qwq|qvq|reasoning|think(?:ing)?|deep think|extended thinking|speci?ale|leanstral)\b/i.test(
      haystack,
    );
  const isMultimodal =
    /\b(vision|image|audio|voice|video|omni|multimodal|4o|gemini|muse|voxtral|pixtral|sora|veo|imagen|flux)\b/i.test(
      haystack,
    );
  const isOpen =
    Boolean(openWeights) ||
    ["meta", "deepseek", "qwen", "glm", "kimi"].includes(orgId) &&
      !/\b(max|api-only|closed|k1\.5)\b/i.test(name) ||
    /\b(open[- ]?weights?|open[- ]?source|apache\s*2\.0|mit license|gpt-oss|gemma|llama|mistral 7b|mixtral|codestral|devstral|voxtral|olmo|phi-\d|nemotron|kimi[\s-]*k[23]|kimi-vl|glm[\s-]*(?:4\.\d+|4-9b|4-32b|z1|5\b)|minimax[\s-]*m[12]|plamo-100b|plamo 3 translate|llm-jp|swallow|calm3|fugaku-llm|rakuten ai|stockmark-2|elyza)\b/i.test(
      haystack,
    );

  const isFlagship =
    !isCompact &&
    /\b(gpt-[456](?:\.\d+)?|o1|o3|claude[\s-]*(?:opus|sonnet)?[\s-]*(?:4|5|6)|gemini[\s-]*(?:2|3|4)|llama[\s-]*[345]|muse|deepseek-[vr]\d|grok[\s-]*[2345]|mistral[\s-]*large|qwen[\s-]*[234](?:\.\d+)?[\s-]*(?:max|coder|235b|2\.4t|72b)?|glm[\s-]*5(?:\.[4])?|kimi[\s-]*k[12345](?:\.\d+)?|minimax[\s-]*m[234]|seed[\s-]*[23](?:\.\d+)?|nemotron[\s-]*[34][\s-]*ultra|command[\s-]*a|plamo[\s-]*(?:100b|3\.0)|tsuzumi[\s-]*2|llm-jp-[34](?:\.1)?|sarashina[\s-]*3|rakuten[\s-]*ai[\s-]*3)\b/i.test(
      name,
    );

  if (isFlagship) categories.add("flagship");
  if (isReasoning) categories.add("reasoning");
  if (isOpen) categories.add("open-weights");
  if (isMultimodal) categories.add("multimodal");
  if (isCompact) categories.add("compact");

  if (categories.size === 0) {
    categories.add("flagship");
  }

  return {
    tier: isFlagship ? "flagship" : "notable",
    categories: [...categories],
    openWeights: isOpen,
    contextWindow: formatContextWindow(contextTokens),
  };
}
