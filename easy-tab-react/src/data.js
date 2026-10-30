export const SEARCH_ENGINES = [
  { id: "baidu", label: "百度", url: "https://www.baidu.com/s?wd={query}" },
  { id: "bing", label: "必应", url: "https://www.bing.com/search?q={query}" },
  // { id: "deepseek", label: "DeepSeek", url: "https://chat.deepseek.com/?q={query}", type: "ai" },
  // { id: "google", label: "Google", url: "https://www.google.com/search?q={query}" },
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
  background: null,
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

export function normalizeState(candidate) {
  const base = createDefaults();
  if (!candidate || typeof candidate !== "object") return base;

  const shortcuts = Array.isArray(candidate.shortcuts)
    ? candidate.shortcuts
        .filter((item) => item && typeof item.name === "string" && /^https?:\/\//i.test(item.url || ""))
        .map((item, index) => ({
          id: String(item.id || `saved-${index}`),
          name: item.name.trim().slice(0, 12) || "未命名",
          url: item.url,
          mark: String(item.mark || item.name.slice(0, 2)).slice(0, 2)
        }))
    : base.shortcuts;

  const shortcutRows = Number(candidate.shortcutRows);
  const background = candidate.background;
  const hasBackground = background && typeof background === "object" && /^https:\/\//i.test(background.url || "");

  return {
    name: typeof candidate.name === "string" ? candidate.name.slice(0, 12) : "",
    theme: ["system", "light", "dark"].includes(candidate.theme) ? candidate.theme : "system",
    engine: SEARCH_ENGINES.some((engine) => engine.id === candidate.engine) ? candidate.engine : "bing",
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
    background: hasBackground ? {
      url: background.url,
      title: typeof background.title === "string" ? background.title.slice(0, 80) : "开放壁纸",
      creator: typeof background.creator === "string" ? background.creator.slice(0, 60) : "未知作者",
      sourceUrl: /^https?:\/\//i.test(background.sourceUrl || "") ? background.sourceUrl : "",
      license: typeof background.license === "string" ? background.license.slice(0, 30) : "",
      licenseUrl: /^https?:\/\//i.test(background.licenseUrl || "") ? background.licenseUrl : ""
    } : null,
    shortcuts
  };
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
