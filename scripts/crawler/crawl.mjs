import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crawlGitHubReleases } from "./adapters/github.mjs";
import { crawlHuggingFace } from "./adapters/huggingface.mjs";
import { crawlOpenRouter } from "./adapters/openrouter.mjs";
import { crawlRssFeeds } from "./adapters/rss.mjs";
import { mergeModels } from "./lib/merger.mjs";
import { validateDataset } from "./lib/validator.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "../..");
const DEFAULT_DATA_DIR = resolve(ROOT_DIR, "data");

async function readJson(filePath, fallback = null) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (fallback !== null) return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/**
 * Execute the model release crawler pipeline (or offline merge) and validate output.
 */
export async function runCrawl({
  dryRun = false,
  offline = false,
  fetchFn = globalThis.fetch,
  dataDir = DEFAULT_DATA_DIR,
  now = new Date(),
} = {}) {
  const orgs = await readJson(resolve(dataDir, "orgs.json"));
  const curatedModels = await readJson(resolve(dataDir, "curated-models.json"));
  const existingCrawledModels = await readJson(resolve(dataDir, "crawled-models.json"), []);

  let incomingCandidates = [];
  let sourceReports = [];

  if (offline) {
    sourceReports = [
      { source: "openrouter", ok: true, mode: "offline", fetchedCount: 0, candidatesCount: 0 },
      { source: "rss", ok: true, mode: "offline", fetchedCount: 0, candidatesCount: 0 },
      { source: "huggingface", ok: true, mode: "offline", fetchedCount: 0, candidatesCount: 0 },
      { source: "github", ok: true, mode: "offline", fetchedCount: 0, candidatesCount: 0 },
    ];
  } else {
    const settled = await Promise.allSettled([
      crawlOpenRouter({ fetchFn }),
      crawlRssFeeds({ fetchFn }),
      crawlHuggingFace({ fetchFn }),
      crawlGitHubReleases({ fetchFn }),
    ]);

    const adapterNames = ["openrouter", "rss", "huggingface", "github"];
    sourceReports = settled.map((res, i) => {
      if (res.status === "fulfilled") {
        const val = res.value;
        incomingCandidates.push(...(val.candidates || []));
        return {
          source: val.source,
          ok: Boolean(val.ok),
          mode: "live",
          fetchedCount: val.fetchedCount || 0,
          candidatesCount: (val.candidates || []).length,
          ...(val.error ? { error: val.error } : {}),
        };
      }
      return {
        source: adapterNames[i],
        ok: false,
        mode: "live",
        fetchedCount: 0,
        candidatesCount: 0,
        error: res.reason instanceof Error ? res.reason.message : String(res.reason),
      };
    });
  }

  const { crawledModels, mergedModels, addedModels, skippedCount } = await mergeModels({
    curatedModels,
    existingCrawledModels,
    incomingCandidates,
    orgs,
    now,
    fetchFn: offline ? null : fetchFn,
  });

  validateDataset({ orgs, models: mergedModels });

  const meta = {
    lastCrawledAt: now.toISOString(),
    mode: offline ? "offline-sync" : "live-crawl",
    curatedCount: curatedModels.length,
    crawledCount: crawledModels.length,
    totalCount: mergedModels.length,
    addedCount: addedModels.length,
    skippedCount,
    sources: sourceReports,
  };

  const dataset = {
    generatedAt: now.toISOString(),
    meta,
    orgs,
    models: mergedModels,
  };

  if (!dryRun) {
    await writeJson(resolve(dataDir, "crawled-models.json"), crawledModels);
    await writeJson(resolve(dataDir, "crawl-meta.json"), meta);
    await writeJson(resolve(dataDir, "releases.json"), dataset);
  }

  return { dataset, meta, addedModels };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const offline = args.has("--offline");

  const { meta, addedModels } = await runCrawl({ dryRun, offline });

  console.log(
    `[crawler] mode=${meta.mode} dryRun=${dryRun} total=${meta.totalCount} (curated=${meta.curatedCount}, crawled=${meta.crawledCount}, added=${meta.addedCount}, skipped=${meta.skippedCount})`,
  );
  for (const s of meta.sources) {
    const errText = s.error ? ` err="${s.error}"` : "";
    console.log(
      `  - ${s.source}: ok=${s.ok} fetched=${s.fetchedCount} candidates=${s.candidatesCount}${errText}`,
    );
  }
  if (addedModels.length > 0) {
    console.log(`[crawler] newly added: ${addedModels.map((m) => `${m.orgId}/${m.name}`).join(", ")}`);
  }
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((err) => {
    console.error("[crawler] fatal:", err);
    process.exit(1);
  });
}
