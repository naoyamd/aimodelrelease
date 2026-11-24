import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function findHeadlessBrowser() {
  const envPath = process.env.OGP_BROWSER_PATH;
  if (envPath && existsSync(envPath)) return envPath;

  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "No Chromium/Chrome/Edge executable found. Set OGP_BROWSER_PATH to generate OGP images.",
  );
}

async function readPngDimensions(filePath) {
  const buf = await readFile(filePath);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error(`Invalid PNG header in ${filePath}`);
  }
  const chunkType = buf.subarray(12, 16).toString("ascii");
  if (chunkType !== "IHDR") {
    throw new Error(`Missing IHDR chunk in ${filePath}`);
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bytes: buf.length,
  };
}

async function renderHtmlToPng({ browserPath, html, outPath, width, height, workDir }) {
  const htmlPath = resolve(workDir, `render-${width}x${height}.html`);
  const profileDir = resolve(workDir, `profile-${width}x${height}`);
  await writeFile(htmlPath, html, "utf8");

  const args = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--force-device-scale-factor=1",
    `--user-data-dir=${profileDir}`,
    `--window-size=${width},${height}`,
    `--screenshot=${outPath}`,
    htmlPath,
  ];

  await execFileAsync(browserPath, args, { windowsHide: true });
  const dims = await readPngDimensions(outPath);
  if (dims.width !== width || dims.height !== height) {
    throw new Error(
      `Expected ${width}x${height} PNG at ${outPath}, got ${dims.width}x${dims.height}`,
    );
  }
  return dims;
}

function selectShowcaseMonths(orgs, models, count = 4) {
  const byMonth = new Map();
  for (const m of models) {
    if (!byMonth.has(m.releaseMonth)) {
      byMonth.set(m.releaseMonth, []);
    }
    byMonth.get(m.releaseMonth).push(m);
  }

  const allMonthsDesc = [...byMonth.keys()].sort().reverse();
  const recentPool = allMonthsDesc.slice(0, 12);

  // Always include newest release month first, then greedily cover uncovered orgs across recent months
  const picked = [];
  const coveredOrgs = new Set();
  const addMonth = (ym) => {
    if (!ym || picked.includes(ym)) return;
    picked.push(ym);
    for (const item of byMonth.get(ym) || []) {
      coveredOrgs.add(item.orgId);
    }
  };

  addMonth(allMonthsDesc[0]);

  while (picked.length < count && picked.length < recentPool.length) {
    let bestYm = null;
    let bestScore = -1;
    for (const ym of recentPool) {
      if (picked.includes(ym)) continue;
      const items = byMonth.get(ym) || [];
      const orgSet = new Set(items.map((i) => i.orgId));
      let newlyCovered = 0;
      for (const orgId of orgSet) {
        if (!coveredOrgs.has(orgId)) newlyCovered += 1;
      }
      const flagships = items.filter((i) => i.tier === "flagship").length;
      const score = newlyCovered * 20 + orgSet.size * 3 + flagships;
      if (score > bestScore) {
        bestScore = score;
        bestYm = ym;
      }
    }
    if (!bestYm) break;
    addMonth(bestYm);
  }

  picked.sort().reverse();

  return picked.map((ym) => {
    const monthItems = byMonth.get(ym) || [];
    const byOrg = new Map();
    for (const org of orgs) {
      const orgItems = monthItems
        .filter((m) => m.orgId === org.id)
        .sort((a, b) => {
          const tierDiff = (b.tier === "flagship" ? 1 : 0) - (a.tier === "flagship" ? 1 : 0);
          return tierDiff || b.releaseDate.localeCompare(a.releaseDate);
        });
      byOrg.set(org.id, orgItems.slice(0, 2));
    }
    return { ym, byOrg };
  });
}

function buildOgpHtml({ orgs, models }) {
  const rows = selectShowcaseMonths(orgs, models, 4);
  const monthsSorted = models.map((m) => m.releaseMonth).sort();
  const minYm = (monthsSorted[0] || "2022-11").replace("-", ".");
  const maxYm = (monthsSorted[monthsSorted.length - 1] || "2026-11").replace("-", ".");

  const groupMeta = {
    closed: { label: "非公開寄り · API主導", bg: "#f1f0ec", ink: "#18181b" },
    open: { label: "公開寄り · オープン主導", bg: "#e6f4f1", ink: "#0f766e" },
    japan: { label: "日本発", bg: "#fee2e2", ink: "#b91c1c" },
    others: { label: "OTHERS", bg: "#f1f5f9", ink: "#475569" },
  };

  const boundaryIds = new Set();
  const groupRuns = [];
  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i];
    const g = org.group || "others";
    if (i > 0 && (orgs[i - 1].group || "others") !== g) {
      boundaryIds.add(org.id);
    }
    const prev = groupRuns[groupRuns.length - 1];
    if (prev && prev.group === g) prev.count += 1;
    else groupRuns.push({ group: g, count: 1 });
  }

  const groupHeadersHtml = groupRuns
    .map((run, idx) => {
      const gm = groupMeta[run.group] || groupMeta.others;
      return `<div class="g-band ${idx > 0 ? "is-bound" : ""}" style="grid-column: span ${run.count}; background: ${gm.bg}; color: ${gm.ink}; box-shadow: inset 0 3px 0 ${gm.ink};">
        <span>${escapeHtml(gm.label)}</span>
        ${run.count > 1 ? `<span class="g-count" style="background: ${gm.ink};">${run.count}</span>` : ""}
      </div>`;
    })
    .join("");

  const orgHeadersHtml = orgs
    .map((org) => {
      const code = String(org.order ?? 0).padStart(2, "0");
      const name = org.shortName?.en || org.name?.en || org.id;
      const isBound = boundaryIds.has(org.id);
      return `<div class="o-head ${isBound ? "is-bound" : ""}" style="border-top-color: ${escapeHtml(org.color)}; background: color-mix(in srgb, ${escapeHtml(org.color)} 6%, #ffffff);">
        <span class="o-code" style="background: ${escapeHtml(org.color)};">${escapeHtml(code)}</span>
        <span class="o-name">${escapeHtml(name)}</span>
      </div>`;
    })
    .join("");

  const rowsHtml = rows
    .map(({ ym, byOrg }) => {
      const cells = orgs
        .map((org) => {
          const items = byOrg.get(org.id) || [];
          const isBound = boundaryIds.has(org.id);
          return `<div class="cell ${isBound ? "is-bound" : ""}" style="background: color-mix(in srgb, ${escapeHtml(org.color)} ${items.length ? "4.5%" : "2%"}, #ffffff);">
            ${
              items.length
                ? items
                    .map((item) => {
                      const isMajor = item.tier === "flagship";
                      return `<div class="pill ${isMajor ? "is-major" : ""}" style="border-left-color: ${escapeHtml(org.color)}; ${isMajor ? `background: color-mix(in srgb, ${escapeHtml(org.color)} 10%, #ffffff);` : ""}">
                        <span class="pill-name">${escapeHtml(item.name)}</span>
                      </div>`;
                    })
                    .join("")
                : `<span class="cell-empty">—</span>`
            }
          </div>`;
        })
        .join("");

      return `<div class="m-row">
        <div class="m-ym">${escapeHtml(ym)}</div>
        ${cells}
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 1200px;
    height: 630px;
    overflow: hidden;
    background: #ffffff;
    color: #0a0a0a;
    font-family: "Noto Sans JP", "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .canvas {
    width: 1200px;
    height: 630px;
    padding: 26px 32px;
    background: #ffffff;
    display: flex;
  }
  .frame {
    width: 100%;
    height: 100%;
    border: 3px solid #0a0a0a;
    display: flex;
    flex-direction: column;
    background: #ffffff;
  }
  .masthead {
    padding: 15px 20px;
    border-bottom: 2.5px solid #0a0a0a;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    background: #ffffff;
  }
  .brand-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .mark {
    height: 52px;
    padding: 0 13px;
    background: #0a0a0a;
    color: #ffffff;
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.04em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mark-slash { color: #ff3b00; }
  .title-block { display: flex; flex-direction: column; gap: 2px; }
  .title {
    margin: 0;
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.05;
  }
  .subtitle {
    margin: 0;
    font-size: 14.5px;
    font-weight: 700;
    color: #3a3a3a;
  }
  .brand-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
  }
  .badges { display: flex; align-items: center; gap: 6px; }
  .signal-pill {
    padding: 3px 8px;
    background: #ff3b00;
    color: #ffffff;
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .lang-pill {
    padding: 2px 8px;
    border: 1.5px solid #0a0a0a;
    background: #f7f7f7;
    font-family: "Cascadia Mono", "Noto Sans JP", sans-serif;
    font-size: 11px;
    font-weight: 700;
  }
  .domain-tag {
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 13px;
    font-weight: 700;
    color: #0a0a0a;
  }
  .matrix {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .g-row, .o-row, .m-row {
    display: grid;
    grid-template-columns: 60px repeat(12, minmax(0, 1fr));
  }
  .g-row {
    border-bottom: 1.5px solid #0a0a0a;
  }
  .g-corner {
    background: #0a0a0a;
    color: #ffffff;
    border-right: 2px solid #0a0a0a;
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 2px;
  }
  .g-band {
    padding: 4px 7px;
    font-family: "Cascadia Mono", "Noto Sans JP", sans-serif;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    border-right: 1px solid #d4d4d4;
    white-space: nowrap;
    overflow: hidden;
  }
  .g-band:last-child { border-right: 0; }
  .g-count {
    padding: 0 4px;
    color: #ffffff;
    font-size: 9px;
    line-height: 1.3;
  }
  .o-row {
    border-bottom: 2px solid #0a0a0a;
  }
  .o-corner {
    background: #0a0a0a;
    color: #ffffff;
    border-right: 2px solid #0a0a0a;
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 2px;
  }
  .o-head {
    border-top: 5px solid #0a0a0a;
    border-right: 1px solid #d4d4d4;
    padding: 5px 5px;
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .o-head:last-child { border-right: 0; }
  .o-code {
    padding: 1px 3px;
    color: #ffffff;
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 8.5px;
    font-weight: 700;
    flex-shrink: 0;
  }
  .o-name {
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rows-wrap {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
  }
  .m-row {
    flex: 1 1 0;
    border-bottom: 1px solid #d4d4d4;
    min-height: 0;
  }
  .m-row:last-child { border-bottom: 0; }
  .m-ym {
    background: #f7f7f7;
    border-right: 2px solid #0a0a0a;
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #0a0a0a;
  }
  .cell {
    border-right: 1px solid #e2e2e2;
    padding: 4px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 3px;
    min-width: 0;
    overflow: hidden;
  }
  .cell:last-child { border-right: 0; }
  .cell-empty {
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 10px;
    color: #c2c2c2;
    text-align: center;
  }
  .pill {
    padding: 3px 4px;
    border-left: 3px solid #0a0a0a;
    background: rgba(255, 255, 255, 0.85);
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .pill.is-major {
    border: 1.5px solid #0a0a0a;
    border-left: 4px solid #0a0a0a;
    font-weight: 700;
  }
  .pill-name {
    font-size: 9.5px;
    line-height: 1.18;
    font-weight: 700;
    color: #0a0a0a;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }
  .is-bound {
    border-left: 2.5px solid #0a0a0a !important;
  }
  .footer {
    height: 38px;
    background: #0a0a0a;
    color: #ffffff;
    padding: 0 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: "Cascadia Mono", Consolas, monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    flex-shrink: 0;
  }
  .hl { color: #ff3b00; }
  .muted { color: #a3a3a3; }
</style>
</head>
<body>
  <div class="canvas">
    <div class="frame">
      <header class="masthead">
        <div class="brand-left">
          <div class="mark">MR<span class="mark-slash">//</span>26</div>
          <div class="title-block">
            <h1 class="title">AI MODEL RELEASE RADAR</h1>
            <p class="subtitle">主要AIモデルの企業 × 月別リリース時刻表</p>
          </div>
        </div>
        <div class="brand-right">
          <div class="badges">
            <span class="signal-pill">DAILY AUTO-UPDATED</span>
            <span class="lang-pill">JA / 中文 / EN</span>
          </div>
          <div class="domain-tag">https://model.nightly.dedyn.io/</div>
        </div>
      </header>

      <section class="matrix">
        <div class="g-row">
          <div class="g-corner">GROUP</div>
          ${groupHeadersHtml}
        </div>
        <div class="o-row">
          <div class="o-corner">MO / LAB</div>
          ${orgHeadersHtml}
        </div>
        <div class="rows-wrap">
          ${rowsHtml}
        </div>
      </section>

      <footer class="footer">
        <div>
          <span class="hl">${models.length}</span> MODELS TRACKED
          <span class="muted">·</span>
          <span class="hl">${orgs.length}</span> LABS / 4 ZONES
          <span class="muted">·</span>
          ${escapeHtml(minYm)} – ${escapeHtml(maxYm)}
        </div>
        <div>model.nightly.dedyn.io</div>
      </footer>
    </div>
  </div>
</body>
</html>`;
}

function buildTouchIconHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 180px;
    height: 180px;
    overflow: hidden;
    background: #0a0a0a;
    color: #ffffff;
    font-family: "Cascadia Mono", Consolas, monospace;
  }
  .tile {
    width: 180px;
    height: 180px;
    padding: 16px;
    border: 4px solid #0a0a0a;
    background: #0a0a0a;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .bars {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    height: 14px;
  }
  .center {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 2px;
  }
  .mr {
    font-size: 54px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
  }
  .yr {
    font-size: 26px;
    font-weight: 700;
    color: #ff3b00;
    line-height: 1;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
    height: 18px;
  }
  .sq { background: #262626; }
  .sq.on { background: #ffffff; }
  .sq.sig { background: #ff3b00; }
</style>
</head>
<body>
  <div class="tile">
    <div class="bars">
      <div style="background:#00875a;"></div>
      <div style="background:#1d4ed8;"></div>
      <div style="background:#0f766e;"></div>
      <div style="background:#dc2626;"></div>
    </div>
    <div class="center">
      <span class="mr">MR</span><span class="yr">//26</span>
    </div>
    <div class="grid">
      <div class="sq on"></div>
      <div class="sq"></div>
      <div class="sq on"></div>
      <div class="sq sig"></div>
      <div class="sq on"></div>
      <div class="sq"></div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  const browserPath = findHeadlessBrowser();
  const orgs = JSON.parse(await readFile(resolve(ROOT_DIR, "data/orgs.json"), "utf8"));
  let models;
  try {
    const releases = JSON.parse(await readFile(resolve(ROOT_DIR, "data/releases.json"), "utf8"));
    models = releases.models;
  } catch {
    models = JSON.parse(await readFile(resolve(ROOT_DIR, "data/curated-models.json"), "utf8"));
  }

  const workDir = await mkdtemp(resolve(tmpdir(), "aimodelrelease-ogp-"));
  try {
    const ogpOut = resolve(ROOT_DIR, "assets/ogp.png");
    const iconOut = resolve(ROOT_DIR, "assets/apple-touch-icon.png");

    const ogpInfo = await renderHtmlToPng({
      browserPath,
      html: buildOgpHtml({ orgs, models }),
      outPath: ogpOut,
      width: 1200,
      height: 630,
      workDir,
    });
    const iconInfo = await renderHtmlToPng({
      browserPath,
      html: buildTouchIconHtml(),
      outPath: iconOut,
      width: 180,
      height: 180,
      workDir,
    });

    console.log(
      `[ogp] assets/ogp.png (${ogpInfo.width}x${ogpInfo.height}, ${ogpInfo.bytes} bytes)`,
    );
    console.log(
      `[ogp] assets/apple-touch-icon.png (${iconInfo.width}x${iconInfo.height}, ${iconInfo.bytes} bytes)`,
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("[ogp] fatal:", err);
  process.exit(1);
});
