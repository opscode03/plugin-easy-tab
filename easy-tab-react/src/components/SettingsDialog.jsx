import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Download, Upload, X } from "lucide-react";
import Modal from "./Modal";
import Select from "./Select";
import { createExportPayload, parseExportPayload, SEARCH_ENGINES } from "../data";
import { isSyncStorageAvailable, storageErrorMessage } from "../storage";

const THEMES = [
  { value: "light", label: "浅色", hint: "暖白纸感，Notion 式温暖极简" },
  { value: "dark", label: "深色", hint: "冷调近黑，Linear 式暗色克制" },
  { value: "system", label: "跟随系统", hint: "随系统明暗实时切换：浅色为暖白，深色为近黑" }
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

export default function SettingsDialog({ open, settings, onClose, onSave, onImportData, onImportBookmarks }) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [wallpaperQuery, setWallpaperQuery] = useState("自然风景");
  const [wallpaperLoading, setWallpaperLoading] = useState(false);
  const [wallpaperError, setWallpaperError] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const wallpaperRequestRef = useRef(null);
  const fileInputRef = useRef(null);

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
        restoreLastGroup: settings.restoreLastGroup,
        background: settings.background
      });
      setError("");
      setWallpaperError("");
      setWallpaperLoading(false);
      setPendingImport(null);
      setImportError("");
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
    } catch (saveError) {
      setError(storageErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const payload = createExportPayload({ ...settings, ...draft, name: draft.name.trim() });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, "");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `easy-tab-backup-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImportError("");
    setPendingImport(null);
    try {
      const parsed = parseExportPayload(await file.text());
      setPendingImport({ ...parsed, fileName: file.name });
    } catch (importFailure) {
      setImportError(importFailure.code === "invalid-json"
        ? "文件不是有效的 JSON。"
        : importFailure.code === "invalid-format"
          ? "文件格式不正确，请选择 Easy Tab 导出的 JSON。"
          : "读取备份文件失败，请重试。");
    }
  }

  async function handleImport(mode) {
    if (!pendingImport) return;
    setImporting(true);
    setImportError("");
    try {
      await onImportData(pendingImport.state, mode);
      setPendingImport(null);
      onClose();
    } catch (importFailure) {
      setImportError(storageErrorMessage(importFailure, "导入失败，请重试。"));
    } finally {
      setImporting(false);
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
            <p className="dialog-eyebrow">Easy Tab</p>
            <h2 id="settings-title" className="dialog-title">设置</h2>
            <p className="mb-0 mt-1 text-[11px] text-ink-muted">
              {isSyncStorageAvailable() ? "入口与设置会随 Chrome 账号同步" : "数据仅保存在此浏览器"}
            </p>
          </div>
          <button className="icon-button -mr-2 -mt-1" type="button" aria-label="关闭设置" onClick={onClose}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="flex-1 overflow-y-auto px-6 py-6 max-[480px]:px-5">

            <section className="settings-section">
              <h3 className="settings-heading">外观</h3>
              <div className="segmented grid-cols-3" role="radiogroup" aria-label="主题">
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
                    <span className="segment-label">{theme.label}</span>
                  </label>
                ))}
              </div>
              <p className="settings-hint">
                {THEMES.find((theme) => theme.value === draft.theme)?.hint}
              </p>
            </section>

            <section className="settings-section">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h3 className="settings-heading mb-0">背景</h3>
                {draft.background && (
                  <button
                    className="min-h-8 px-1 text-[11px] text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
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
                <div className="overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-transparent">
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
                    <p className="mb-0 mt-1 truncate text-[11px] text-ink-muted">
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
                <p className="m-0 text-[11px] text-ink-muted">当前使用纯色背景。</p>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  id="wallpaper-query"
                  className="field-input min-w-0"
                  type="text"
                  maxLength={40}
                  placeholder="如：自然风景、插画"
                  aria-label="壁纸关键词"
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
              <p className="settings-hint">
                由 <a className="underline underline-offset-2" href="https://openverse.org/" target="_blank" rel="noreferrer">Openverse</a> 提供的开放授权图片。
              </p>
              <p className="m-0 mt-2 min-h-[1em] text-[11px] text-danger" role="alert">{wallpaperError}</p>
            </section>

            <section className="settings-section">
              <h3 className="settings-heading">时间</h3>
              <div className="segmented grid-cols-2">
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
                    <span className="segment-label">{display.label}</span>
                  </label>
                ))}
              </div>
              <p className="settings-hint">底部居中仅显示时间，不显示日期。</p>

              <div className="mt-4 segmented grid-cols-2">
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
                    <span className="segment-label">{format.label}</span>
                  </label>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <label className="text-[13px] font-medium" htmlFor="show-seconds">显示秒数</label>
                    <p className="mb-0 mt-0.5 text-[11px] leading-relaxed text-ink-muted">时间显示为“时:分:秒”。</p>
                  </div>
                  <label className="relative -m-1 inline-flex shrink-0 cursor-pointer p-1">
                    <input
                      id="show-seconds"
                      className="peer sr-only"
                      type="checkbox"
                      role="switch"
                      checked={draft.showSeconds}
                      onChange={(event) => setDraft({ ...draft, showSeconds: event.target.checked })}
                    />
                    <span className="switch-track" />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <label className="text-[13px] font-medium" htmlFor="show-date">显示日期</label>
                    <p className="mb-0 mt-0.5 text-[11px] leading-relaxed text-ink-muted">显示在时间上方。</p>
                  </div>
                  <label className="relative -m-1 inline-flex shrink-0 cursor-pointer p-1">
                    <input
                      id="show-date"
                      className="peer sr-only"
                      type="checkbox"
                      role="switch"
                      checked={draft.showDate}
                      onChange={(event) => setDraft({ ...draft, showDate: event.target.checked })}
                    />
                    <span className="switch-track" />
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <label className="text-[13px] font-medium" htmlFor="show-weekday">显示星期</label>
                    <p className="mb-0 mt-0.5 text-[11px] leading-relaxed text-ink-muted">显示在时间上方。</p>
                  </div>
                  <label className="relative -m-1 inline-flex shrink-0 cursor-pointer p-1">
                    <input
                      id="show-weekday"
                      className="peer sr-only"
                      type="checkbox"
                      role="switch"
                      checked={draft.showWeekday}
                      onChange={(event) => setDraft({ ...draft, showWeekday: event.target.checked })}
                    />
                    <span className="switch-track" />
                  </label>
                </div>
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-heading">常用入口</h3>
              <div className="mb-3 flex items-center justify-between gap-4">
                <label className="text-[13px] font-medium" htmlFor="shortcut-rows">显示行数</label>
                <output className="text-[12px] text-ink-muted" htmlFor="shortcut-rows">{draft.shortcutRows} 行</output>
              </div>
              <input
                id="shortcut-rows"
                className="h-2 w-full cursor-pointer accent-[var(--accent)]"
                type="range"
                min={3}
                max={6}
                step={1}
                value={draft.shortcutRows}
                aria-valuetext={`${draft.shortcutRows} 行`}
                onChange={(event) => setDraft({ ...draft, shortcutRows: Number(event.target.value) })}
              />
              <div className="mt-2 flex justify-between text-[11px] text-ink-muted" aria-hidden="true">
                {[3, 4, 5, 6].map((row) => <span key={row}>{row}</span>)}
              </div>
              <p className="settings-hint">超出行数后可整页左右滑动。</p>

              <div className="mt-4 segmented grid-cols-2">
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
                    <span className="segment-label">{density.label}</span>
                  </label>
                ))}
              </div>
              <p className="settings-hint">紧凑模式会缩小图标与间距。</p>

              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <label className="text-[13px] font-medium" htmlFor="restore-last-group">恢复上次分组</label>
                  <p className="mb-0 mt-0.5 text-[11px] leading-relaxed text-ink-muted">再次打开新标签页时，进入上次选中的分组。</p>
                </div>
                <label className="relative -m-1 inline-flex shrink-0 cursor-pointer p-1">
                  <input
                    id="restore-last-group"
                    className="peer sr-only"
                    type="checkbox"
                    role="switch"
                    checked={draft.restoreLastGroup}
                    onChange={(event) => setDraft({ ...draft, restoreLastGroup: event.target.checked })}
                  />
                  <span className="switch-track" />
                </label>
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-heading">搜索与打开</h3>
              <label className="mb-2 block text-[13px] font-medium" htmlFor="settings-engine">搜索服务</label>
              <Select
                id="settings-engine"
                ariaLabel="默认搜索服务"
                value={draft.engine}
                options={SEARCH_ENGINES.map((engine) => ({ value: engine.id, label: engine.label }))}
                onChange={(engine) => setDraft({ ...draft, engine })}
              />

              <div className="mt-4 segmented grid-cols-2">
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
                    <span className="segment-label">{target.label}</span>
                  </label>
                ))}
              </div>
              <p className="settings-hint">搜索与常用入口共用该设置。</p>

              <div className="mt-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <label className="text-[13px] font-medium" htmlFor="show-search">显示搜索栏</label>
                  <p className="mb-0 mt-0.5 text-[11px] leading-relaxed text-ink-muted">关闭后隐藏搜索与网址输入框。</p>
                </div>
                <label className="relative -m-1 inline-flex shrink-0 cursor-pointer p-1">
                  <input
                    id="show-search"
                    className="peer sr-only"
                    type="checkbox"
                    role="switch"
                    checked={draft.showSearch}
                    onChange={(event) => setDraft({ ...draft, showSearch: event.target.checked })}
                  />
                  <span className="switch-track" />
                </label>
              </div>
            </section>

            <section className="settings-section">
              <h3 className="settings-heading">数据</h3>
              <p className="settings-hint">导出当前入口、分组与设置；导入前可预览数量并选择覆盖或合并。</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="button-secondary inline-flex items-center gap-2" type="button" onClick={handleExport}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>导出 JSON</span>
                </button>
                <button className="button-secondary inline-flex items-center gap-2" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>导入 JSON</span>
                </button>
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  accept=".json,application/json"
                  aria-label="选择备份文件"
                  onChange={handleImportFile}
                />
              </div>

              {importError && <p className="mb-0 mt-2 text-[13px] text-danger" role="alert">{importError}</p>}

              {pendingImport && (
                <div className="mt-3 rounded-[10px] border border-[color:var(--line)] bg-[var(--panel-1)] p-3" role="group" aria-labelledby="import-preview-title">
                  <p id="import-preview-title" className="selectable m-0 truncate text-[12px] font-medium">待导入：{pendingImport.fileName}</p>
                  <p className="mb-0 mt-1 text-[12px] text-ink-muted">
                    入口 {pendingImport.shortcutCount} 个 · 分组 {pendingImport.groupCount} 个
                    {pendingImport.filteredCount > 0 ? ` · 已忽略 ${pendingImport.filteredCount} 个非法入口` : ""}
                  </p>
                  <p className="mb-0 mt-2 text-[11px] leading-relaxed text-ink-muted">覆盖会替换全部入口、分组与设置；合并只追加入口与分组，保留当前设置。</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="button-secondary min-h-9 px-3 text-[12px]" type="button" onClick={() => handleImport("overwrite")} disabled={importing}>覆盖导入</button>
                    <button className="button-primary min-h-9 px-3 text-[12px]" type="button" onClick={() => handleImport("merge")} disabled={importing}>{importing ? "导入中…" : "合并导入"}</button>
                    <button className="button-secondary min-h-9 px-3 text-[12px]" type="button" onClick={() => setPendingImport(null)} disabled={importing}>取消</button>
                  </div>
                </div>
              )}
            </section>

            <section className="settings-section">
              <h3 className="settings-heading">浏览器收藏</h3>
              <p className="settings-hint">低频操作：从 Chrome 收藏夹中选择网页导入为入口，重复网址会自动过滤。仅在点击按钮后读取收藏夹。</p>
              <button className="button-secondary mt-3 inline-flex items-center gap-2" type="button" onClick={onImportBookmarks}>
                <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                <span>导入浏览器收藏</span>
              </button>
            </section>

          </div>

          <p className="mx-6 mb-3 text-[13px] text-danger" role="alert">{error}</p>
          <footer className="mt-auto flex justify-end gap-2 border-t border-[color:var(--divider)] p-4 px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
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
