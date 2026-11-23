import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCrawl } from "./crawler/crawl.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const SRC_DIR = resolve(ROOT_DIR, "src");
const ASSETS_DIR = resolve(ROOT_DIR, "assets");
const DATA_DIR = resolve(ROOT_DIR, "data");
const DIST_DIR = resolve(ROOT_DIR, "dist");

async function main() {
  // Preserve existing crawl-meta.json if it came from a live crawl run
  let previousMeta = null;
  try {
    previousMeta = JSON.parse(await readFile(resolve(DATA_DIR, "crawl-meta.json"), "utf8"));
  } catch {
    previousMeta = null;
  }

  // Merge and strictly validate curated + crawled datasets offline
  const { dataset } = await runCrawl({
    offline: true,
    dryRun: true,
    dataDir: DATA_DIR,
  });

  const finalMeta =
    previousMeta && previousMeta.mode === "live-crawl"
      ? {
          ...previousMeta,
          curatedCount: dataset.meta.curatedCount,
          crawledCount: dataset.meta.crawledCount,
          totalCount: dataset.models.length,
        }
      : dataset.meta;

  const finalDataset = {
    generatedAt: previousMeta?.lastCrawledAt || dataset.generatedAt,
    meta: finalMeta,
    orgs: dataset.orgs,
    models: dataset.models,
  };

  // Keep data/releases.json in sync
  const jsonContent = `${JSON.stringify(finalDataset, null, 2)}\n`;
  await writeFile(resolve(DATA_DIR, "releases.json"), jsonContent, "utf8");

  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });

  await cp(SRC_DIR, DIST_DIR, { recursive: true });
  await cp(ASSETS_DIR, resolve(DIST_DIR, "assets"), { recursive: true });

  const distDataDir = resolve(DIST_DIR, "data");
  await mkdir(distDataDir, { recursive: true });

  const jsFallbackContent = `window.__AI_MODEL_RELEASES__ = ${JSON.stringify(finalDataset)};\n`;
  await writeFile(resolve(distDataDir, "releases.json"), jsonContent, "utf8");
  await writeFile(resolve(distDataDir, "releases.js"), jsFallbackContent, "utf8");
  await writeFile(resolve(DIST_DIR, ".nojekyll"), "", "utf8");
  await cp(resolve(ROOT_DIR, "CNAME"), resolve(DIST_DIR, "CNAME"));

  const criticalFiles = [
    "index.html",
    "styles/tokens.css",
    "styles/main.css",
    "js/app.js",
    "js/i18n.js",
    "js/icons.js",
    "js/state.js",
    "js/render.js",
    "assets/icon.svg",
    "data/releases.json",
    "data/releases.js",
    ".nojekyll",
    "CNAME",
  ];

  let totalBytes = 0;
  for (const rel of criticalFiles) {
    const info = await stat(resolve(DIST_DIR, rel));
    totalBytes += info.size;
  }

  console.log(
    `[build] dist/ ready: ${finalDataset.models.length} models across ${finalDataset.orgs.length} orgs (${totalBytes} bytes verified)`,
  );
}

main().catch((err) => {
  console.error("[build] fatal:", err);
  process.exit(1);
});
