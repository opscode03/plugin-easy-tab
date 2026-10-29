(function () {
  const DB = window.EasyTabData;
  const API = window.EasyTabAPI;
  const byId = (id) => document.getElementById(id);
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");

  let state = DB.createDefaults();
  let managing = false;
  let toastTimer;
  let toastActionHandler = null;

  const elements = {
    clock: byId("clock"),
    currentDate: byId("currentDate"),
    greeting: byId("greeting"),
    searchForm: byId("searchForm"),
    searchInput: byId("searchInput"),
    searchError: byId("searchError"),
    engineSelect: byId("engineSelect"),
    shortcutGrid: byId("shortcutGrid"),
    manageShortcuts: byId("manageShortcuts"),
    manageLabel: byId("manageLabel"),
    manageIcon: byId("manageIcon"),
    settingsDialog: byId("settingsDialog"),
    settingsForm: byId("settingsForm"),
    settingsError: byId("settingsError"),
    settingsEngine: byId("settingsEngine"),
    userName: byId("userName"),
    showSeconds: byId("showSeconds"),
    saveSettings: byId("saveSettings"),
    shortcutDialog: byId("shortcutDialog"),
    shortcutForm: byId("shortcutForm"),
    shortcutDialogTitle: byId("shortcutDialogTitle"),
    shortcutId: byId("shortcutId"),
    shortcutName: byId("shortcutName"),
    shortcutUrl: byId("shortcutUrl"),
    shortcutFormError: byId("shortcutFormError"),
    saveShortcut: byId("saveShortcut"),
    toast: byId("toast"),
    toastMessage: byId("toastMessage"),
    toastAction: byId("toastAction")
  };

  function createIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", `#icon-${name}`);
    svg.appendChild(use);
    return svg;
  }

  function applyTheme() {
    const isDark = state.theme === "dark" || (state.theme === "system" && systemTheme.matches);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }

  function updateClock() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    elements.clock.textContent = state.showSeconds ? `${time}:${pad(now.getSeconds())}` : time;
    elements.clock.dateTime = now.toISOString();

    const date = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
    const weekday = now.toLocaleDateString("zh-CN", { weekday: "long" });
    elements.currentDate.textContent = `${date} · ${weekday}`;

    const hour = now.getHours();
    const greeting = hour < 6 ? "夜深了" : hour < 11 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
    elements.greeting.textContent = state.name.trim()
      ? `${greeting}，${state.name.trim()}。`
      : `${greeting}，今天想做点什么？`;
  }

  function populateEngines() {
    DB.searchEngines.forEach((engine) => {
      [elements.engineSelect, elements.settingsEngine].forEach((select) => {
        const option = document.createElement("option");
        option.value = engine.id;
        option.textContent = engine.label;
        select.appendChild(option);
      });
    });
  }

  function syncSettingsForm() {
    elements.userName.value = state.name;
    elements.settingsEngine.value = state.engine;
    elements.engineSelect.value = state.engine;
    elements.showSeconds.checked = state.showSeconds;
    const theme = elements.settingsForm.querySelector(`input[name="theme"][value="${state.theme}"]`);
    if (theme) theme.checked = true;
  }

  function makeShortcutLink(shortcut) {
    const link = document.createElement(managing ? "button" : "a");
    link.className = "shortcut-link";
    if (managing) {
      link.type = "button";
      link.dataset.action = "edit";
      link.dataset.id = shortcut.id;
      link.setAttribute("aria-label", `编辑${shortcut.name}`);
    } else {
      link.href = shortcut.url;
      link.setAttribute("aria-label", `打开${shortcut.name}`);
    }

    const mark = document.createElement("span");
    mark.className = "shortcut-mark";
    mark.textContent = shortcut.mark;
    const label = document.createElement("span");
    label.className = "shortcut-label";
    label.textContent = shortcut.name;
    link.append(mark, label);
    return link;
  }

  function renderShortcuts() {
    elements.shortcutGrid.replaceChildren();
    elements.shortcutGrid.classList.toggle("is-managing", managing);
    elements.shortcutGrid.setAttribute("aria-busy", "false");

    if (state.shortcuts.length === 0) {
      const empty = document.createElement("div");
      empty.className = "shortcut-empty";
      const title = document.createElement("strong");
      title.textContent = "还没有常用入口";
      const hint = document.createElement("span");
      hint.textContent = "点击“添加”收藏第一个网站。";
      empty.append(title, hint);
      elements.shortcutGrid.appendChild(empty);
    }

    state.shortcuts.forEach((shortcut) => {
      const item = document.createElement("div");
      item.className = "shortcut-item";
      item.appendChild(makeShortcutLink(shortcut));

      if (managing) {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "shortcut-delete";
        remove.dataset.action = "delete";
        remove.dataset.id = shortcut.id;
        remove.setAttribute("aria-label", `删除${shortcut.name}`);
        remove.appendChild(createIcon("trash-2"));
        item.appendChild(remove);
      }
      elements.shortcutGrid.appendChild(item);
    });

    const addItem = document.createElement("div");
    addItem.className = "shortcut-item";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "shortcut-link shortcut-add";
    add.dataset.action = "add";
    add.setAttribute("aria-label", "添加常用入口");
    const addMark = document.createElement("span");
    addMark.className = "shortcut-mark";
    addMark.appendChild(createIcon("plus"));
    const addLabel = document.createElement("span");
    addLabel.className = "shortcut-label";
    addLabel.textContent = "添加";
    add.append(addMark, addLabel);
    addItem.appendChild(add);
    elements.shortcutGrid.appendChild(addItem);
  }

  function renderAll() {
    applyTheme();
    updateClock();
    syncSettingsForm();
    renderShortcuts();
  }

  function hideToast() {
    clearTimeout(toastTimer);
    elements.toast.classList.remove("is-visible");
    elements.toastAction.hidden = true;
    toastActionHandler = null;
  }

  function showToast(message, onUndo) {
    hideToast();
    elements.toastMessage.textContent = message;
    toastActionHandler = onUndo || null;
    elements.toastAction.hidden = !onUndo;
    elements.toast.classList.add("is-visible");
    toastTimer = setTimeout(hideToast, onUndo ? 4500 : 2600);
  }

  function setBusy(button, busy, busyText, idleText) {
    button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    button.querySelector("span").textContent = busy ? busyText : idleText;
  }

  function openSettings() {
    syncSettingsForm();
    elements.settingsError.hidden = true;
    elements.settingsDialog.showModal();
  }

  function clearShortcutError() {
    elements.shortcutFormError.hidden = true;
    elements.shortcutName.removeAttribute("aria-invalid");
    elements.shortcutUrl.removeAttribute("aria-invalid");
  }

  function showShortcutError(message, input) {
    elements.shortcutFormError.textContent = message;
    elements.shortcutFormError.hidden = false;
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }

  function openShortcutEditor(id) {
    elements.shortcutForm.reset();
    clearShortcutError();
    const shortcut = state.shortcuts.find((item) => item.id === id);
    elements.shortcutId.value = shortcut ? shortcut.id : "";
    elements.shortcutDialogTitle.textContent = shortcut ? "编辑入口" : "添加入口";
    elements.shortcutName.value = shortcut ? shortcut.name : "";
    elements.shortcutUrl.value = shortcut ? shortcut.url : "";
    elements.shortcutDialog.showModal();
    requestAnimationFrame(() => elements.shortcutName.focus());
  }

  function normalizeUrl(rawValue) {
    const value = rawValue.trim();
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname) throw new Error("invalid-url");
    return url.href;
  }

  function getMark(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length > 1 && words.every((word) => /^[\x00-\x7F]+$/.test(word))) {
      return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
    }
    return Array.from(name.replace(/\s/g, "")).slice(0, 2).join("").toUpperCase();
  }

  async function deleteShortcut(id) {
    const index = state.shortcuts.findIndex((item) => item.id === id);
    if (index < 0) return;
    const removed = state.shortcuts[index];
    const next = { ...state, shortcuts: state.shortcuts.filter((item) => item.id !== id) };

    try {
      state = await API.saveState(next);
      renderShortcuts();
      showToast(`已删除「${removed.name}」`, async () => {
        const restored = [...state.shortcuts];
        restored.splice(Math.min(index, restored.length), 0, removed);
        state = await API.saveState({ ...state, shortcuts: restored });
        renderShortcuts();
        showToast("已恢复入口");
      });
    } catch {
      showToast("删除失败，请重试");
    }
  }

  function bindDialogDismiss(dialog) {
    dialog.addEventListener("click", (event) => {
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) dialog.close();
    });
  }

  function bindEvents() {
    byId("openSettings").addEventListener("click", openSettings);

    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => byId(button.dataset.close).close());
    });

    bindDialogDismiss(elements.settingsDialog);
    bindDialogDismiss(elements.shortcutDialog);

    elements.manageShortcuts.addEventListener("click", () => {
      managing = !managing;
      elements.manageShortcuts.setAttribute("aria-pressed", String(managing));
      elements.manageLabel.textContent = managing ? "完成" : "管理";
      elements.manageIcon.setAttribute("href", managing ? "#icon-check" : "#icon-pencil");
      renderShortcuts();
    });

    elements.shortcutGrid.addEventListener("click", (event) => {
      const control = event.target.closest("[data-action]");
      if (!control) return;
      if (control.dataset.action === "add") openShortcutEditor();
      if (control.dataset.action === "edit") openShortcutEditor(control.dataset.id);
      if (control.dataset.action === "delete") deleteShortcut(control.dataset.id);
    });

    elements.searchInput.addEventListener("input", () => {
      elements.searchError.hidden = true;
      elements.searchInput.removeAttribute("aria-invalid");
    });

    elements.searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const query = elements.searchInput.value.trim();
      if (!query) {
        elements.searchError.textContent = "输入关键词或网址后再搜索。";
        elements.searchError.hidden = false;
        elements.searchInput.setAttribute("aria-invalid", "true");
        elements.searchInput.focus();
        return;
      }

      const engine = DB.searchEngines.find((item) => item.id === state.engine) || DB.searchEngines[0];
      const isUrl = !/\s/.test(query) && (/^https?:\/\//i.test(query) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(query));
      const target = isUrl
        ? (/^https?:\/\//i.test(query) ? query : `https://${query}`)
        : engine.url.replace("{query}", encodeURIComponent(query));
      window.location.assign(target);
    });

    elements.engineSelect.addEventListener("change", async () => {
      const previous = state.engine;
      try {
        state = await API.saveState({ ...state, engine: elements.engineSelect.value });
        elements.settingsEngine.value = state.engine;
      } catch {
        state = { ...state, engine: previous };
        elements.engineSelect.value = previous;
        showToast("搜索引擎保存失败");
      }
    });

    elements.settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      elements.settingsError.hidden = true;
      const next = {
        ...state,
        name: elements.userName.value.trim(),
        theme: elements.settingsForm.elements.theme.value,
        engine: elements.settingsEngine.value,
        showSeconds: elements.showSeconds.checked
      };

      setBusy(elements.saveSettings, true, "保存中…", "保存设置");
      try {
        state = await API.saveState(next);
        renderAll();
        elements.settingsDialog.close();
        showToast("设置已保存");
      } catch {
        elements.settingsError.textContent = "保存失败，请检查浏览器存储权限后重试。";
        elements.settingsError.hidden = false;
      } finally {
        setBusy(elements.saveSettings, false, "保存中…", "保存设置");
      }
    });

    [elements.shortcutName, elements.shortcutUrl].forEach((input) => input.addEventListener("input", clearShortcutError));

    elements.shortcutForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearShortcutError();
      const name = elements.shortcutName.value.trim();
      if (!name) {
        showShortcutError("请输入入口名称。", elements.shortcutName);
        return;
      }

      let url;
      try {
        url = normalizeUrl(elements.shortcutUrl.value);
      } catch {
        showShortcutError("请输入有效网址，例如 example.com。", elements.shortcutUrl);
        return;
      }

      const id = elements.shortcutId.value;
      const shortcut = { id: id || `site-${Date.now().toString(36)}`, name, url, mark: getMark(name) };
      const shortcuts = id
        ? state.shortcuts.map((item) => item.id === id ? shortcut : item)
        : [...state.shortcuts, shortcut];

      setBusy(elements.saveShortcut, true, "保存中…", "保存入口");
      try {
        state = await API.saveState({ ...state, shortcuts });
        renderShortcuts();
        elements.shortcutDialog.close();
        showToast(id ? "入口已更新" : "入口已添加");
      } catch {
        showShortcutError("保存失败，请检查浏览器存储权限后重试。", elements.shortcutUrl);
      } finally {
        setBusy(elements.saveShortcut, false, "保存中…", "保存入口");
      }
    });

    elements.toastAction.addEventListener("click", async () => {
      if (!toastActionHandler) return;
      const action = toastActionHandler;
      hideToast();
      try {
        await action();
      } catch {
        showToast("恢复失败，请重试");
      }
    });

    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isTyping = target.matches("input, textarea, select") || target.isContentEditable;
      const hasOpenDialog = Boolean(document.querySelector("dialog[open]"));
      if (event.key === "/" && !isTyping && !hasOpenDialog && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        elements.searchInput.focus();
      }
      if (event.key === "Escape" && managing && !hasOpenDialog) {
        managing = false;
        elements.manageShortcuts.setAttribute("aria-pressed", "false");
        elements.manageLabel.textContent = "管理";
        elements.manageIcon.setAttribute("href", "#icon-pencil");
        renderShortcuts();
      }
    });

    systemTheme.addEventListener("change", () => {
      if (state.theme === "system") applyTheme();
    });
  }

  async function init() {
    populateEngines();
    bindEvents();
    applyTheme();
    updateClock();
    setInterval(updateClock, 1000);
    state = await API.loadState();
    renderAll();
  }

  init();
})();
