import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import SearchBar from "./components/SearchBar";
import Shortcuts from "./components/Shortcuts";
import SettingsDialog from "./components/SettingsDialog";
import ShortcutDialog from "./components/ShortcutDialog";
import BookmarkImportDialog from "./components/BookmarkImportDialog";
import { createDefaults, getMark, getOrderedGroups, isGroupNameTaken, mergeImportedState, normalizeGroupName, normalizeUrl } from "./data";
import { isSyncStorageAvailable, loadState, saveState, storageErrorMessage, subscribeToState } from "./storage";

function getGreeting(hour) {
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export default function App() {
  const [state, setState] = useState(createDefaults);
  const stateRef = useRef(state);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutEditor, setShortcutEditor] = useState({ open: false, shortcut: null });
  const [bookmarkImportOpen, setBookmarkImportOpen] = useState(false);
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const [toast, setToast] = useState(null);
  const [searchSeed, setSearchSeed] = useState(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    loadState().then((saved) => {
      if (!active) return;
      stateRef.current = saved;
      setState(saved);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => subscribeToState((saved) => {
    stateRef.current = saved;
    setState(saved);
    setLoading(false);
  }), []);

  useEffect(() => {
    setBackgroundFailed(false);
  }, [state.background?.url]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const dark = state.theme === "dark" || (state.theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [state.theme]);

  useEffect(() => {
    function handleKeydown(event) {
      if (event.defaultPrevented || event.isComposing || !state.showSearch) return;
      const target = event.target;
      const isTyping = target instanceof Element && (target.matches("input, textarea, select") || target.isContentEditable);
      const isInteractive = target instanceof Element && Boolean(target.closest("button, a[href], summary, [role='menuitem'], [role='button']"));
      const hasOpenDialog = Boolean(document.querySelector("dialog[open]"));
      const hasOpenMenu = Boolean(document.querySelector("[role='menu']"));
      if (isTyping || hasOpenDialog || hasOpenMenu || event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (event.key.length !== 1) return;
      // 空格在聚焦按钮或链接时保留原生激活行为
      if (event.key === " " && isInteractive) return;

      event.preventDefault();
      setSearchSeed({ text: event.key, nonce: Date.now() });
      searchInputRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [state.showSearch]);

  // 全局禁用浏览器原生右键菜单；应用内的自定义菜单由组件自身处理，不受影响
  useEffect(() => {
    function handleContextMenu(event) {
      event.preventDefault();
    }
    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), toast.onUndo ? 4500 : 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function commit(nextState) {
    const saved = await saveState(nextState);
    stateRef.current = saved;
    setState(saved);
    return saved;
  }

  async function handleEngineChange(engine) {
    try {
      await commit({ ...stateRef.current, engine });
    } catch (error) {
      setToast({ message: storageErrorMessage(error, "搜索引擎保存失败，请重试。") });
    }
  }

  async function handleSaveSettings(settings) {
    await commit({ ...stateRef.current, ...settings });
    setToast({ message: "设置已保存" });
  }

  async function handleSaveShortcut(draft) {
    const current = stateRef.current;
    const existing = draft.id ? current.shortcuts.find((item) => item.id === draft.id) : null;
    const shortcut = {
      id: draft.id || `site-${Date.now().toString(36)}`,
      name: draft.name,
      url: draft.url,
      mark: draft.mark,
      groupId: existing?.groupId ?? null
    };
    const shortcuts = draft.id
      ? current.shortcuts.map((item) => item.id === draft.id ? shortcut : item)
      : [...current.shortcuts, shortcut];
    await commit({ ...current, shortcuts });
    setToast({ message: draft.id ? "入口已更新" : "入口已添加" });
  }

  function handleOpenBookmarkImport() {
    setSettingsOpen(false);
    setBookmarkImportOpen(true);
  }

  async function handleImportBookmarks(bookmarks) {
    const current = stateRef.current;
    const existingUrls = new Set(current.shortcuts.map((item) => normalizeUrl(item.url)));
    const imported = [];
    for (const bookmark of bookmarks) {
      const url = normalizeUrl(bookmark.url);
      if (existingUrls.has(url)) continue;
      existingUrls.add(url);
      imported.push({
        id: `bookmark-${bookmark.id}`,
        name: bookmark.name,
        url,
        mark: getMark(bookmark.name),
        groupId: null
      });
    }

    if (imported.length === 0) {
      setToast({ message: "所选收藏均已添加" });
      return;
    }
    await commit({ ...current, shortcuts: [...current.shortcuts, ...imported] });
    setToast({ message: `已导入 ${imported.length} 个收藏` });
  }

  async function handleReorderShortcut(sourceId, targetId) {
    const current = stateRef.current;
    const sourceIndex = current.shortcuts.findIndex((item) => item.id === sourceId);
    const targetIndex = current.shortcuts.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const shortcuts = [...current.shortcuts];
    const [moved] = shortcuts.splice(sourceIndex, 1);
    shortcuts.splice(targetIndex, 0, moved);
    try {
      await commit({ ...current, shortcuts });
    } catch (error) {
      setToast({ message: storageErrorMessage(error, "排序保存失败，请重试。") });
    }
  }

  async function handleAddGroup(rawName) {
    const current = stateRef.current;
    const name = normalizeGroupName(rawName);
    if (!name) throw new Error("group-name-required");
    if (isGroupNameTaken(current.groups, name)) throw new Error("group-name-taken");
    const group = { id: `group-${Date.now().toString(36)}`, name };
    await commit({
      ...current,
      groups: [...current.groups, group],
      groupOrder: [...current.groupOrder, group.id]
    });
    setToast({ message: "分组已添加" });
    return group.id;
  }

  async function handleRenameGroup(groupId, rawName) {
    const current = stateRef.current;
    const name = normalizeGroupName(rawName);
    const group = current.groups.find((item) => item.id === groupId);
    if (!group) return;
    if (!name) throw new Error("group-name-required");
    if (isGroupNameTaken(current.groups, name, groupId)) throw new Error("group-name-taken");
    if (group.name === name) return;
    await commit({
      ...current,
      groups: current.groups.map((item) => item.id === groupId ? { ...item, name } : item)
    });
    setToast({ message: `分组已重命名为「${name}」` });
  }

  async function handleDeleteGroup(groupId) {
    const current = stateRef.current;
    if (groupId === "all") {
      if (!current.showAllGroup) return;
      const groupOrder = current.groupOrder.filter((id) => id !== "all");
      await commit({
        ...current,
        showAllGroup: false,
        groupOrder,
        lastGroupId: current.lastGroupId === "all" ? groupOrder[0] || "" : current.lastGroupId
      });
      setToast({ message: "已删除分组「全部」，常用入口已保留" });
      return;
    }

    const group = current.groups.find((item) => item.id === groupId);
    if (!group) return;
    const affected = current.shortcuts.filter((item) => item.groupId === groupId).length;
    const groupOrder = current.groupOrder.filter((id) => id !== groupId);
    await commit({
      ...current,
      groups: current.groups.filter((item) => item.id !== groupId),
      groupOrder,
      lastGroupId: current.lastGroupId === groupId
        ? current.showAllGroup ? "all" : groupOrder[0] || ""
        : current.lastGroupId,
      shortcuts: current.shortcuts.map((item) => item.groupId === groupId ? { ...item, groupId: null } : item)
    });
    setToast({ message: affected ? `已删除分组「${group.name}」，${affected} 个入口已退出分组` : `已删除分组「${group.name}」` });
  }

  async function handleReorderGroups(sourceId, targetId) {
    const current = stateRef.current;
    const orderedGroups = getOrderedGroups(current.groups, current.groupOrder, current.showAllGroup);
    const sourceIndex = orderedGroups.findIndex((group) => group.id === sourceId);
    const targetIndex = orderedGroups.findIndex((group) => group.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const [moved] = orderedGroups.splice(sourceIndex, 1);
    orderedGroups.splice(targetIndex, 0, moved);
    try {
      await commit({
        ...current,
        groups: orderedGroups.filter((group) => group.id !== "all"),
        groupOrder: orderedGroups.map((group) => group.id)
      });
    } catch (error) {
      setToast({ message: storageErrorMessage(error, "分组排序保存失败，请重试。") });
    }
  }

  async function handleMoveShortcut(id, groupId) {
    const current = stateRef.current;
    const targetGroupId = groupId === "all" ? null : groupId;
    const shortcut = current.shortcuts.find((item) => item.id === id);
    if (!shortcut || shortcut.groupId === targetGroupId) return;
    try {
      await commit({
        ...current,
        shortcuts: current.shortcuts.map((item) => item.id === id ? { ...item, groupId: targetGroupId } : item)
      });
      const groupName = targetGroupId ? current.groups.find((group) => group.id === targetGroupId)?.name : "移出分组";
      setToast({ message: targetGroupId ? `已移动到「${groupName}」` : "已移出分组" });
    } catch (error) {
      setToast({ message: storageErrorMessage(error, "移动分组失败，请重试。") });
    }
  }

  async function handleSelectGroup(groupId) {
    const current = stateRef.current;
    const lastGroupId = groupId || "";
    const isAvailable = lastGroupId === ""
      || (lastGroupId === "all" ? current.showAllGroup : current.groups.some((group) => group.id === lastGroupId));
    if (!isAvailable || current.lastGroupId === lastGroupId) return;
    try {
      await commit({ ...current, lastGroupId });
    } catch (error) {
      setToast({ message: storageErrorMessage(error, "分组状态保存失败，请重试。") });
    }
  }

  async function handleDeleteShortcut(id) {
    const current = stateRef.current;
    const index = current.shortcuts.findIndex((item) => item.id === id);
    if (index < 0) return;
    const removed = current.shortcuts[index];
    try {
      await commit({
        ...current,
        shortcuts: current.shortcuts.filter((item) => item.id !== id)
      });
      setToast({
        message: `已删除「${removed.name}」`,
        onUndo: async () => {
          const latest = stateRef.current;
          const restored = [...latest.shortcuts];
          restored.splice(Math.min(index, restored.length), 0, removed);
          await commit({ ...latest, shortcuts: restored });
          setToast({ message: "已恢复入口" });
        }
      });
    } catch (error) {
      setToast({ message: storageErrorMessage(error, "删除失败，请重试。") });
    }
  }

  async function handleUndo() {
    const action = toast?.onUndo;
    setToast(null);
    if (!action) return;
    try {
      await action();
    } catch (error) {
      setToast({ message: storageErrorMessage(error, "恢复失败，请重试。") });
    }
  }

  async function handleImportData(importedState, mode) {
    const current = stateRef.current;
    if (mode === "merge") {
      const merged = mergeImportedState(current, importedState);
      const addedShortcuts = merged.shortcuts.length - current.shortcuts.length;
      const addedGroups = merged.groups.length - current.groups.length;
      await commit(merged);
      setToast({
        message: addedShortcuts || addedGroups
          ? `已合并 ${addedShortcuts} 个入口${addedGroups ? `、${addedGroups} 个分组` : ""}`
          : "备份中没有可合并的新内容"
      });
      return;
    }
    await commit(importedState);
    setToast({ message: "已覆盖导入备份" });
  }

  const pad = (value) => String(value).padStart(2, "0");
  const is12Hour = state.timeFormat === "12";
  const displayHour = is12Hour ? now.getHours() % 12 || 12 : now.getHours();
  const time = `${pad(displayHour)}:${pad(now.getMinutes())}${state.showSeconds ? `:${pad(now.getSeconds())}` : ""}`;
  const timePeriod = is12Hour ? (now.getHours() < 12 ? "上午" : "下午") : "";
  const date = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  const weekday = now.toLocaleDateString("zh-CN", { weekday: "long" });
  const dateLabel = [state.showDate ? date : "", state.showWeekday ? weekday : ""].filter(Boolean).join(" · ");
  const greeting = getGreeting(now.getHours());
  const name = state.name.trim();
  const hasBackground = Boolean(state.background && !backgroundFailed);

  return (
    <div className="relative isolate flex h-full min-h-0 flex-col overflow-hidden">
      {hasBackground && (
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
          <img
            key={state.background.url}
            className="h-full w-full object-cover"
            src={state.background.url}
            alt=""
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setBackgroundFailed(true)}
          />
          <div className="absolute inset-0 bg-[var(--wallpaper-overlay)]" />
        </div>
      )}
      <a
        className="fixed left-2 top-2 z-[600] -translate-y-[160%] rounded-[8px] bg-[var(--accent)] px-3.5 py-2.5 text-sm text-[var(--accent-ink)] transition-transform focus:translate-y-0"
        href="#main-content"
      >
        跳至主要内容
      </a>

      <header className="reveal flex w-full shrink-0 items-center justify-end px-4 pb-2 pt-[max(10px,env(safe-area-inset-top))] [animation-delay:20ms] sm:px-6 sm:pt-[max(12px,env(safe-area-inset-top))]">
        <button className="icon-button" type="button" aria-label="打开设置" title="设置" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
        </button>
      </header>

      <main id="main-content" className={`flex min-h-0 w-full flex-1 items-stretch px-4 sm:px-6 ${state.shortcutDensity === "compact" ? "py-2 sm:py-3" : "py-3 sm:py-4"}`}>
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[880px] flex-col">
          <section className="mx-auto w-full max-w-[760px] shrink-0 text-center" aria-label={state.timeDisplay === "hero" ? "当前时间" : "问候"}>
            {state.timeDisplay === "hero" && (
              <>
                {dateLabel && (
                  <p className="reveal m-0 font-body text-[12px] font-medium tracking-[0.12em] text-ink-muted [animation-delay:60ms]">{dateLabel}</p>
                )}
                <time
                  className="clock-digits reveal mt-2.5 block font-clock text-[clamp(42px,min(14vw,9vh),88px)] font-[350] leading-none tracking-[-0.045em] text-ink [animation-delay:100ms] max-[480px]:mt-2 max-[480px]:tracking-[-0.05em]"
                  dateTime={now.toISOString()}
                >
                  {timePeriod && <span className="mr-3 font-body text-[0.24em] font-normal tracking-normal">{timePeriod}</span>}
                  {time}
                </time>
              </>
            )}
            {/* <p className={`reveal mb-0 font-display text-lg text-ink-muted [animation-delay:140ms] ${state.timeDisplay === "hero" ? "mt-5 block" : "mt-0 hidden"}`}>
              {name ? `${greeting}，${name}。` : `${greeting}，今天想做点什么？`}
            </p> */}
          </section>

          <div className="mx-auto w-full max-w-[640px] shrink-0">
            {state.showSearch && (
              <SearchBar engine={state.engine} openTarget={state.openTarget} onEngineChange={handleEngineChange} inputRef={searchInputRef} seed={searchSeed} />
            )}
          </div>
          <Shortcuts
            shortcuts={state.shortcuts}
            groups={state.groups}
            groupOrder={state.groupOrder}
            showAllGroup={state.showAllGroup}
            restoreLastGroup={state.restoreLastGroup}
            lastGroupId={state.lastGroupId}
            rows={state.shortcutRows}
            density={state.shortcutDensity}
            openTarget={state.openTarget}
            loading={loading}
            onAdd={() => setShortcutEditor({ open: true, shortcut: null })}
            onEdit={(shortcut) => setShortcutEditor({ open: true, shortcut })}
            onDelete={handleDeleteShortcut}
            onReorder={handleReorderShortcut}
            onAddGroup={handleAddGroup}
            onRenameGroup={handleRenameGroup}
            onDeleteGroup={handleDeleteGroup}
            onReorderGroups={handleReorderGroups}
            onMoveShortcut={handleMoveShortcut}
            onGroupSelect={handleSelectGroup}
          />
        </div>
      </main>

      <footer className="mx-auto grid w-[min(calc(100%_-_32px),1120px)] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 text-xs text-ink-muted sm:w-[min(calc(100%_-_48px),1120px)] sm:gap-4">
        <span className="col-start-1 min-w-0 truncate" title={hasBackground ? state.background.title : undefined}>
          {hasBackground ? (
            <>
              {state.background.sourceUrl ? (
                <a className="underline-offset-2 hover:underline" href={state.background.sourceUrl} target="_blank" rel="noreferrer">壁纸：{state.background.creator}</a>
              ) : `壁纸：${state.background.creator}`}
              {state.background.license && (
                <>
                  {" · "}
                  {state.background.licenseUrl ? (
                    <a className="underline-offset-2 hover:underline" href={state.background.licenseUrl} target="_blank" rel="noreferrer">{state.background.license}</a>
                  ) : state.background.license}
                </>
              )}
            </>
          ) : isSyncStorageAvailable() ? "数据随 Chrome 账号同步" : "数据仅保存在此浏览器"}
        </span>
        {state.timeDisplay === "footer" && (
          <time className="clock-digits col-start-2 whitespace-nowrap font-clock font-medium tracking-[-0.01em] text-ink" dateTime={now.toISOString()}>
            {timePeriod && <span className="mr-1 text-[11px] font-normal">{timePeriod}</span>}
            {time}
          </time>
        )}
        {state.showSearch && (
          <span className="col-start-3 inline-flex items-center justify-self-end gap-1.5">
            <kbd className="grid h-6 min-w-6 place-items-center rounded-[6px] border border-[color:var(--line)] bg-transparent px-1 font-body text-xs text-ink-muted">/</kbd>
            快速搜索
          </span>
        )}
      </footer>

      <SettingsDialog
        open={settingsOpen}
        settings={state}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onImportData={handleImportData}
        onImportBookmarks={handleOpenBookmarkImport}
      />
      <ShortcutDialog
        open={shortcutEditor.open}
        shortcut={shortcutEditor.shortcut}
        onClose={() => setShortcutEditor((editor) => ({ ...editor, open: false }))}
        onSave={handleSaveShortcut}
      />
      <BookmarkImportDialog
        open={bookmarkImportOpen}
        shortcuts={state.shortcuts}
        onClose={() => setBookmarkImportOpen(false)}
        onImport={handleImportBookmarks}
      />

      {toast && (
        <div
          className="fixed bottom-[max(28px,env(safe-area-inset-bottom))] left-1/2 z-[500] flex max-w-[calc(100%_-_32px)] -translate-x-1/2 items-center gap-4 rounded-[10px] border border-[color:var(--line)] bg-[var(--toast-bg)] px-4 py-3 text-sm text-[var(--toast-ink)]"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>{toast.message}</span>
          {toast.onUndo && (
            <button className="min-h-8 shrink-0 px-0 font-semibold text-inherit underline underline-offset-[3px]" type="button" onClick={handleUndo}>
              撤销
            </button>
          )}
        </div>
      )}
    </div>
  );
}
