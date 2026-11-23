import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { runCrawl } from "../scripts/crawler/crawl.mjs";
import { toCanonicalKey } from "../scripts/crawler/lib/normalizer.mjs";
import { validateDataset } from "../scripts/crawler/lib/validator.mjs";
import {
  SUPPORTED_LANGS,
  UI_TEXT,
  formatFullDate,
  formatMonth,
} from "../src/js/i18n.js";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

test("curated dataset passes strict schema validation and spans 2022-11 to 2026-11 across all 12 orgs", async () => {
  const orgs = JSON.parse(await readFile(resolve(ROOT_DIR, "data/orgs.json"), "utf8"));
  const models = JSON.parse(await readFile(resolve(ROOT_DIR, "data/curated-models.json"), "utf8"));

  assert.equal(orgs.length, 12);
  assert.ok(models.length >= 165);
  assert.equal(validateDataset({ orgs, models }), true);

  assert.deepEqual(
    orgs.filter((o) => o.group === "closed").map((o) => o.id),
    ["openai", "anthropic", "google", "xai"],
  );
  assert.deepEqual(
    orgs.filter((o) => o.group === "open").map((o) => o.id),
    ["meta", "deepseek", "mistral", "qwen", "glm", "kimi"],
  );
  assert.deepEqual(
    orgs.filter((o) => o.group === "japan").map((o) => o.id),
    ["japan"],
  );
  assert.deepEqual(
    orgs.filter((o) => o.group === "others").map((o) => o.id),
    ["others"],
  );

  const japanModels = models.filter((m) => m.orgId === "japan");
  assert.ok(japanModels.length >= 18);
  for (const m of japanModels) {
    assert.ok(typeof m.creator === "string" && m.creator.trim().length > 0, `Missing creator on ${m.id}`);
  }

  const othersModels = models.filter((m) => m.orgId === "others");
  assert.ok(othersModels.length >= 18);
  for (const m of othersModels) {
    assert.ok(typeof m.creator === "string" && m.creator.trim().length > 0, `Missing creator on ${m.id}`);
  }

  const coveredOrgs = new Set(models.map((m) => m.orgId));
  for (const org of orgs) {
    assert.ok(coveredOrgs.has(org.id), `Missing curated models for ${org.id}`);
  }

  const canonicalKeys = new Set();
  for (const m of models) {
    const k = toCanonicalKey(m.orgId, m.name);
    assert.ok(!canonicalKeys.has(k), `Duplicate canonical key in curated models: ${k}`);
    canonicalKeys.add(k);
  }

  const months = models.map((m) => m.releaseMonth).sort();
  assert.equal(months[0], "2022-11");
  assert.equal(months[months.length - 1], "2026-11");
});

test("i18n dictionary has 100% key parity across JA, ZH, and EN and formats dates properly", () => {
  assert.deepEqual(SUPPORTED_LANGS, ["ja", "zh", "en"]);
  const baseKeys = Object.keys(UI_TEXT.ja).sort();

  for (const lang of SUPPORTED_LANGS) {
    const keys = Object.keys(UI_TEXT[lang]).sort();
    assert.deepEqual(keys, baseKeys, `Key mismatch in UI_TEXT.${lang}`);
    for (const k of keys) {
      assert.equal(typeof UI_TEXT[lang][k], "string");
      assert.ok(UI_TEXT[lang][k].trim().length > 0, `Empty i18n value for ${lang}.${k}`);
    }
  }

  assert.equal(formatMonth("2026-11", "ja"), "2026年11月");
  assert.equal(formatMonth("2026-11", "zh"), "2026年11月");
  assert.equal(formatMonth("2026-11", "en"), "Nov 2026");

  assert.equal(formatFullDate("2026-11-17", "ja"), "2026年11月17日");
  assert.equal(formatFullDate("2026-11-17", "en"), "November 17, 2026");
});

test("offline crawl and static build emit complete GitHub Pages dist/ with relative paths", async () => {
  const crawlResult = await runCrawl({
    offline: true,
    dryRun: true,
    dataDir: resolve(ROOT_DIR, "data"),
  });
  assert.equal(crawlResult.meta.mode, "offline-sync");
  assert.ok(crawlResult.dataset.models.length >= 75);

  const { stdout } = await execFileAsync(process.execPath, [resolve(ROOT_DIR, "scripts/build.mjs")], {
    cwd: ROOT_DIR,
  });
  assert.match(stdout, /\[build\] dist\/ ready:/);

  const expectedOutputs = [
    "dist/index.html",
    "dist/styles/tokens.css",
    "dist/styles/main.css",
    "dist/js/app.js",
    "dist/js/i18n.js",
    "dist/assets/icon.svg",
    "dist/data/releases.json",
    "dist/data/releases.js",
    "dist/.nojekyll",
    "dist/CNAME",
  ];

  for (const rel of expectedOutputs) {
    const info = await stat(resolve(ROOT_DIR, rel));
    assert.ok(info.isFile(), `Expected output file missing: ${rel}`);
  }

  const cname = (await readFile(resolve(ROOT_DIR, "dist/CNAME"), "utf8")).trim();
  assert.equal(cname, "model.nightly.dedyn.io");

  const indexHtml = await readFile(resolve(ROOT_DIR, "dist/index.html"), "utf8");
  assert.ok(!indexHtml.includes('href="/styles/'), "Found non-relative /styles/ path in index.html");
  assert.ok(!indexHtml.includes('src="/js/'), "Found non-relative /js/ path in index.html");
  assert.ok(indexHtml.includes('href="./styles/main.css"'));
  assert.ok(indexHtml.includes('src="./js/app.js"'));
});
