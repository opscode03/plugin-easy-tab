(function () {
  const STORAGE_KEY = "easy-tab-state-v1";
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function loadState() {
    await delay(100);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return window.EasyTabData.normalizeState(saved ? JSON.parse(saved) : null);
    } catch {
      return window.EasyTabData.createDefaults();
    }
  }

  async function saveState(state) {
    await delay(140);
    const normalized = window.EasyTabData.normalizeState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  // TODO: 若需跨设备同步，可替换为 chrome.storage.sync，保持方法签名与返回结构不变。
  window.EasyTabAPI = Object.freeze({ loadState, saveState });
})();
