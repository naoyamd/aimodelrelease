import { detectInitialLang, persistLang, t } from "./i18n.js";
import { renderApp } from "./render.js";
import { createInitialState, selectViewData } from "./state.js";

function applyDocumentLocale(lang) {
  document.documentElement.lang = lang;
  document.title = t(lang, "pageTitle");
  const desc = document.querySelector('meta[name="description"]');
  if (desc) {
    desc.setAttribute("content", t(lang, "pageDescription"));
  }
}

async function loadDataset() {
  try {
    const resp = await fetch("./data/releases.json", { cache: "no-cache" });
    if (resp.ok) {
      return await resp.json();
    }
  } catch {
    // Fallback below handles file:// or transient fetch issues
  }
  if (window.__AI_MODEL_RELEASES__) {
    return window.__AI_MODEL_RELEASES__;
  }
  throw new Error("Dataset unavailable");
}

function syncStickyMeasurement() {
  const controlsEl = document.getElementById("controls-bar");
  if (controlsEl) {
    const h = Math.ceil(controlsEl.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--utility-h", `${h}px`);
  }
}

function jumpToYear(year) {
  const anchor = document.querySelector(`[data-year-anchor="${year}"]`);
  if (!anchor) return;
  const controlsH = document.getElementById("controls-bar")?.getBoundingClientRect().height || 0;
  const colHeadH = document.getElementById("m-col-header-row")?.getBoundingClientRect().height || 0;
  const top = anchor.getBoundingClientRect().top + window.scrollY - controlsH - colHeadH - 4;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

async function boot() {
  const state = createInitialState(detectInitialLang());

  if (window.innerWidth <= 680) {
    state.viewMode = "feed";
  }

  applyDocumentLocale(state.lang);

  try {
    state.dataset = await loadDataset();
  } catch {
    const stageEl = document.getElementById("main-stage");
    stageEl.innerHTML = `
      <div class="m-empty">
        <h2>${t(state.lang, "loadErrorTitle")}</h2>
        <p>${t(state.lang, "loadErrorBody")}</p>
      </div>
    `;
    return;
  }

  let currentView = renderApp(state);
  window.addEventListener("resize", syncStickyMeasurement);

  // Crosshair column + row hover highlight
  const stageEl = document.getElementById("main-stage");
  let activeRowEl = null;

  stageEl.addEventListener("pointerover", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const cell = target?.closest(".m-cell[data-org]");
    const matrix = document.getElementById("m-matrix");
    if (!cell || !matrix) return;

    matrix.dataset.hoverOrg = cell.dataset.org;
    const row = cell.closest(".m-row");
    if (activeRowEl && activeRowEl !== row) {
      activeRowEl.classList.remove("is-hover-row");
    }
    if (row) {
      row.classList.add("is-hover-row");
      activeRowEl = row;
    }
  });

  stageEl.addEventListener("pointerleave", () => {
    const matrix = document.getElementById("m-matrix");
    if (matrix) delete matrix.dataset.hoverOrg;
    if (activeRowEl) {
      activeRowEl.classList.remove("is-hover-row");
      activeRowEl = null;
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const langBtn = target.closest("[data-set-lang]");
    if (langBtn) {
      const nextLang = langBtn.getAttribute("data-set-lang");
      if (nextLang && nextLang !== state.lang) {
        state.lang = nextLang;
        persistLang(nextLang);
        applyDocumentLocale(state.lang);
        currentView = renderApp(state);
      }
      return;
    }

    const catBtn = target.closest("[data-set-category]");
    if (catBtn) {
      state.category = catBtn.getAttribute("data-set-category") || "all";
      currentView = renderApp(state);
      return;
    }

    const yearBtn = target.closest("[data-jump-year]");
    if (yearBtn) {
      const year = yearBtn.getAttribute("data-jump-year");
      if (year) jumpToYear(year);
      return;
    }

    if (target.closest("[data-toggle-compact]")) {
      state.compactEmpty = !state.compactEmpty;
      currentView = renderApp(state);
      return;
    }

    const viewBtn = target.closest("[data-set-view]");
    if (viewBtn) {
      state.viewMode = viewBtn.getAttribute("data-set-view") || "matrix";
      currentView = renderApp(state);
      return;
    }

    const soloOrgBtn = target.closest("[data-solo-org]");
    if (soloOrgBtn) {
      const orgId = soloOrgBtn.getAttribute("data-solo-org");
      if (!orgId) return;
      const allOthers = state.dataset.orgs.map((o) => o.id).filter((id) => id !== orgId);
      const alreadySolo =
        state.hiddenOrgs.size === allOthers.length && !state.hiddenOrgs.has(orgId);
      state.hiddenOrgs = alreadySolo ? new Set() : new Set(allOthers);
      currentView = renderApp(state);
      return;
    }

    if (target.closest("[data-show-all-orgs]")) {
      state.hiddenOrgs.clear();
      currentView = renderApp(state);
      return;
    }

    if (target.closest("[data-clear-search]")) {
      state.search = "";
      currentView = renderApp(state);
      document.getElementById("search-input")?.focus();
      return;
    }

    if (target.closest("[data-reset-filters]")) {
      state.search = "";
      state.category = "all";
      state.hiddenOrgs.clear();
      currentView = renderApp(state);
      return;
    }

    const modelBtn = target.closest("[data-open-model]");
    if (modelBtn) {
      state.selectedModelId = modelBtn.getAttribute("data-open-model");
      currentView = selectViewData(state);
      renderApp(state);
      return;
    }

    if (target.closest("[data-close-dossier]") || target.id === "dossier-backdrop") {
      state.selectedModelId = null;
      renderApp(state);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.id === "search-input") {
      state.search = target.value;
      currentView = renderApp(state, { preserveSearchFocus: true });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      document.activeElement?.tagName !== "INPUT"
    ) {
      event.preventDefault();
      document.getElementById("search-input")?.focus();
      return;
    }

    if (state.selectedModelId) {
      if (event.key === "Escape") {
        state.selectedModelId = null;
        renderApp(state);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const list = currentView?.filteredModels || [];
        const idx = list.findIndex((m) => m.id === state.selectedModelId);
        if (idx >= 0) {
          const nextIdx = event.key === "ArrowLeft" ? idx - 1 : idx + 1;
          if (nextIdx >= 0 && nextIdx < list.length) {
            state.selectedModelId = list[nextIdx].id;
            renderApp(state);
          }
        }
      }
    } else if (event.key === "Escape" && state.search) {
      state.search = "";
      currentView = renderApp(state);
    }
  });
}

boot();
