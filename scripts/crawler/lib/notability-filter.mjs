import { cleanDisplayName } from "./normalizer.mjs";

const BLOCKLIST_PATTERNS = [
  /\b(gguf|awq|gptq|exl2|fp8|fp16|bf16|int4|int8|q4_k|q8_0|mlx|onnx|lora|qlora|abliterated|uncensored)\b/i,
  /:(free|nitro|extended|floor|online|exacto)\b/i,
  /\b(embedding|rerank|moderation|guard|shield|classifier|reward|whisper-tiny|bge-|tts-1|dall-e-2)\b/i,
  /\b(hiring|board member|safety board|partnership|series\s+[a-z]|funding|podcast|summit|webinar|outage|pricing update|deprecat|terms of use|lawsuit|policy update|academy|scholarship|fellowship)\b/i,
];

const ORG_NOTABLE_PATTERNS = {
  openai: /\b(gpt-[456](?:\.\d+)?(?:\s*(?:o|mini|turbo|astra|sol|luna|terra))?|gpt-oss(?:-\d+b)?|openai\s+o[134](?:-mini|-pro|-preview)?|o[134](?:-mini|-pro)?|sora(?:\s*\d+)?)\b/i,
  anthropic: /\b(claude[\s-]*(?:opus|sonnet|haiku|mythos|fable)?[\s-]*(?:3(?:\.[57])?|4(?:\.[156])?|5(?:\.[25])?|6(?:\.\d+)?)(?:[\s-]*(?:opus|sonnet|haiku))?|claude[\s-]*(?:opus|sonnet|haiku|mythos|fable)[\s-]*\d+(?:\.\d+)?)\b/i,
  google: /\b(gemini[\s-]*(?:1\.5|2(?:\.[05])?|3(?:\.\d+)?|4(?:\.\d+)?)(?:[\s-]*(?:pro|flash|flash-lite|ultra|live|argon|carbon|hydrogen|neon))?|gemma[\s-]*[234](?:n)?|veo[\s-]*[234]|imagen[\s-]*[34])\b/i,
  meta: /\b(llama[\s-]*[345](?:\.\d+)?(?:[\s-]*(?:scout|maverick|behemoth))?|meta[\s-]*muse|muse[\s-]*(?:wonder|spark|glimmer))\b/i,
  deepseek: /\b(deepseek[\s-]*(?:v[234](?:\.\d+)?|r[12]|coder-v2)(?:[\s-]*(?:pro|flash|lite|speciale|exp))?)\b/i,
  xai: /\b(grok[\s-]*(?:1\.5|2|3|4(?:\.\d+)?|5(?:\.\d+)?|voice[\s-]*\d(?:\.\d+)?)(?:[\s-]*(?:mini|heavy|fast))?)\b/i,
  mistral: /\b(mistral[\s-]*(?:large|medium|small)[\s-]*[2345]?|mixtral[\s-]*8x(?:7|22)b|pixtral(?:\s*large)?|codestral|devstral|magistral|voxtral(?:\s*[23])?|leanstral)\b/i,
  qwen: /\b(qwen[\s-]*[234](?:\.\d+)?(?:[\s-]*(?:max|plus|turbo|coder|vl|omni|next|235b|2\.4t|27b|32b|72b))?|qwq[\s-]*(?:32b|\d+b)|qvq[\s-]*\d+b)\b/i,
  others: /(?:^|[^a-z0-9])(?:glm[\s-]*(?:4\.\d+|5(?:\.\d+)?|z1)|kimi[\s-]*k[2345](?:\.\d+)?|minimax[\s-]*m[1234](?:\.\d+)?|seed[\s-]*[23](?:\.\d+)?|nemotron[\s-]*[345](?:[\s-]*(?:nano|super|ultra))?|phi[\s-]*[345]|command[\s-]*(?:r(?:\+|-plus)?|a(?:\+|-plus)?)|amazon[\s-]*nova|nova[\s-]*(?:micro|lite|pro|premier)|flux[\s.]*[123]|olmo[\s-]*[234])(?![a-z0-9])/i,
};

const RSS_RELEASE_CUE_RE = /\b(introduc|announc|releas|launch|unveil|availab|new model|open[- ]?weights?|preview|introducing|now available|rolling out)\b/i;

/**
 * Evaluate whether an incoming crawler candidate represents a famous/notable AI model release.
 */
export function evaluateNotability(candidate, { now = new Date() } = {}) {
  if (!candidate || !candidate.orgId || !candidate.name) {
    return { accepted: false, reason: "missing_required_fields", canonicalName: "" };
  }

  const orgPattern = ORG_NOTABLE_PATTERNS[candidate.orgId];
  if (!orgPattern) {
    return { accepted: false, reason: "unsupported_org", canonicalName: "" };
  }

  const rawText = `${candidate.name} ${candidate.description || ""}`;
  for (const blocker of BLOCKLIST_PATTERNS) {
    if (blocker.test(rawText)) {
      return { accepted: false, reason: "blocked_noise_pattern", canonicalName: "" };
    }
  }

  if (!orgPattern.test(candidate.name) && !orgPattern.test(rawText)) {
    return { accepted: false, reason: "not_in_notable_families", canonicalName: "" };
  }

  if (candidate.sourceType === "rss") {
    const hasCue = RSS_RELEASE_CUE_RE.test(rawText) || orgPattern.test(candidate.name.trim());
    if (!hasCue) {
      return { accepted: false, reason: "rss_missing_release_cue", canonicalName: "" };
    }
  }

  if (candidate.sourceType === "huggingface" && !candidate.skipPopularityGate) {
    const likes = Number(candidate.likes || 0);
    const downloads = Number(candidate.downloads || 0);
    if (likes < 80 && downloads < 5000) {
      return { accepted: false, reason: "hf_below_notability_threshold", canonicalName: "" };
    }
  }

  if (!candidate.releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate.releaseDate)) {
    return { accepted: false, reason: "invalid_release_date", canonicalName: "" };
  }

  if (candidate.releaseDate < "2022-11-01") {
    return { accepted: false, reason: "before_tracking_window", canonicalName: "" };
  }

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (candidate.releaseDate > tomorrow) {
    return { accepted: false, reason: "future_date_rejected", canonicalName: "" };
  }

  // Prefer extracting the crisp model family name if title is an announcement sentence
  let canonicalName = cleanDisplayName(candidate.name);
  if (candidate.sourceType === "rss" && canonicalName.length > 48) {
    const familyMatch = canonicalName.match(orgPattern);
    if (familyMatch) {
      canonicalName = familyMatch[0].trim();
    }
  }

  return {
    accepted: true,
    reason: "accepted",
    canonicalName,
  };
}
