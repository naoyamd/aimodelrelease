export const SUPPORTED_LANGS = ["ja", "zh", "en"];

const MONTH_NAMES_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const FULL_MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const UI_TEXT = {
  ja: {
    pageTitle: "AI Model Release Radar — 主要AIモデルの月別リリース年表",
    pageDescription:
      "OpenAI・Anthropic・Google・Meta・DeepSeek・xAI・Mistral・Qwenなど著名AIモデルのリリース履歴を、企業×月別マトリクスで一覧できるデイリー自動更新サイト。",
    brandTitle: "AI MODEL RELEASE RADAR",
    brandSubtitle: "8機関 × 月次リリース時刻表（毎日自動更新）",
    liveBadge: "毎日自動更新",
    lastUpdated: "最終確認: {date}",
    kpiModels: "掲載モデル",
    kpiOrgs: "主要機関",
    kpiLatest: "最新: {name}",
    latestKicker: "最新:",
    searchPlaceholder: "モデル名・企業名・特徴で検索…",
    clearSearch: "検索をクリア",
    catAll: "すべて",
    catFlagship: "フラッグシップ",
    catReasoning: "推論・思考",
    catOpenWeights: "オープンウェイト",
    catMultimodal: "マルチモーダル",
    catCompact: "高速・軽量",
    yearJumpLabel: "年へ移動",
    compactQuiet: "空白月を圧縮",
    viewMatrix: "マトリクス",
    viewFeed: "タイムライン",
    orgsFilterLabel: "表示企業:",
    orgsShowAll: "全社表示",
    cornerMonthOrg: "月 ↓ / 企業 →",
    cornerCompact: "月↓ / 企業→",
    cornerHint: "新→過去",
    yearCount: "{count}件のリリース",
    monthCount: "{count}件",
    badgeFlagship: "主力",
    badgeNew: "NEW",
    badgeOpen: "OPEN",
    badgeThink: "推論",
    badgeClosed: "商用 / API",
    emptyTitle: "条件に一致するモデルが見つかりません",
    emptyBody: "検索キーワードやカテゴリ・企業フィルターを解除すると全モデルが表示されます。",
    resetFilters: "フィルターをリセット",
    modalHighlights: "主なポイント",
    modalClose: "閉じる",
    modalOfficialBtn: "公式リリース・詳細を見る",
    modalContextLabel: "コンテキスト長",
    modalWeightsOpen: "オープンウェイト公開",
    modalWeightsClosed: "クラウド / API 提供",
    dossierNewer: "新しい方へ",
    dossierOlder: "過去へ",
    specReleased: "公開日",
    specWeights: "公開形態",
    specTags: "分類",
    provenanceCurated: "編集チーム検証済みデータ",
    provenanceCrawled: "デイリー自動クロール検知 ({source})",
    footerNote:
      "自作ゼロ依存クローラーが毎日主要AI研究所・モデルレジストリを巡回し、著名モデルのみを厳選して自動更新します（GitHub Actions + GitHub Pages）。",
    sourceLabelOffline: "ローカルシード検証",
    sourceLabelLive: "自動クロール稼働中",
    soloOrgTooltip: "クリックで「{org}」のみに絞込 / 再クリックで解除",
    loadErrorTitle: "データの読み込みに失敗しました",
    loadErrorBody: "releases.json を取得できませんでした。ビルドまたはローカルサーバーをご確認ください。",
  },
  zh: {
    pageTitle: "AI Model Release Radar — 全球著名 AI 模型月度发布矩阵",
    pageDescription:
      "按机构横向对比、按月份纵向回溯，每日自动追踪 OpenAI、Anthropic、Google、Meta、DeepSeek、xAI、Mistral、Qwen 著名大模型发布动态。",
    brandTitle: "AI MODEL RELEASE RADAR",
    brandSubtitle: "8 大机构 × 月度发布时刻表（每日自动更新）",
    liveBadge: "每日自动更新",
    lastUpdated: "上次检查: {date}",
    kpiModels: "收录模型",
    kpiOrgs: "核心机构",
    kpiLatest: "最新: {name}",
    latestKicker: "最新:",
    searchPlaceholder: "搜索模型名称、机构或特性…",
    clearSearch: "清除搜索",
    catAll: "全部",
    catFlagship: "旗舰模型",
    catReasoning: "深度推理",
    catOpenWeights: "开放权重",
    catMultimodal: "多模态",
    catCompact: "高速轻量",
    yearJumpLabel: "跳转年份",
    compactQuiet: "压缩空月",
    viewMatrix: "矩阵视图",
    viewFeed: "时间线",
    orgsFilterLabel: "筛选机构:",
    orgsShowAll: "全部显示",
    cornerMonthOrg: "月份 ↓ / 机构 →",
    cornerCompact: "月↓ / 机构→",
    cornerHint: "新→过去",
    yearCount: "{count} 个重磅发布",
    monthCount: "{count} 项",
    badgeFlagship: "旗舰",
    badgeNew: "NEW",
    badgeOpen: "开源",
    badgeThink: "推理",
    badgeClosed: "闭源 / API",
    emptyTitle: "未找到符合条件的模型",
    emptyBody: "尝试清空搜索词或重置分类、机构筛选条件以查看完整矩阵。",
    resetFilters: "重置筛选条件",
    modalHighlights: "核心亮点",
    modalClose: "关闭",
    modalOfficialBtn: "查看官方发布说明",
    modalContextLabel: "上下文窗口",
    modalWeightsOpen: "开放权重可下载",
    modalWeightsClosed: "闭源 / 云端 API",
    dossierNewer: "上一条",
    dossierOlder: "下一条",
    specReleased: "发布日期",
    specWeights: "权重开放",
    specTags: "分类特性",
    provenanceCurated: "人工校对核心数据集",
    provenanceCrawled: "每日自动爬虫收录 ({source})",
    footerNote:
      "由自研零依赖爬虫每日自动抓取主流 AI 实验室官方源与模型库，仅收录著名突破性模型并自动部署至 GitHub Pages。",
    sourceLabelOffline: "本地种子验证",
    sourceLabelLive: "自动抓取运行中",
    soloOrgTooltip: "点击仅看 {org}，再次点击恢复全部",
    loadErrorTitle: "数据加载失败",
    loadErrorBody: "无法读取 releases.json，请先执行构建或通过本地服务器访问。",
  },
  en: {
    pageTitle: "AI Model Release Radar — Notable AI Models by Org & Month",
    pageDescription:
      "A crisp, daily-updated single-page release matrix of notable AI models across OpenAI, Anthropic, Google DeepMind, Meta, DeepSeek, xAI, Mistral, and Qwen.",
    brandTitle: "AI MODEL RELEASE RADAR",
    brandSubtitle: "8-LAB MONTHLY RELEASE TIMETABLE · DAILY AUTO-UPDATED",
    liveBadge: "Daily Auto-Updated",
    lastUpdated: "Checked {date}",
    kpiModels: "Models",
    kpiOrgs: "Labs",
    kpiLatest: "Latest: {name}",
    latestKicker: "LATEST:",
    searchPlaceholder: "Search models, labs, capabilities…",
    clearSearch: "Clear search",
    catAll: "All",
    catFlagship: "Flagship",
    catReasoning: "Reasoning",
    catOpenWeights: "Open Weights",
    catMultimodal: "Multimodal",
    catCompact: "Compact / Fast",
    yearJumpLabel: "Jump to year",
    compactQuiet: "Compact quiet months",
    viewMatrix: "Matrix",
    viewFeed: "Timeline",
    orgsFilterLabel: "Labs:",
    orgsShowAll: "Show all",
    cornerMonthOrg: "Month ↓ / Lab →",
    cornerCompact: "MO↓ / LAB→",
    cornerHint: "Newest ↑",
    yearCount: "{count} releases",
    monthCount: "{count}",
    badgeFlagship: "Flagship",
    badgeNew: "NEW",
    badgeOpen: "OPEN",
    badgeThink: "Think",
    badgeClosed: "API / Closed",
    emptyTitle: "No matching model releases",
    emptyBody: "Clear your search query or reset active category and lab filters to view all tracked models.",
    resetFilters: "Reset filters",
    modalHighlights: "Key Highlights",
    modalClose: "Close",
    modalOfficialBtn: "Open Official Release",
    modalContextLabel: "Context window",
    modalWeightsOpen: "Open Weights",
    modalWeightsClosed: "Closed / API",
    dossierNewer: "Newer",
    dossierOlder: "Older",
    specReleased: "RELEASED",
    specWeights: "WEIGHTS",
    specTags: "TAGS",
    provenanceCurated: "Verified curated record",
    provenanceCrawled: "Auto-discovered by daily crawler ({source})",
    footerNote:
      "Powered by a custom zero-dependency daily crawler tracking major AI labs and registries, filtered to notable model releases and hosted on GitHub Pages.",
    sourceLabelOffline: "Local seed verified",
    sourceLabelLive: "Daily crawler active",
    soloOrgTooltip: "Click to solo {org}; click again to restore all",
    loadErrorTitle: "Failed to load release dataset",
    loadErrorBody: "Could not load releases.json. Run npm run build or serve dist/ over HTTP.",
  },
};

export function t(lang, key, vars = {}) {
  const dict = UI_TEXT[lang] || UI_TEXT.ja;
  let text = dict[key] ?? UI_TEXT.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v));
  }
  return text;
}

export function formatMonth(ym, lang = "ja") {
  const [yStr, mStr] = String(ym || "").split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  if (!year || !month) return String(ym || "");

  if (lang === "ja") return `${year}年${month}月`;
  if (lang === "zh") return `${year}年${month}月`;
  return `${MONTH_NAMES_EN[month - 1]} ${year}`;
}

export function formatDayBadge(isoDate, lang = "ja") {
  const [, mStr, dStr] = String(isoDate || "").split("-");
  const month = Number(mStr);
  const day = Number(dStr);
  if (!month || !day) return String(isoDate || "");
  if (lang === "en") {
    return `${MONTH_NAMES_EN[month - 1]} ${day}`;
  }
  return `${month}/${day}`;
}

export function formatFullDate(isoDate, lang = "ja") {
  const [yStr, mStr, dStr] = String(isoDate || "").split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (!year || !month || !day) return String(isoDate || "");
  if (lang === "ja") return `${year}年${month}月${day}日`;
  if (lang === "zh") return `${year}年${month}月${day}日`;
  return `${FULL_MONTH_NAMES_EN[month - 1]} ${day}, ${year}`;
}

export function detectInitialLang() {
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("lang");
      if (SUPPORTED_LANGS.includes(q)) return q;
    } catch {
      // ignore URL parsing failures
    }
  }

  if (typeof localStorage !== "undefined") {
    try {
      const saved = localStorage.getItem("ai_radar_lang");
      if (SUPPORTED_LANGS.includes(saved)) return saved;
    } catch {
      // ignore storage errors
    }
  }

  if (typeof navigator !== "undefined" && navigator.language) {
    const nav = navigator.language.toLowerCase();
    if (nav.startsWith("ja")) return "ja";
    if (nav.startsWith("zh")) return "zh";
    if (nav.startsWith("en")) return "en";
  }

  return "ja";
}

export function persistLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem("ai_radar_lang", lang);
    } catch {
      // ignore storage errors
    }
  }
  if (typeof window !== "undefined" && window.history?.replaceState) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("lang", lang);
      window.history.replaceState(null, "", url.toString());
    } catch {
      // ignore file:// URL errors
    }
  }
}
