import { SUPPORTED_LANGS, formatFullDate, formatMonth, t } from "./i18n.js";
import { selectViewData } from "./state.js";

export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getOrgPalette(org) {
  if (!org) {
    return {
      ink: "#0A0A0A",
      fg: "#FFFFFF",
      code: "00",
    };
  }
  const code = String(org.order ?? 0).padStart(2, "0");
  return {
    ink: org.color || "#0A0A0A",
    fg: org.fg || "#FFFFFF",
    code,
  };
}

function formatCompactDay(isoDate) {
  const [, m, d] = String(isoDate || "").split("-");
  if (!m || !d) return isoDate || "";
  return `${m}.${d}`;
}

function formatCompactMonth(ym, lang) {
  if (lang === "en") return formatMonth(ym, "en");
  return ym;
}

function renderMasthead(state, view) {
  const { lang, dataset } = state;
  const headerEl = document.getElementById("site-header");
  const lastDate = dataset.generatedAt ? dataset.generatedAt.slice(0, 10) : "—";
  const latest = view.latestModel;

  headerEl.innerHTML = `
    <div class="masthead-inner">
      <div class="masthead-brand">
        <span class="masthead-mark" aria-hidden="true">MR//26</span>
        <div class="masthead-titles">
          <div class="masthead-top-line">
            <h1 class="masthead-title">${escapeHtml(t(lang, "brandTitle"))}</h1>
            <span class="masthead-meta-stamp">
              ${escapeHtml(lastDate)} · <strong>${view.filteredModels.length}</strong>/${dataset.models.length}
            </span>
          </div>
          <p class="masthead-subtitle">${escapeHtml(t(lang, "brandSubtitle"))}</p>
        </div>
      </div>

      <div class="masthead-actions">
        ${
          latest
            ? `<button type="button" class="latest-trigger" data-open-model="${escapeHtml(latest.id)}">
                <span class="latest-kicker">${escapeHtml(t(lang, "latestKicker"))}</span>
                <span class="latest-name">${escapeHtml(latest.name)}</span>
              </button>`
            : ""
        }
        <div class="lang-tabs" role="group" aria-label="Language">
          ${SUPPORTED_LANGS.map(
            (code) => `<button type="button" class="lang-tab ${lang === code ? "is-active" : ""}" data-set-lang="${code}">${
              code === "ja" ? "日本語" : code === "zh" ? "中文" : "EN"
            }</button>`,
          ).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderControls(state, view) {
  const { lang, search, category, compactEmpty, viewMode, hiddenOrgs } = state;
  const el = document.getElementById("controls-bar");

  const categories = [
    { id: "all", label: t(lang, "catAll") },
    { id: "flagship", label: t(lang, "catFlagship") },
    { id: "reasoning", label: t(lang, "catReasoning") },
    { id: "open-weights", label: t(lang, "catOpenWeights") },
    { id: "multimodal", label: t(lang, "catMultimodal") },
    { id: "compact", label: t(lang, "catCompact") },
  ];

  el.innerHTML = `
    <div class="utility-inner">
      <div class="utility-left">
        <label class="u-search">
          <span class="u-search-prefix">/</span>
          <input
            id="search-input"
            class="u-search-input"
            type="search"
            value="${escapeHtml(search)}"
            placeholder="${escapeHtml(t(lang, "searchPlaceholder"))}"
            aria-label="${escapeHtml(t(lang, "searchPlaceholder"))}"
          >
          ${
            search
              ? `<button type="button" class="u-search-clear" data-clear-search aria-label="${escapeHtml(t(lang, "clearSearch"))}">×</button>`
              : ""
          }
        </label>

        <div class="u-tabs" role="group" aria-label="Categories">
          ${categories
            .map(
              (c) => `<button type="button" class="u-tab ${category === c.id ? "is-active" : ""}" data-set-category="${c.id}">${escapeHtml(c.label)}</button>`,
            )
            .join("")}
        </div>

        ${
          hiddenOrgs.size > 0
            ? `<button type="button" class="u-reset-orgs" data-show-all-orgs>${escapeHtml(t(lang, "orgsShowAll"))} (${view.orgs.length})</button>`
            : ""
        }
      </div>

      <div class="utility-right">
        <div class="u-years" aria-label="${escapeHtml(t(lang, "yearJumpLabel"))}">
          ${view.years
            .map((y) => `<button type="button" class="u-year-btn" data-jump-year="${y}">${y}</button>`)
            .join("")}
        </div>

        <button
          type="button"
          class="u-toggle ${compactEmpty ? "is-active" : ""}"
          data-toggle-compact
          aria-pressed="${compactEmpty ? "true" : "false"}"
        >${escapeHtml(t(lang, "compactQuiet"))}</button>

        <div class="u-view-tabs" role="group" aria-label="View mode">
          <button type="button" class="u-tab ${viewMode === "matrix" ? "is-active" : ""}" data-set-view="matrix">${escapeHtml(t(lang, "viewMatrix"))}</button>
          <button type="button" class="u-tab ${viewMode === "feed" ? "is-active" : ""}" data-set-view="feed">${escapeHtml(t(lang, "viewFeed"))}</button>
        </div>
      </div>
    </div>
  `;
}

function renderEntry(model, org, state, view, showOrgHeader = false) {
  const { lang } = state;
  const palette = getOrgPalette(org);
  const isFlagship = model.tier === "flagship";
  const isNew = view.isRecent(model.releaseDate);
  const isReasoning = model.categories.includes("reasoning");

  const specs = [];
  if (model.openWeights) specs.push(t(lang, "badgeOpen"));
  if (isReasoning) specs.push(t(lang, "badgeThink"));
  if (model.contextWindow) specs.push(model.contextWindow);
  const specStr = specs.join(" | ");

  return `
    <button
      type="button"
      class="m-entry ${isFlagship ? "is-flagship" : "is-notable"} ${state.selectedModelId === model.id ? "is-selected" : ""}"
      style="--org-ink: ${escapeHtml(palette.ink)}; --org-fg: ${escapeHtml(palette.fg)}"
      data-open-model="${escapeHtml(model.id)}"
    >
      ${
        showOrgHeader
          ? `<span class="m-feed-org-tag">
              <span class="m-org-code">${escapeHtml(palette.code)}</span>
              <span>${escapeHtml(org?.name?.[lang] || model.orgId)}</span>
            </span>`
          : ""
      }
      <div class="m-entry-head">
        <span class="m-entry-name">${escapeHtml(model.name)}</span>
        <span class="m-entry-date">${escapeHtml(formatCompactDay(model.releaseDate))}</span>
      </div>
      ${
        specStr || isNew || isFlagship
          ? `<div class="m-entry-meta">
              ${isNew ? `<span class="m-flag--new">[${escapeHtml(t(lang, "badgeNew"))}]</span>` : ""}
              ${isFlagship ? `<span class="m-flag--major">[MAJOR]</span>` : ""}
              ${specStr ? `<span>${escapeHtml(specStr)}</span>` : ""}
            </div>`
          : ""
      }
      ${
        showOrgHeader
          ? `<p class="m-entry-summary">${escapeHtml(model.summary?.[lang] || model.summary?.en || "")}</p>`
          : ""
      }
    </button>
  `;
}

function renderMatrix(state, view) {
  const { lang, compactEmpty } = state;
  const gridColsStyle = `--col-count: ${view.visibleOrgs.length};`;

  let maxMonthTotal = 1;
  for (const count of view.monthCounts.values()) {
    if (count > maxMonthTotal) maxMonthTotal = count;
  }

  let lastYear = null;
  const bodyChunks = [];

  for (const ym of view.allMonths) {
    const year = ym.slice(0, 4);
    const monthTotal = view.monthCounts.get(ym) || 0;

    if (year !== lastYear) {
      lastYear = year;
      const yCount = view.yearCounts.get(year) || 0;
      bodyChunks.push(`
        <div class="m-year-divider" data-year-anchor="${year}">
          <span class="m-year-num">${year}</span>
          <span class="m-year-rule" aria-hidden="true"></span>
          <span class="m-year-stat">${escapeHtml(t(lang, "yearCount", { count: yCount }))}</span>
        </div>
      `);
    }

    const isQuiet = compactEmpty && monthTotal === 0;
    const heatPct = monthTotal > 0 ? Math.max(14, Math.round((monthTotal / maxMonthTotal) * 100)) : 0;

    const cellsHtml = view.visibleOrgs
      .map((org) => {
        const palette = getOrgPalette(org);
        const items = view.cellMap.get(`${ym}::${org.id}`) || [];
        return `
          <div
            class="m-cell ${items.length > 0 ? "has-items" : "is-empty"}"
            style="--org-ink: ${escapeHtml(palette.ink)}; --org-fg: ${escapeHtml(palette.fg)}"
            data-org="${escapeHtml(org.id)}"
            data-month="${ym}"
          >
            ${
              items.length > 0
                ? `<div class="m-cell-stack">${items.map((m) => renderEntry(m, org, state, view, false)).join("")}</div>`
                : `<span class="m-cell-null" aria-hidden="true">${isQuiet ? "" : "—"}</span>`
            }
          </div>
        `;
      })
      .join("");

    bodyChunks.push(`
      <div class="m-row ${isQuiet ? "is-quiet" : ""}" data-month="${ym}">
        <div class="m-month-cell">
          <div class="m-month-label">${escapeHtml(formatCompactMonth(ym, lang))}</div>
          ${
            monthTotal > 0
              ? `<div class="m-month-heat" aria-hidden="true"><span style="width:${heatPct}%"></span></div>
                 <div class="m-month-num">${monthTotal}</div>`
              : ""
          }
        </div>
        ${cellsHtml}
      </div>
    `);
  }

  return `
    <div class="m-matrix-scroll-wrap">
      <div class="m-matrix" id="m-matrix" style="${gridColsStyle}">
        <div class="m-col-header-row" id="m-col-header-row">
          <div class="m-corner-cell">
            <span class="m-corner-main">${escapeHtml(t(lang, "cornerCompact"))}</span>
            <span class="m-corner-sub">${escapeHtml(t(lang, "cornerHint"))}</span>
          </div>
          ${view.visibleOrgs
            .map((org) => {
              const palette = getOrgPalette(org);
              const count = view.orgCounts.get(org.id) || 0;
              const orgName = org.shortName?.[lang] || org.name?.[lang] || org.id;
              const fullOrgName = org.name?.[lang] || org.id;
              return `
                <button
                  type="button"
                  class="m-org-head"
                  data-org="${escapeHtml(org.id)}"
                  data-solo-org="${escapeHtml(org.id)}"
                  style="--org-ink: ${escapeHtml(palette.ink)}; --org-fg: ${escapeHtml(palette.fg)}"
                  title="${escapeHtml(t(lang, "soloOrgTooltip", { org: fullOrgName }))}"
                >
                  <div class="m-org-head-top">
                    <span class="m-org-title">
                      <span class="m-org-code">${escapeHtml(palette.code)}</span>
                      <span class="m-org-name">${escapeHtml(orgName)}</span>
                    </span>
                    <span class="m-org-count">${count}</span>
                  </div>
                  <span class="m-org-tag">${escapeHtml(org.tagline?.[lang] || "")}</span>
                </button>
              `;
            })
            .join("")}
        </div>

        <div class="m-matrix-body">
          ${bodyChunks.join("")}
        </div>
      </div>
    </div>
  `;
}

function renderFeed(state, view) {
  const { lang } = state;
  const activeMonths = view.allMonths.filter((ym) => (view.monthCounts.get(ym) || 0) > 0);
  let lastYear = null;

  return `
    <div class="m-feed">
      ${activeMonths
        .map((ym) => {
          const year = ym.slice(0, 4);
          const monthModels = view.filteredModels.filter((m) => m.releaseMonth === ym);
          const yearDivider =
            year !== lastYear
              ? `<div class="m-year-divider" data-year-anchor="${year}">
                  <span class="m-year-num">${year}</span>
                  <span class="m-year-rule" aria-hidden="true"></span>
                  <span class="m-year-stat">${escapeHtml(t(lang, "yearCount", { count: view.yearCounts.get(year) || 0 }))}</span>
                </div>`
              : "";
          lastYear = year;

          return `
            ${yearDivider}
            <section class="m-feed-month">
              <h2 class="m-feed-month-title">
                <span>${escapeHtml(formatMonth(ym, lang))}</span>
                <span>${escapeHtml(t(lang, "monthCount", { count: monthModels.length }))}</span>
              </h2>
              <div class="m-feed-grid">
                ${monthModels
                  .map((m) => renderEntry(m, view.orgMap.get(m.orgId), state, view, true))
                  .join("")}
              </div>
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderFooter(state) {
  const { lang, dataset } = state;
  const el = document.getElementById("site-footer");
  const meta = dataset.meta || {};
  const sources = Array.isArray(meta.sources) ? meta.sources : [];

  el.innerHTML = `
    <div class="footer-inner">
      <p class="footer-note">${escapeHtml(t(lang, "footerNote"))}</p>
      <div class="footer-meta">
        <span>${escapeHtml(t(lang, meta.mode === "live-crawl" ? "sourceLabelLive" : "sourceLabelOffline"))}</span>
        ${sources.map((s) => `<span>${escapeHtml(s.source)}:${s.candidatesCount ?? 0}</span>`).join(" · ")}
      </div>
    </div>
  `;
}

export function renderDossier(state, view) {
  const drawer = document.getElementById("dossier-drawer");
  const backdrop = document.getElementById("dossier-backdrop");

  if (!state.selectedModelId || !state.dataset) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    return;
  }

  const models = view?.filteredModels?.length ? view.filteredModels : state.dataset.models;
  let idx = models.findIndex((m) => m.id === state.selectedModelId);
  const model =
    idx >= 0
      ? models[idx]
      : state.dataset.models.find((m) => m.id === state.selectedModelId);

  if (!model) {
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    backdrop.hidden = true;
    return;
  }

  if (idx < 0) idx = 0;
  const prevModel = idx > 0 ? models[idx - 1] : null;
  const nextModel = idx < models.length - 1 ? models[idx + 1] : null;

  const { lang } = state;
  const org = state.dataset.orgs.find((o) => o.id === model.orgId);
  const palette = getOrgPalette(org);
  const orgName = org?.name?.[lang] || model.orgId;
  const summary = model.summary?.[lang] || model.summary?.en || "";
  const highlights = model.highlights?.[lang] || model.highlights?.en || [];
  const provenance =
    model.source === "crawled"
      ? t(lang, "provenanceCrawled", { source: model.discoveredFrom || "crawler" })
      : t(lang, "provenanceCurated");

  drawer.style.setProperty("--org-ink", palette.ink);
  drawer.style.setProperty("--org-fg", palette.fg);
  drawer.innerHTML = `
    <div class="dossier-topbar">
      <div class="dossier-nav-group">
        <button
          type="button"
          class="dossier-nav-btn"
          ${prevModel ? `data-open-model="${escapeHtml(prevModel.id)}"` : "disabled"}
          title="${prevModel ? escapeHtml(prevModel.name) : ""}"
        >← ${escapeHtml(t(lang, "dossierNewer"))}</button>
        <button
          type="button"
          class="dossier-nav-btn"
          ${nextModel ? `data-open-model="${escapeHtml(nextModel.id)}"` : "disabled"}
          title="${nextModel ? escapeHtml(nextModel.name) : ""}"
        >${escapeHtml(t(lang, "dossierOlder"))} →</button>
      </div>
      <button type="button" class="dossier-close" data-close-dossier aria-label="${escapeHtml(t(lang, "modalClose"))}">ESC ×</button>
    </div>

    <div class="dossier-content">
      <div class="dossier-org-line">
        <span class="dossier-org-badge">${escapeHtml(palette.code)} ${escapeHtml(orgName)}</span>
        <span class="dossier-tier-label">${escapeHtml(model.tier === "flagship" ? `[${t(lang, "badgeFlagship")}]` : "[NOTABLE]")}</span>
      </div>

      <h2 class="dossier-title">${escapeHtml(model.name)}</h2>

      <dl class="dossier-spec-grid">
        <div class="spec-row">
          <dt>${escapeHtml(t(lang, "specReleased"))}</dt>
          <dd>${escapeHtml(formatFullDate(model.releaseDate, lang))}</dd>
        </div>
        <div class="spec-row">
          <dt>${escapeHtml(t(lang, "specWeights"))}</dt>
          <dd>${escapeHtml(model.openWeights ? t(lang, "modalWeightsOpen") : t(lang, "modalWeightsClosed"))}</dd>
        </div>
        <div class="spec-row">
          <dt>${escapeHtml(t(lang, "modalContextLabel"))}</dt>
          <dd>${escapeHtml(model.contextWindow || "—")}</dd>
        </div>
        <div class="spec-row">
          <dt>${escapeHtml(t(lang, "specTags"))}</dt>
          <dd>${escapeHtml(model.categories.join(" · "))}</dd>
        </div>
      </dl>

      <p class="dossier-summary">${escapeHtml(summary)}</p>

      <h3 class="dossier-section-title">${escapeHtml(t(lang, "modalHighlights"))}</h3>
      <ul class="dossier-highlights">
        ${highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join("")}
      </ul>

      <div class="dossier-actions">
        <a class="dossier-cta" href="${escapeHtml(model.officialUrl)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(t(lang, "modalOfficialBtn"))} ↗
        </a>
        <div class="dossier-provenance">${escapeHtml(provenance)}</div>
      </div>
    </div>
  `;

  drawer.classList.add("is-open");
  drawer.setAttribute("aria-hidden", "false");
  backdrop.hidden = false;
}

export function renderApp(state, { preserveSearchFocus = false } = {}) {
  const view = selectViewData(state);
  if (!view) return view;

  const prevSearch = document.getElementById("search-input");
  const selStart = prevSearch?.selectionStart ?? null;
  const selEnd = prevSearch?.selectionEnd ?? null;

  renderMasthead(state, view);
  renderControls(state, view);
  renderFooter(state);

  const stageEl = document.getElementById("main-stage");
  if (view.filteredModels.length === 0) {
    stageEl.innerHTML = `
      <div class="m-empty">
        <h2>${escapeHtml(t(state.lang, "emptyTitle"))}</h2>
        <p>${escapeHtml(t(state.lang, "emptyBody"))}</p>
        <button type="button" class="m-reset-btn" data-reset-filters>${escapeHtml(t(state.lang, "resetFilters"))}</button>
      </div>
    `;
  } else {
    stageEl.innerHTML =
      state.viewMode === "feed" ? renderFeed(state, view) : renderMatrix(state, view);
  }

  renderDossier(state, view);

  const controlsEl = document.getElementById("controls-bar");
  if (controlsEl) {
    const h = Math.ceil(controlsEl.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--utility-h", `${h}px`);
  }

  if (preserveSearchFocus) {
    const nextSearch = document.getElementById("search-input");
    if (nextSearch) {
      nextSearch.focus({ preventScroll: true });
      if (selStart !== null && selEnd !== null) {
        nextSearch.setSelectionRange(selStart, selEnd);
      }
    }
  }

  return view;
}
