import assert from "node:assert/strict";
import test from "node:test";
import { crawlGitHubReleases } from "../scripts/crawler/adapters/github.mjs";
import { crawlHuggingFace } from "../scripts/crawler/adapters/huggingface.mjs";
import { crawlOpenRouter } from "../scripts/crawler/adapters/openrouter.mjs";
import { crawlRssFeeds } from "../scripts/crawler/adapters/rss.mjs";
import { localizeCandidate } from "../scripts/crawler/lib/localizer.mjs";
import { mergeModels } from "../scripts/crawler/lib/merger.mjs";
import { formatContextWindow, toCanonicalKey, toIsoDate } from "../scripts/crawler/lib/normalizer.mjs";
import { evaluateNotability } from "../scripts/crawler/lib/notability-filter.mjs";
import { validateDataset } from "../scripts/crawler/lib/validator.mjs";
import { parseFeedXml } from "../scripts/crawler/lib/xml-parser.mjs";

const NOW = new Date("2026-11-23T12:00:00Z");

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return data;
    },
    async text() {
      return JSON.stringify(data);
    },
  };
}

function textResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body;
    },
  };
}

test("parseFeedXml parses RSS 2.0 CDATA/entities and Atom entries", () => {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel>
      <item>
        <title><![CDATA[Introducing GPT-6.5 &amp; Codex Upgrades]]></title>
        <link>https://openai.com/index/gpt-6-5/</link>
        <pubDate>Tue, 24 Nov 2026 10:00:00 GMT</pubDate>
        <description><![CDATA[<p>Faster <b>multimodal</b> reasoning.</p>]]></description>
      </item>
    </channel></rss>`;

  const atom = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Claude Opus 6 Release</title>
        <link rel="alternate" href="https://www.anthropic.com/news/claude-opus-6" />
        <updated>2026-11-25T09:00:00Z</updated>
        <summary>Flagship coding &amp; research model.</summary>
      </entry>
    </feed>`;

  const rssItems = parseFeedXml(rss);
  assert.equal(rssItems.length, 1);
  assert.equal(rssItems[0].title, "Introducing GPT-6.5 & Codex Upgrades");
  assert.equal(rssItems[0].link, "https://openai.com/index/gpt-6-5/");
  assert.equal(rssItems[0].summary, "Faster multimodal reasoning.");

  const atomItems = parseFeedXml(atom);
  assert.equal(atomItems.length, 1);
  assert.equal(atomItems[0].title, "Claude Opus 6 Release");
  assert.equal(atomItems[0].link, "https://www.anthropic.com/news/claude-opus-6");
  assert.equal(atomItems[0].summary, "Flagship coding & research model.");
});

test("normalizer strips prefixes/dates and formats context windows", () => {
  assert.equal(toCanonicalKey("openai", "openai/gpt-5.4-2026-03-05"), "openai:gpt-5-4");
  assert.equal(toCanonicalKey("anthropic", "Anthropic: Claude 3.7 Sonnet:beta"), "anthropic:claude-3-7-sonnet");
  assert.equal(formatContextWindow(1048576), "1M");
  assert.equal(formatContextWindow(128000), "128K");
  assert.equal(formatContextWindow(200000), "200K");
  assert.equal(formatContextWindow(512), null);
  assert.deepEqual(toIsoDate(1735200000), {
    releaseDate: "2024-12-26",
    releaseMonth: "2024-12",
  });
});

test("notability filter accepts landmark models and rejects noise/quantizations", () => {
  const good = evaluateNotability(
    {
      orgId: "openai",
      name: "GPT-6.5",
      releaseDate: "2026-11-20",
      description: "Flagship reasoning and coding upgrade",
      sourceType: "openrouter",
    },
    { now: NOW },
  );
  assert.equal(good.accepted, true);

  for (const notable of [
    { orgId: "openai", name: "gpt-oss-120b", releaseDate: "2026-11-20", sourceType: "openrouter" },
    { orgId: "mistral", name: "Pixtral Large", releaseDate: "2026-11-20", sourceType: "openrouter" },
    { orgId: "others", creator: "Moonshot", name: "Kimi K4", releaseDate: "2026-11-20", sourceType: "openrouter" },
    { orgId: "others", creator: "Z.ai", name: "GLM-5.4", releaseDate: "2026-11-20", sourceType: "openrouter" },
    { orgId: "others", creator: "Cohere", name: "Command A+", releaseDate: "2026-11-20", sourceType: "openrouter" },
  ]) {
    const res = evaluateNotability(notable, { now: NOW });
    assert.equal(res.accepted, true, `Expected acceptance for ${notable.name}, got ${res.reason}`);
  }

  const noiseCases = [
    { orgId: "meta", name: "Llama-4-Scout-GGUF", releaseDate: "2026-11-20", sourceType: "huggingface", likes: 500 },
    { orgId: "openai", name: "gpt-4o:free", releaseDate: "2026-11-20", sourceType: "openrouter" },
    { orgId: "openai", name: "text-embedding-3-large", releaseDate: "2026-11-20", sourceType: "openrouter" },
    {
      orgId: "openai",
      name: "OpenAI announces new safety board member",
      releaseDate: "2026-11-20",
      sourceType: "rss",
    },
    {
      orgId: "mistral",
      name: "Mistral AI closes Series D funding round",
      releaseDate: "2026-11-20",
      sourceType: "rss",
    },
    {
      orgId: "qwen",
      name: "Qwen4-7B-AWQ",
      releaseDate: "2026-11-20",
      sourceType: "huggingface",
      likes: 900,
    },
  ];

  for (const c of noiseCases) {
    const res = evaluateNotability(c, { now: NOW });
    assert.equal(res.accepted, false, `Expected rejection for ${c.name}, got ${res.reason}`);
  }
});

test("all 4 crawler adapters handle mocked responses and tolerate partial errors", async () => {
  const mockOpenRouter = async () =>
    jsonResponse({
      data: [
        {
          id: "openai/gpt-6.5",
          name: "OpenAI: GPT-6.5",
          created: 1795132800,
          context_length: 1048576,
          description: "Next-gen flagship model",
          architecture: { modality: "text+image->text" },
        },
        {
          id: "moonshotai/kimi-k4",
          name: "Moonshot: Kimi K4",
          created: 1795132800,
          context_length: 262144,
          description: "Next-gen MoE model",
          architecture: { modality: "text+image->text" },
        },
        {
          id: "some-unknown/model",
          name: "Ignored Org",
          created: 1795132800,
        },
      ],
    });

  const orRes = await crawlOpenRouter({ fetchFn: mockOpenRouter });
  assert.equal(orRes.ok, true);
  assert.equal(orRes.candidates.length, 2);
  assert.equal(orRes.candidates[0].orgId, "openai");
  assert.equal(orRes.candidates[0].name, "GPT-6.5");
  assert.equal(orRes.candidates[1].orgId, "others");
  assert.equal(orRes.candidates[1].creator, "Moonshot");
  assert.equal(orRes.candidates[1].name, "Kimi K4");

  const mockRss = async (url) => {
    if (url.includes("anthropic")) return textResponse("Server Error", 500);
    return textResponse(`<rss><channel><item>
      <title>Introducing Gemini 4.5 Pro</title>
      <link>https://deepmind.google/blog/gemini-4-5-pro/</link>
      <pubDate>Fri, 20 Nov 2026 08:00:00 GMT</pubDate>
      <description>New multimodal model.</description>
    </item></channel></rss>`);
  };

  const rssRes = await crawlRssFeeds({
    fetchFn: mockRss,
    feeds: [
      { id: "g", orgId: "google", label: "DeepMind", url: "https://deepmind.google/blog/rss.xml" },
      { id: "a", orgId: "anthropic", label: "Anthropic", url: "https://anthropic.test/rss.xml" },
    ],
  });
  assert.equal(rssRes.ok, true);
  assert.equal(rssRes.candidates.length, 1);
  assert.ok(rssRes.error.includes("HTTP 500"));

  const mockHf = async () =>
    jsonResponse([
      {
        id: "deepseek-ai/DeepSeek-R2",
        createdAt: "2026-11-21T00:00:00.000Z",
        likes: 1200,
        downloads: 50000,
        pipeline_tag: "text-generation",
        tags: ["reasoning", "mit"],
      },
    ]);

  const hfRes = await crawlHuggingFace({
    fetchFn: mockHf,
    orgs: [{ author: "deepseek-ai", orgId: "deepseek" }],
  });
  assert.equal(hfRes.ok, true);
  assert.equal(hfRes.candidates[0].name, "DeepSeek-R2");

  const mockGh = async () =>
    jsonResponse([
      {
        tag_name: "v4.5",
        name: "Qwen 4.5 Release",
        published_at: "2026-11-22T00:00:00Z",
        html_url: "https://github.com/QwenLM/Qwen3/releases/tag/v4.5",
        body: "Open weights release",
      },
    ]);

  const ghRes = await crawlGitHubReleases({
    fetchFn: mockGh,
    repos: [{ repo: "QwenLM/Qwen3", orgId: "qwen" }],
    token: "",
  });
  assert.equal(ghRes.ok, true);
  assert.equal(ghRes.candidates[0].name, "Qwen 4.5 Release");
});

test("localizer and merger deduplicate curated/aliases and append new notable discoveries", async () => {
  const orgs = [
    {
      id: "openai",
      order: 1,
      name: { ja: "OpenAI", zh: "OpenAI", en: "OpenAI" },
      website: "https://openai.com/news/",
    },
    {
      id: "deepseek",
      order: 2,
      name: { ja: "DeepSeek", zh: "DeepSeek", en: "DeepSeek" },
      website: "https://www.deepseek.com/",
    },
  ];

  const curatedModels = [
    {
      id: "openai-gpt-5",
      orgId: "openai",
      name: "GPT-5",
      releaseDate: "2025-08-07",
      releaseMonth: "2025-08",
      tier: "flagship",
      categories: ["flagship", "reasoning"],
      openWeights: false,
      contextWindow: "400K",
      summary: { ja: "curated ja", zh: "curated zh", en: "curated en" },
      highlights: { ja: ["a"], zh: ["b"], en: ["c"] },
      officialUrl: "https://openai.com/index/introducing-gpt-5/",
      source: "curated",
      aliases: ["gpt-5", "gpt-5-mini"],
    },
  ];

  const localized = await localizeCandidate(
    {
      orgId: "deepseek",
      name: "DeepSeek-R2",
      releaseDate: "2026-11-21",
      tier: "flagship",
      categories: ["flagship", "reasoning", "open-weights"],
      openWeights: true,
      contextWindow: "512K",
      description: "Next-gen RL reasoning open weights",
    },
    orgs[1],
  );
  assert.ok(localized.summary.ja.length > 5);
  assert.ok(localized.summary.zh.length > 5);
  assert.ok(localized.summary.en.length > 5);

  const merged = await mergeModels({
    curatedModels,
    existingCrawledModels: [],
    orgs,
    now: NOW,
    incomingCandidates: [
      // Duplicate of curated alias -> must NOT duplicate or overwrite curated
      {
        orgId: "openai",
        name: "gpt-5-mini",
        releaseDate: "2025-08-08",
        sourceType: "openrouter",
        officialUrl: "https://openrouter.ai/models/openai/gpt-5-mini",
      },
      // Same new model reported by two sources -> must collapse to 1 record with RSS URL priority
      {
        orgId: "deepseek",
        name: "DeepSeek-R2",
        releaseDate: "2026-11-21",
        contextTokens: 524288,
        openWeights: true,
        sourceType: "openrouter",
        officialUrl: "https://openrouter.ai/models/deepseek/deepseek-r2",
        discoveredFrom: "OpenRouter API",
      },
      {
        orgId: "deepseek",
        name: "Introducing DeepSeek-R2",
        releaseDate: "2026-11-21",
        sourceType: "rss",
        officialUrl: "https://www.deepseek.com/news/r2",
        discoveredFrom: "Official RSS",
      },
    ],
  });

  assert.equal(merged.addedModels.length, 1);
  assert.equal(merged.mergedModels.length, 2);
  assert.equal(merged.mergedModels[0].name, "DeepSeek-R2");
  assert.equal(merged.mergedModels[0].officialUrl, "https://www.deepseek.com/news/r2");
  assert.equal(merged.mergedModels[0].contextWindow, "512K");
  assert.equal(merged.mergedModels[1].summary.ja, "curated ja");

  assert.equal(validateDataset({ orgs, models: merged.mergedModels }), true);
});

test("validator rejects malformed dataset entries", () => {
  const orgs = [{ id: "openai", name: { ja: "OpenAI", zh: "OpenAI", en: "OpenAI" } }];
  assert.throws(() =>
    validateDataset({
      orgs,
      models: [
        {
          id: "bad-1",
          orgId: "unknown-org",
          name: "Bad Model",
          releaseDate: "2026-13-45",
          releaseMonth: "2026-12",
          tier: "weird",
          categories: [],
          openWeights: "yes",
          summary: { ja: "ok", zh: "", en: "ok" },
          highlights: { ja: ["x"], zh: [], en: ["z"] },
          officialUrl: "http://insecure.example.com",
        },
      ],
    }),
  );
});
