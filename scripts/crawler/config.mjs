export const USER_AGENT = "AIModelReleaseBot/1.0 (+https://github.com/actions)";
export const FETCH_TIMEOUT_MS = 12000;

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";

export const OPENROUTER_ORG_MAP = {
  openai: "openai",
  anthropic: "anthropic",
  google: "google",
  "meta-llama": "meta",
  deepseek: "deepseek",
  "x-ai": "xai",
  mistralai: "mistral",
  qwen: "qwen",
};

export const RSS_FEEDS = [
  {
    id: "openai-news",
    orgId: "openai",
    label: "OpenAI News RSS",
    url: "https://openai.com/news/rss.xml",
  },
  {
    id: "deepmind-blog",
    orgId: "google",
    label: "Google DeepMind Blog RSS",
    url: "https://deepmind.google/blog/rss.xml",
  },
  {
    id: "google-ai-blog",
    orgId: "google",
    label: "Google AI Blog RSS",
    url: "https://blog.google/technology/ai/rss/",
  },
  {
    id: "anthropic-news-mirror",
    orgId: "anthropic",
    label: "Anthropic News Feed",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_anthropic_news.xml",
  },
  {
    id: "mistral-news-mirror",
    orgId: "mistral",
    label: "Mistral News Feed",
    url: "https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_mistral_news.xml",
  },
];

export const HUGGINGFACE_ORGS = [
  { author: "meta-llama", orgId: "meta" },
  { author: "deepseek-ai", orgId: "deepseek" },
  { author: "Qwen", orgId: "qwen" },
  { author: "mistralai", orgId: "mistral" },
  { author: "google", orgId: "google" },
];

export const GITHUB_REPOS = [
  { repo: "meta-llama/llama-models", orgId: "meta" },
  { repo: "deepseek-ai/DeepSeek-V3", orgId: "deepseek" },
  { repo: "deepseek-ai/DeepSeek-R1", orgId: "deepseek" },
  { repo: "QwenLM/Qwen3", orgId: "qwen" },
];

/**
 * Fetch a URL with an AbortController timeout and standardized headers.
 */
export async function fetchWithTimeout(
  url,
  options = {},
  fetchFn = globalThis.fetch,
  timeoutMs = FETCH_TIMEOUT_MS,
) {
  if (typeof fetchFn !== "function") {
    throw new Error("fetchWithTimeout requires a valid fetch implementation");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      "User-Agent": USER_AGENT,
      Accept: "application/json, application/xml, text/xml, */*",
      ...(options.headers || {}),
    };
    return await fetchFn(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
