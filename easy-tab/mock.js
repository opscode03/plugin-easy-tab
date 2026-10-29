(function () {
  const searchEngines = [
    { id: "bing", label: "必应", url: "https://www.bing.com/search?q={query}" },
    { id: "google", label: "Google", url: "https://www.google.com/search?q={query}" },
    { id: "baidu", label: "百度", url: "https://www.baidu.com/s?wd={query}" },
    { id: "duckduckgo", label: "DuckDuckGo", url: "https://duckduckgo.com/?q={query}" }
  ];

  const defaults = {
    name: "",
    theme: "system",
    engine: "bing",
    showSeconds: false,
    shortcuts: [
      { id: "bilibili", name: "哔哩哔哩", url: "https://www.bilibili.com/", mark: "B" },
      { id: "github", name: "GitHub", url: "https://github.com/", mark: "GH" },
      { id: "figma", name: "Figma", url: "https://www.figma.com/", mark: "F" },
      { id: "gmail", name: "Gmail", url: "https://mail.google.com/", mark: "M" },
      { id: "mdn", name: "MDN", url: "https://developer.mozilla.org/zh-CN/", mark: "</>" }
    ]
  };

  function createDefaults() {
    return JSON.parse(JSON.stringify(defaults));
  }

  function normalizeState(candidate) {
    const base = createDefaults();
    if (!candidate || typeof candidate !== "object") return base;

    const validThemes = ["system", "light", "dark"];
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

    return {
      name: typeof candidate.name === "string" ? candidate.name.slice(0, 12) : "",
      theme: validThemes.includes(candidate.theme) ? candidate.theme : "system",
      engine: searchEngines.some((engine) => engine.id === candidate.engine) ? candidate.engine : "bing",
      showSeconds: Boolean(candidate.showSeconds),
      shortcuts
    };
  }

  window.EasyTabData = Object.freeze({ searchEngines, createDefaults, normalizeState });
})();
