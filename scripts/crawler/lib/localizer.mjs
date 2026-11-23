import { fetchWithTimeout } from "../config.mjs";

function cleanSentence(text, maxLen = 170) {
  if (!text) return "";
  const trimmed = String(text).replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trimEnd()}…`;
}

function buildDeterministicLocalization(candidate, org) {
  const orgJa = org?.name?.ja || candidate.orgId;
  const orgZh = org?.name?.zh || candidate.orgId;
  const orgEn = org?.name?.en || candidate.orgId;
  const isOpen = Boolean(candidate.openWeights);
  const ctx = candidate.contextWindow;
  const isReasoning = candidate.categories?.includes("reasoning");
  const isMultimodal = candidate.categories?.includes("multimodal");
  const isFlagship = candidate.tier === "flagship";

  const jaTraits = [
    isFlagship ? "フラッグシップ世代モデル" : "主要アップデートモデル",
    isOpen ? "オープンウェイト公開" : "クラウド/API展開",
    isReasoning ? "高度推論対応" : null,
    isMultimodal ? "マルチモーダル対応" : null,
    ctx ? `最大${ctx}コンテキスト` : null,
  ].filter(Boolean);

  const zhTraits = [
    isFlagship ? "新一代旗舰模型" : "重要版本更新",
    isOpen ? "开放权重开源" : "云端 API 服务",
    isReasoning ? "支持深度推理" : null,
    isMultimodal ? "多模态理解" : null,
    ctx ? `支持 ${ctx} 上下文` : null,
  ].filter(Boolean);

  const enTraits = [
    isFlagship ? "Flagship release" : "Notable release",
    isOpen ? "open-weights" : "API / cloud release",
    isReasoning ? "advanced reasoning" : null,
    isMultimodal ? "multimodal" : null,
    ctx ? `${ctx} context window` : null,
  ].filter(Boolean);

  const rawDesc = cleanSentence(candidate.description || "", 150);

  const summary = {
    ja: `${orgJa}が公開した${candidate.name}（${jaTraits.slice(0, 3).join("・")}）。`,
    zh: `${orgZh}发布的 ${candidate.name}，${zhTraits.slice(0, 3).join("、")}。`,
    en: rawDesc
      ? `${candidate.name} by ${orgEn}: ${rawDesc}`
      : `${orgEn} released ${candidate.name} (${enTraits.slice(0, 3).join(", ")}).`,
  };

  const highlights = {
    ja: [
      `${candidate.releaseDate} 公開（自動クロール検知: ${candidate.discoveredFrom || "official"}）`,
      jaTraits.join(" / "),
    ],
    zh: [
      `发布于 ${candidate.releaseDate}（每日自动抓取收录）`,
      zhTraits.join(" / "),
    ],
    en: [
      `Released ${candidate.releaseDate} (auto-tracked via ${candidate.discoveredFrom || "crawler"})`,
      enTraits.join(" · "),
    ],
  };

  return { summary, highlights };
}

/**
 * Localize an auto-crawled model into JA / ZH / EN with deterministic baseline
 * and optional Gemini API refinement when GEMINI_API_KEY is configured in live mode.
 */
export async function localizeCandidate(
  candidate,
  org,
  { fetchFn = null, geminiApiKey = process.env.GEMINI_API_KEY } = {},
) {
  const baseline = buildDeterministicLocalization(candidate, org);
  if (!geminiApiKey || typeof fetchFn !== "function") {
    return baseline;
  }

  try {
    const prompt = [
      "Return ONLY valid JSON with keys summary {ja, zh, en} and highlights {ja, zh, en} (arrays of 2 short strings each).",
      `Model: ${candidate.name}`,
      `Organization: ${org?.name?.en || candidate.orgId}`,
      `Date: ${candidate.releaseDate}`,
      `Context: ${candidate.contextWindow || "unknown"}`,
      `Description: ${cleanSentence(candidate.description || "", 300)}`,
    ].join("\n");

    const resp = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
      fetchFn,
      8000,
    );
    if (!resp.ok) return baseline;
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return baseline;
    const parsed = JSON.parse(text);
    const validLangs = ["ja", "zh", "en"].every(
      (l) =>
        typeof parsed?.summary?.[l] === "string" &&
        parsed.summary[l].trim().length > 0 &&
        Array.isArray(parsed?.highlights?.[l]) &&
        parsed.highlights[l].length > 0,
    );
    return validLangs ? parsed : baseline;
  } catch {
    return baseline;
  }
}
