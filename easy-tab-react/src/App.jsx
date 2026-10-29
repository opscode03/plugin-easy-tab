import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import SearchBar from "./components/SearchBar";
import Shortcuts from "./components/Shortcuts";
import SettingsDialog from "./components/SettingsDialog";
import ShortcutDialog from "./components/ShortcutDialog";
import BookmarkImportDialog from "./components/BookmarkImportDialog";
import { createDefaults, getMark, normalizeUrl } from "./data";
import { isSyncStorageAvailable, loadState, saveState, subscribeToState } from "./storage";

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
  const [managing, setManaging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutEditor, setShortcutEditor] = useState({ open: false, shortcut: null });
  const [bookmarkImportOpen, setBookmarkImportOpen] = useState(false);
  const [backgroundFailed, setBackgroundFailed] = useState(false);
  const [toast, setToast] = useState(null);
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
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [state.theme]);

  useEffect(() => {
    function handleKeydown(event) {
      const target = event.target;
      const isTyping = target instanceof Element && (target.matches("input, textarea, select") || target.isContentEditable);
      const hasOpenDialog = Boolean(document.querySelector("dialog[open]"));
      if (state.showSearch && event.key === "/" && !isTyping && !hasOpenDialog && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape" && managing && !hasOpenDialog) setManaging(false);
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [managing, state.showSearch]);

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
    } catch {
      setToast({ message: "搜索引擎保存失败" });
    }
  }

  async function handleSaveSettings(settings) {
    await commit({ ...stateRef.current, ...settings });
    setToast({ message: "设置已保存" });
  }

  async function handleSaveShortcut(draft) {
    const current = stateRef.current;
    const shortcut = {
      id: draft.id || `site-${Date.now().toString(36)}`,
      name: draft.name,
      url: draft.url,
      mark: draft.mark
    };
    const shortcuts = draft.id
      ? current.shortcuts.map((item) => item.id === draft.id ? shortcut : item)
      : [...current.shortcuts, shortcut];
    await commit({ ...current, shortcuts });
    setToast({ message: draft.id ? "入口已更新" : "入口已添加" });
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
        mark: getMark(bookmark.name)
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
    } catch {
      setToast({ message: "排序保存失败，请重试" });
    }
  }

  async function handleDeleteShortcut(id) {
    const current = stateRef.current;
    const index = current.shortcuts.findIndex((item) => item.id === id);
    if (index < 0) return;
    const removed = current.shortcuts[index];
    try {
      await commit({ ...current, shortcuts: current.shortcuts.filter((item) => item.id !== id) });
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
    } catch {
      setToast({ message: "删除失败，请重试" });
    }
  }

  async function handleUndo() {
    const action = toast?.onUndo;
    setToast(null);
    if (!action) return;
    try {
      await action();
    } catch {
      setToast({ message: "恢复失败，请重试" });
    }
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
    <div className="relative isolate grid min-h-screen grid-rows-[auto_1fr_auto]">
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
        className="fixed left-2 top-2 z-[600] -translate-y-[160%] rounded-[10px] bg-ink px-3.5 py-2.5 text-sm text-canvas transition-transform focus:translate-y-0"
        href="#main-content"
      >
        跳至主要内容
      </a>

      <header className="reveal flex w-full items-center justify-end px-4 pb-4 pt-[max(20px,env(safe-area-inset-top))] [animation-delay:20ms] sm:px-6 sm:pt-[max(24px,env(safe-area-inset-top))]">
        <button className="icon-button" type="button" aria-label="打开设置" title="设置" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
        </button>
      </header>

      <main id="main-content" className={`flex w-full items-start px-4 sm:px-6 ${state.shortcutDensity === "compact" ? "py-7 sm:py-10" : "py-10 sm:py-14"}`}>
        <div className="mx-auto w-full max-w-[960px]">
          <section className="mx-auto max-w-[760px] text-center" aria-label={state.timeDisplay === "hero" ? "当前时间" : "问候"}>
            {state.timeDisplay === "hero" && (
              <>
                {dateLabel && (
                  <p className="reveal m-0 text-[13px] tracking-[0.08em] text-ink-muted [animation-delay:60ms]">{dateLabel}</p>
                )}
                <time
                  className="reveal mt-4 block font-display text-[clamp(64px,15vw,104px)] font-normal leading-none tracking-[-0.055em] text-ink [animation-delay:100ms] [font-variant-numeric:tabular-nums] max-[480px]:tracking-[-0.065em]"
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

          <div className="mx-auto max-w-[760px]">
            {state.showSearch && (
              <SearchBar engine={state.engine} openTarget={state.openTarget} onEngineChange={handleEngineChange} inputRef={searchInputRef} />
            )}
          </div>
          <Shortcuts
            shortcuts={state.shortcuts}
            rows={state.shortcutRows}
            density={state.shortcutDensity}
            openTarget={state.openTarget}
            loading={loading}
            managing={managing}
            onToggleManaging={() => setManaging((value) => !value)}
            onAdd={() => setShortcutEditor({ open: true, shortcut: null })}
            onEdit={(shortcut) => setShortcutEditor({ open: true, shortcut })}
            onDelete={handleDeleteShortcut}
            onImport={() => setBookmarkImportOpen(true)}
            onReorder={handleReorderShortcut}
          />
        </div>
      </main>

      <footer className="mx-auto grid w-[min(calc(100%_-_32px),1120px)] grid-cols-[1fr_auto_1fr] items-center gap-2 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 text-xs text-ink-muted sm:w-[min(calc(100%_-_48px),1120px)] sm:gap-4">
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
          <time className="col-start-2 whitespace-nowrap font-medium text-ink [font-variant-numeric:tabular-nums]" dateTime={now.toISOString()}>
            {timePeriod && <span className="mr-1 text-[11px] font-normal">{timePeriod}</span>}
            {time}
          </time>
        )}
        {state.showSearch && (
          <span className="col-start-3 inline-flex items-center justify-self-end gap-1.5">
            <kbd className="grid h-6 min-w-6 place-items-center rounded-[7px] border border-line bg-surface px-1 font-body text-xs text-ink shadow-sm">/</kbd>
            快速搜索
          </span>
        )}
      </footer>

      <SettingsDialog
        open={settingsOpen}
        settings={state}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
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
          className="fixed bottom-[max(28px,env(safe-area-inset-bottom))] left-1/2 z-[500] flex max-w-[calc(100%_-_32px)] -translate-x-1/2 items-center gap-4 rounded-xl bg-ink px-4 py-3 text-sm text-canvas shadow-dialog"
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
