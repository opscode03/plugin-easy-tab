export const SEARCH_ENGINES = [
  { id: "baidu", label: "百度", url: "https://www.baidu.com/s?wd={query}" },
  { id: "bing", label: "必应", url: "https://www.bing.com/search?q={query}" },
  { id: "google", label: "Google", url: "https://www.google.com/search?q={query}&hl=zh-CN&ie=UTF-8" }
];

const DEFAULT_STATE = {
  name: "",
  theme: "light",
  engine: "baidu",
  timeDisplay: "hero",
  timeFormat: "24",
  showSeconds: false,
  showDate: true,
  showWeekday: true,
  showSearch: true,
  openTarget: "current",
  shortcutRows: 3,
  shortcutDensity: "comfortable",
  restoreLastGroup: false,
  lastGroupId: "all",
  background: null,
  showAllGroup: true,
  groupOrder: ["all"],
  groups: [],
  shortcuts: [
    { id: "bilibili", name: "哔哩哔哩", url: "https://www.bilibili.com/", mark: "B" },
    { id: "github", name: "GitHub", url: "https://github.com/", mark: "GH" },
    { id: "figma", name: "Figma", url: "https://www.figma.com/", mark: "F" },
    { id: "gmail", name: "Gmail", url: "https://mail.google.com/", mark: "M" },
    { id: "mdn", name: "MDN", url: "https://developer.mozilla.org/zh-CN/", mark: "</>" }
  ]
};

export function createDefaults() {
  return structuredClone(DEFAULT_STATE);
}

// 旧主题命名与非法值的安全回落：无法识别时统一回落到浅色
const LEGACY_THEME_VALUES = {
  "冰蓝": "light",
  "暖纸": "light",
  "豆沙绿": "light",
  "浅色": "light",
  warm: "light",
  sage: "light",
  ice: "light",
  "深夜": "dark",
  "深色": "dark",
  midnight: "dark",
  night: "dark"
};

function normalizeTheme(value) {
  if (["light", "dark", "system"].includes(value)) return value;
  return LEGACY_THEME_VALUES[value] || "light";
}

export function normalizeState(candidate) {
  const base = createDefaults();
  if (!candidate || typeof candidate !== "object") return base;

  const groups = [];
  if (Array.isArray(candidate.groups)) {
    for (const item of candidate.groups) {
      if (!item || typeof item.name !== "string") continue;
      let id = String(item.id || `group-${groups.length}`);
      if (id === "all") id = `group-${groups.length}`;
      if (groups.some((group) => group.id === id)) continue;
      groups.push({ id, name: item.name.trim().slice(0, 12) || "未命名" });
    }
  }
  const groupIds = new Set(groups.map((group) => group.id));
  const showAllGroup = typeof candidate.showAllGroup === "boolean" ? candidate.showAllGroup : true;
  const availableGroupIds = [...(showAllGroup ? ["all"] : []), ...groupIds];
  const availableGroupIdSet = new Set(availableGroupIds);
  const savedGroupOrder = Array.isArray(candidate.groupOrder) ? candidate.groupOrder.map(String) : [];
  const groupOrder = [...new Set([
    ...savedGroupOrder.filter((id) => availableGroupIdSet.has(id)),
    ...availableGroupIds
  ])];
  const groupRank = new Map(groupOrder.map((id, index) => [id, index]));
  groups.sort((a, b) => groupRank.get(a.id) - groupRank.get(b.id));
  const lastGroupId = String(candidate.lastGroupId || "");
  const normalizedLastGroupId = availableGroupIdSet.has(lastGroupId)
    ? lastGroupId
    : showAllGroup ? "all" : groupOrder[0] || "";

  const shortcuts = Array.isArray(candidate.shortcuts)
    ? candidate.shortcuts
        .filter((item) => item && typeof item.name === "string" && /^https?:\/\//i.test(item.url || ""))
        .map((item, index) => ({
          id: String(item.id || `saved-${index}`),
          name: item.name.trim().slice(0, 12) || "未命名",
          url: item.url,
          mark: String(item.mark || item.name.slice(0, 2)).slice(0, 2),
          groupId: groupIds.has(String(item.groupId)) ? String(item.groupId) : null
        }))
    : base.shortcuts;

  const shortcutRows = Number(candidate.shortcutRows);
  const background = candidate.background;
  const hasBackground = background && typeof background === "object" && /^https:\/\//i.test(background.url || "");

  return {
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 12) : "",
    theme: normalizeTheme(candidate.theme),
    engine: SEARCH_ENGINES.some((engine) => engine.id === candidate.engine) ? candidate.engine : "baidu",
    timeDisplay: ["hero", "footer"].includes(candidate.timeDisplay) ? candidate.timeDisplay : "hero",
    timeFormat: ["12", "24"].includes(candidate.timeFormat) ? candidate.timeFormat : "24",
    showSeconds: typeof candidate.showSeconds === "boolean" ? candidate.showSeconds : false,
    showDate: typeof candidate.showDate === "boolean" ? candidate.showDate : true,
    showWeekday: typeof candidate.showWeekday === "boolean" ? candidate.showWeekday : true,
    showSearch: typeof candidate.showSearch === "boolean" ? candidate.showSearch : true,
    openTarget: ["current", "new"].includes(candidate.openTarget) ? candidate.openTarget : "current",
    shortcutRows: Number.isFinite(shortcutRows)
      ? Math.min(6, Math.max(3, Math.round(shortcutRows)))
      : 3,
    shortcutDensity: ["comfortable", "compact"].includes(candidate.shortcutDensity) ? candidate.shortcutDensity : "comfortable",
    restoreLastGroup: typeof candidate.restoreLastGroup === "boolean" ? candidate.restoreLastGroup : false,
    lastGroupId: normalizedLastGroupId,
    background: hasBackground ? {
      url: background.url,
      title: typeof background.title === "string" ? background.title.slice(0, 80) : "开放壁纸",
      creator: typeof background.creator === "string" ? background.creator.slice(0, 60) : "未知作者",
      sourceUrl: /^https?:\/\//i.test(background.sourceUrl || "") ? background.sourceUrl : "",
      license: typeof background.license === "string" ? background.license.slice(0, 30) : "",
      licenseUrl: /^https?:\/\//i.test(background.licenseUrl || "") ? background.licenseUrl : ""
    } : null,
    showAllGroup,
    groupOrder,
    groups,
    shortcuts
  };
}

export function getOrderedGroups(groups, groupOrder, showAllGroup) {
  const available = [...(showAllGroup ? [{ id: "all", name: "全部" }] : []), ...groups];
  const groupMap = new Map(available.map((group) => [group.id, group]));
  const ordered = groupOrder.map((id) => groupMap.get(id)).filter(Boolean);
  const orderedIds = new Set(ordered.map((group) => group.id));
  return [...ordered, ...available.filter((group) => !orderedIds.has(group.id))];
}

export function normalizeUrl(rawValue) {
  const value = rawValue.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) throw new Error("invalid-url");
  return url.href;
}

export function getMark(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => /^[\x00-\x7F]+$/.test(word))) {
    return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  }
  return Array.from(name.replace(/\s/g, "")).slice(0, 2).join("").toUpperCase();
}

export function normalizeGroupName(value) {
  return String(value ?? "").trim().slice(0, 12);
}

export function isGroupNameTaken(groups, name, excludeId = null) {
  const target = normalizeGroupName(name).toLocaleLowerCase();
  if (!target) return false;
  return groups.some((group) => group.id !== excludeId && normalizeGroupName(group.name).toLocaleLowerCase() === target);
}

const EXPORT_APP_ID = "easy-tab";

export function createExportPayload(state) {
  return {
    app: EXPORT_APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state
  };
}

export function parseExportPayload(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw Object.assign(new Error("invalid-json"), { code: "invalid-json" });
  }

  if (!payload || typeof payload !== "object" || payload.app !== EXPORT_APP_ID || !payload.data || typeof payload.data !== "object") {
    throw Object.assign(new Error("invalid-format"), { code: "invalid-format" });
  }
  if (!Array.isArray(payload.data.shortcuts) || !Array.isArray(payload.data.groups)) {
    throw Object.assign(new Error("invalid-format"), { code: "invalid-format" });
  }

  const state = normalizeState(payload.data);
  return {
    state,
    shortcutCount: state.shortcuts.length,
    groupCount: state.groups.length,
    filteredCount: Math.max(0, payload.data.shortcuts.length - state.shortcuts.length),
    exportedAt: typeof payload.exportedAt === "string" ? payload.exportedAt : ""
  };
}

function urlKey(url) {
  try {
    return new URL(url).href;
  } catch {
    return String(url || "");
  }
}

export function mergeImportedState(current, imported) {
  const groups = [...current.groups];
  const groupMap = new Map();

  for (const group of imported.groups) {
    const existing = current.groups.find((item) => normalizeGroupName(item.name).toLocaleLowerCase() === normalizeGroupName(group.name).toLocaleLowerCase());
    if (existing) {
      groupMap.set(group.id, existing.id);
      continue;
    }
    let id = group.id;
    while (groups.some((item) => item.id === id)) id = `${group.id}-${Math.random().toString(36).slice(2, 6)}`;
    groupMap.set(group.id, id);
    groups.push({ id, name: group.name });
  }

  const seenUrls = new Set(current.shortcuts.map((item) => urlKey(item.url)));
  const seenIds = new Set(current.shortcuts.map((item) => item.id));
  const shortcuts = [...current.shortcuts];

  for (const item of imported.shortcuts) {
    const key = urlKey(item.url);
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);
    let id = item.id;
    while (seenIds.has(id)) id = `${item.id}-${Math.random().toString(36).slice(2, 6)}`;
    seenIds.add(id);
    shortcuts.push({
      ...item,
      id,
      groupId: item.groupId ? groupMap.get(item.groupId) ?? null : null
    });
  }

  return { ...current, groups, shortcuts };
}
