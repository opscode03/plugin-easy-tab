import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import Modal from "./Modal";
import { SEARCH_ENGINES } from "../data";

const THEMES = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" }
];

const TIME_DISPLAYS = [
  { value: "hero", label: "页面居中" },
  { value: "footer", label: "底部居中" }
];

const TIME_FORMATS = [
  { value: "24", label: "24 小时制" },
  { value: "12", label: "12 小时制" }
];

const OPEN_TARGETS = [
  { value: "current", label: "当前页" },
  { value: "new", label: "新标签页" }
];

const DENSITIES = [
  { value: "comfortable", label: "舒适" },
  { value: "compact", label: "紧凑" }
];

export default function SettingsDialog({ open, settings, onClose, onSave }) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wallpaperQuery, setWallpaperQuery] = useState("自然风景");
  const [wallpaperLoading, setWallpaperLoading] = useState(false);
  const [wallpaperError, setWallpaperError] = useState("");
  const wallpaperRequestRef = useRef(null);

  useEffect(() => {
    if (open) {
      setDraft({
        name: settings.name,
        theme: settings.theme,
        engine: settings.engine,
        timeDisplay: settings.timeDisplay,
        timeFormat: settings.timeFormat,
        showSeconds: settings.showSeconds,
        showDate: settings.showDate,
        showWeekday: settings.showWeekday,
        showSearch: settings.showSearch,
        openTarget: settings.openTarget,
        shortcutRows: settings.shortcutRows,
        shortcutDensity: settings.shortcutDensity,
        background: settings.background
      });
      setError("");
      setWallpaperError("");
      setWallpaperLoading(false);
    }
    return () => {
      wallpaperRequestRef.current?.abort();
      wallpaperRequestRef.current = null;
    };
  }, [open, settings]);

  async function handleFetchWallpaper() {
    const query = wallpaperQuery.trim();
    if (!query) {
      setWallpaperError("请输入壁纸关键词。");
      return;
    }

    wallpaperRequestRef.current?.abort();
    const controller = new AbortController();
    wallpaperRequestRef.current = controller;
    setWallpaperLoading(true);
    setWallpaperError("");
    try {
      const params = new URLSearchParams({ q: query, page_size: "12", mature: "false" });
      const response = await fetch(`https://api.openverse.org/v1/images/?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("wallpaper-request-failed");
      const data = await response.json();
      const results = (Array.isArray(data.results) ? data.results : []).filter((item) =>
        item && typeof item.url === "string" && /^https:\/\//i.test(item.url)
      );
      if (results.length === 0) {
        setWallpaperError("没有找到可用壁纸，请换个关键词。");
        return;
      }

      const item = results[Math.floor(Math.random() * results.length)];
      setDraft((current) => ({
        ...current,
        background: {
          url: item.url,
          title: String(item.title || "开放壁纸").slice(0, 80),
          creator: String(item.creator || "未知作者").slice(0, 60),
          sourceUrl: item.foreign_landing_url || "",
          license: [item.license, item.license_version].filter(Boolean).join(" ").toUpperCase(),
          licenseUrl: item.license_url || ""
        }
      }));
    } catch (requestError) {
      if (requestError.name !== "AbortError") setWallpaperError("壁纸获取失败，请检查网络后重试。");
    } finally {
      if (wallpaperRequestRef.current === controller) {
        wallpaperRequestRef.current = null;
        setWallpaperLoading(false);
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ ...draft, name: draft.name.trim() });
      onClose();
    } catch {
      setError("保存失败，请检查浏览器存储权限后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="settings-title"
      className="side-enter fixed inset-y-0 right-0 m-0 ml-auto h-dvh max-h-none w-full max-w-[400px] rounded-none border-y-0 border-r-0"
    >
      <div className="flex h-full flex-col">
        <header className="dialog-header">
          <div>
            <p className="dialog-eyebrow">个性化</p>
            <h2 id="settings-title" className="dialog-title">让新标签页更合心意</h2>
          </div>
          <button className="icon-button -mr-2 -mt-1" type="button" aria-label="关闭设置" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="grid flex-1 content-start gap-7 overflow-y-auto p-6 max-[480px]:p-5">

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-medium">外观</legend>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-sage-soft p-1">
                {THEMES.map((theme) => (
                  <label key={theme.value} className="relative min-w-0 cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="theme"
                      value={theme.value}
                      checked={draft.theme === theme.value}
                      onChange={() => setDraft({ ...draft, theme: theme.value })}
                    />
                    <span className="grid min-h-9 place-items-center rounded-[9px] px-1 text-[13px] text-ink-muted transition peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-sage">
                      {theme.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-sm font-medium" htmlFor="wallpaper-query">整体背景</label>
                {draft.background && (
                  <button
                    className="min-h-8 px-1 text-xs text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                    type="button"
                    onClick={() => {
                      setDraft({ ...draft, background: null });
                      setWallpaperError("");
                    }}
                  >
                    恢复默认
                  </button>
                )}
              </div>
              {draft.background ? (
                <div className="overflow-hidden rounded-xl border border-line">
                  <img
                    key={draft.background.url}
                    className="h-32 w-full object-cover"
                    src={draft.background.url}
                    alt="当前壁纸预览"
                    referrerPolicy="no-referrer"
                    onLoad={(event) => { event.currentTarget.hidden = false; }}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                      setWallpaperError("壁纸预览加载失败，可换一张或恢复默认。");
                    }}
                  />
                  <div className="p-3">
                    <p className="m-0 truncate text-[13px] font-medium" title={draft.background.title}>{draft.background.title || "开放壁纸"}</p>
                    <p className="mb-0 mt-1 truncate text-xs text-ink-muted">
                      {draft.background.sourceUrl ? (
                        <a className="underline-offset-2 hover:underline" href={draft.background.sourceUrl} target="_blank" rel="noreferrer">{draft.background.creator}</a>
                      ) : draft.background.creator}
                      {draft.background.license && (
                        <>
                          {" · "}
                          {draft.background.licenseUrl ? (
                            <a className="underline-offset-2 hover:underline" href={draft.background.licenseUrl} target="_blank" rel="noreferrer">{draft.background.license}</a>
                          ) : draft.background.license}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="m-0 text-xs leading-relaxed text-ink-muted">当前使用暖白纸感背景。</p>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  id="wallpaper-query"
                  className="field-input min-w-0"
                  type="text"
                  maxLength={40}
                  placeholder="如：自然风景、插画"
                  value={wallpaperQuery}
                  onChange={(event) => setWallpaperQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleFetchWallpaper();
                    }
                  }}
                />
                <button
                  className="button-secondary shrink-0 px-3"
                  type="button"
                  disabled={wallpaperLoading}
                  aria-busy={wallpaperLoading}
                  onClick={handleFetchWallpaper}
                >
                  {wallpaperLoading ? "搜索中…" : draft.background ? "换一张" : "获取壁纸"}
                </button>
              </div>
              <p className="mb-0 mt-2 text-xs leading-relaxed text-ink-muted">
                由 <a className="underline underline-offset-2" href="https://openverse.org/" target="_blank" rel="noreferrer">Openverse</a> 检索开放授权图片，保存后应用。
              </p>
              <p className="mb-0 mt-2 text-xs text-danger" role="alert">{wallpaperError}</p>
            </div>

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-medium">时间展示</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-sage-soft p-1">
                {TIME_DISPLAYS.map((display) => (
                  <label key={display.value} className="relative min-w-0 cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="timeDisplay"
                      value={display.value}
                      checked={draft.timeDisplay === display.value}
                      onChange={() => setDraft({ ...draft, timeDisplay: display.value })}
                    />
                    <span className="grid min-h-9 place-items-center rounded-[9px] px-1 text-[13px] text-ink-muted transition peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-sage">
                      {display.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mb-0 mt-2 text-xs leading-relaxed text-ink-muted">底部居中模式仅显示时间，不显示日期。</p>
            </fieldset>

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-medium">小时制式</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-sage-soft p-1">
                {TIME_FORMATS.map((format) => (
                  <label key={format.value} className="relative min-w-0 cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="timeFormat"
                      value={format.value}
                      checked={draft.timeFormat === format.value}
                      onChange={() => setDraft({ ...draft, timeFormat: format.value })}
                    />
                    <span className="grid min-h-9 place-items-center rounded-[9px] px-1 text-[13px] text-ink-muted transition peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-sage">
                      {format.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <div className="mb-3 flex items-center justify-between gap-4">
                <label className="text-sm font-medium" htmlFor="shortcut-rows">常用入口行数</label>
                <output className="text-sm text-ink-muted" htmlFor="shortcut-rows">{draft.shortcutRows} 行</output>
              </div>
              <input
                id="shortcut-rows"
                className="h-2 w-full cursor-pointer accent-sage"
                type="range"
                min={3}
                max={6}
                step={1}
                value={draft.shortcutRows}
                aria-valuetext={`${draft.shortcutRows} 行`}
                onChange={(event) => setDraft({ ...draft, shortcutRows: Number(event.target.value) })}
              />
              <div className="mt-2 flex justify-between text-xs text-ink-muted" aria-hidden="true">
                {[3, 4, 5, 6].map((row) => <span key={row}>{row}</span>)}
              </div>
              <p className="mb-0 mt-2 text-xs leading-relaxed text-ink-muted">超出显示行数后，可按整页左右滑动。</p>
            </div>

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-medium">布局密度</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-sage-soft p-1">
                {DENSITIES.map((density) => (
                  <label key={density.value} className="relative min-w-0 cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="shortcutDensity"
                      value={density.value}
                      checked={draft.shortcutDensity === density.value}
                      onChange={() => setDraft({ ...draft, shortcutDensity: density.value })}
                    />
                    <span className="grid min-h-9 place-items-center rounded-[9px] px-1 text-[13px] text-ink-muted transition peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-sage">
                      {density.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mb-0 mt-2 text-xs leading-relaxed text-ink-muted">紧凑模式会缩小入口图标与间距。</p>
            </fieldset>

            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="settings-engine">默认搜索引擎</label>
              <div className="relative flex items-center">
                <select
                  id="settings-engine"
                  className="field-input cursor-pointer appearance-none pr-9"
                  value={draft.engine}
                  onChange={(event) => setDraft({ ...draft, engine: event.target.value })}
                >
                  {SEARCH_ENGINES.map((engine) => <option key={engine.id} value={engine.id}>{engine.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-ink-muted" aria-hidden="true" />
              </div>
            </div>

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-medium">网页打开方式</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-sage-soft p-1">
                {OPEN_TARGETS.map((target) => (
                  <label key={target.value} className="relative min-w-0 cursor-pointer">
                    <input
                      className="peer sr-only"
                      type="radio"
                      name="openTarget"
                      value={target.value}
                      checked={draft.openTarget === target.value}
                      onChange={() => setDraft({ ...draft, openTarget: target.value })}
                    />
                    <span className="grid min-h-9 place-items-center rounded-[9px] px-1 text-[13px] text-ink-muted transition peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-sage">
                      {target.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mb-0 mt-2 text-xs leading-relaxed text-ink-muted">搜索、网址和常用入口共用此设置。</p>
            </fieldset>

            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-medium" htmlFor="show-search">显示搜索栏</label>
                <p className="mb-0 mt-1 text-xs leading-relaxed text-ink-muted">关闭后隐藏搜索和网址输入框。</p>
              </div>
              <label className="relative -m-2 inline-flex cursor-pointer p-2">
                <input
                  id="show-search"
                  className="peer sr-only"
                  type="checkbox"
                  role="switch"
                  checked={draft.showSearch}
                  onChange={(event) => setDraft({ ...draft, showSearch: event.target.checked })}
                />
                <span className="relative h-7 w-12 rounded-full bg-line transition peer-checked:bg-sage peer-focus-visible:ring-2 peer-focus-visible:ring-sage peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-surface after:shadow-sm after:transition after:content-[''] peer-checked:after:translate-x-5" />
              </label>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-medium" htmlFor="show-seconds">显示秒数</label>
                <p className="mb-0 mt-1 text-xs leading-relaxed text-ink-muted">时间将显示为“时:分:秒”。</p>
              </div>
              <label className="relative -m-2 inline-flex cursor-pointer p-2">
                <input
                  id="show-seconds"
                  className="peer sr-only"
                  type="checkbox"
                  role="switch"
                  checked={draft.showSeconds}
                  onChange={(event) => setDraft({ ...draft, showSeconds: event.target.checked })}
                />
                <span className="relative h-7 w-12 rounded-full bg-line transition peer-checked:bg-sage peer-focus-visible:ring-2 peer-focus-visible:ring-sage peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-surface after:shadow-sm after:transition after:content-[''] peer-checked:after:translate-x-5" />
              </label>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-medium" htmlFor="show-date">显示日期</label>
                <p className="mb-0 mt-1 text-xs leading-relaxed text-ink-muted">在页面居中时间上方显示日期。</p>
              </div>
              <label className="relative -m-2 inline-flex cursor-pointer p-2">
                <input
                  id="show-date"
                  className="peer sr-only"
                  type="checkbox"
                  role="switch"
                  checked={draft.showDate}
                  onChange={(event) => setDraft({ ...draft, showDate: event.target.checked })}
                />
                <span className="relative h-7 w-12 rounded-full bg-line transition peer-checked:bg-sage peer-focus-visible:ring-2 peer-focus-visible:ring-sage peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-surface after:shadow-sm after:transition after:content-[''] peer-checked:after:translate-x-5" />
              </label>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-sm font-medium" htmlFor="show-weekday">显示星期</label>
                <p className="mb-0 mt-1 text-xs leading-relaxed text-ink-muted">在页面居中时间上方显示星期。</p>
              </div>
              <label className="relative -m-2 inline-flex cursor-pointer p-2">
                <input
                  id="show-weekday"
                  className="peer sr-only"
                  type="checkbox"
                  role="switch"
                  checked={draft.showWeekday}
                  onChange={(event) => setDraft({ ...draft, showWeekday: event.target.checked })}
                />
                <span className="relative h-7 w-12 rounded-full bg-line transition peer-checked:bg-sage peer-focus-visible:ring-2 peer-focus-visible:ring-sage peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-surface after:shadow-sm after:transition after:content-[''] peer-checked:after:translate-x-5" />
              </label>
            </div>
          </div>

          <p className="mx-6 mb-3 text-[13px] text-danger" role="alert">{error}</p>
          <footer className="mt-auto flex justify-end gap-2 border-t border-line p-4 px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
            <button className="button-secondary" type="button" onClick={onClose}>取消</button>
            <button className="button-primary" type="submit" disabled={saving} aria-busy={saving}>
              {saving ? "保存中…" : "保存设置"}
            </button>
          </footer>
        </form>
      </div>
    </Modal>
  );
}
