export function createInitialState(initialLang) {
  return {
    lang: initialLang,
    search: "",
    category: "all",
    hiddenOrgs: new Set(),
    compactEmpty: true,
    viewMode: "matrix", // "matrix" | "feed"
    selectedModelId: null,
    dataset: null,
  };
}

/**
 * Generate continuous descending list of YYYY-MM strings from newest down to earliest.
 */
export function buildMonthRange(newestYm, oldestYm) {
  const [endY, endM] = newestYm.split("-").map(Number);
  const [startY, startM] = oldestYm.split("-").map(Number);
  const months = [];

  let y = endY;
  let m = endM;
  while (y > startY || (y === startY && m >= startM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return months;
}

/**
 * Compute filtered models, visible organizations, grouped cells, and timeline years.
 */
export function selectViewData(state) {
  const dataset = state.dataset;
  if (!dataset) return null;

  const { orgs, models, generatedAt } = dataset;
  const orgMap = new Map(orgs.map((o) => [o.id, o]));
  const query = state.search.trim().toLowerCase();

  const visibleOrgs = orgs.filter((o) => !state.hiddenOrgs.has(o.id));
  const visibleOrgIds = new Set(visibleOrgs.map((o) => o.id));

  const filteredModels = models.filter((m) => {
    if (!visibleOrgIds.has(m.orgId)) return false;

    if (state.category !== "all") {
      if (state.category === "flagship") {
        if (m.tier !== "flagship" && !m.categories.includes("flagship")) return false;
      } else if (!m.categories.includes(state.category)) {
        return false;
      }
    }

    if (query) {
      const org = orgMap.get(m.orgId);
      const haystack = [
        m.name,
        m.creator || "",
        m.releaseDate,
        ...(m.aliases || []),
        org?.name?.ja || "",
        org?.name?.zh || "",
        org?.name?.en || "",
        m.summary?.ja || "",
        m.summary?.zh || "",
        m.summary?.en || "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  // Determine chronological month axis (descending into the past)
  let newestYm = generatedAt ? generatedAt.slice(0, 7) : "2026-11";
  let oldestYm = "2022-11";
  for (const m of models) {
    if (m.releaseMonth > newestYm) newestYm = m.releaseMonth;
    if (m.releaseMonth < oldestYm) oldestYm = m.releaseMonth;
  }

  const allMonths = buildMonthRange(newestYm, oldestYm);

  // Build map: `${ym}::${orgId}` -> Model[] and counts
  const cellMap = new Map();
  const monthCounts = new Map();
  const yearCounts = new Map();
  const orgCounts = new Map();

  for (const m of filteredModels) {
    const cellKey = `${m.releaseMonth}::${m.orgId}`;
    if (!cellMap.has(cellKey)) cellMap.set(cellKey, []);
    cellMap.get(cellKey).push(m);

    monthCounts.set(m.releaseMonth, (monthCounts.get(m.releaseMonth) || 0) + 1);
    const y = m.releaseMonth.slice(0, 4);
    yearCounts.set(y, (yearCounts.get(y) || 0) + 1);
    orgCounts.set(m.orgId, (orgCounts.get(m.orgId) || 0) + 1);
  }

  const years = Array.from(new Set(allMonths.map((ym) => ym.slice(0, 4))));

  // Reference timestamp for "NEW" badge (within 30 days of dataset generatedAt)
  const refTime = generatedAt ? new Date(generatedAt).getTime() : Date.now();
  const isRecent = (releaseDate) => {
    const t = new Date(`${releaseDate}T00:00:00Z`).getTime();
    return Number.isFinite(t) && refTime - t <= 30 * 24 * 60 * 60 * 1000 && t <= refTime + 86400000;
  };

  return {
    orgs,
    visibleOrgs,
    orgMap,
    filteredModels,
    allMonths,
    years,
    cellMap,
    monthCounts,
    yearCounts,
    orgCounts,
    latestModel: models[0] || null,
    isRecent,
  };
}
