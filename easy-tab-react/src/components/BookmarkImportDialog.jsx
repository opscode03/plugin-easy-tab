import { useEffect, useState } from "react";
import { ChevronRight, Folder, FolderOpen, X } from "lucide-react";
import Modal from "./Modal";
import SiteIcon from "./SiteIcon";
import { storageErrorMessage } from "../storage";

function comparableUrl(url) {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

function normalizeBookmarkNodes(nodes, existingUrls) {
  return nodes.flatMap((node) => {
    if (node.url) {
      if (!/^https?:\/\//i.test(node.url)) return [];
      return [{
        id: node.id,
        name: node.title.trim() || node.url,
        url: node.url,
        existing: existingUrls.has(comparableUrl(node.url))
      }];
    }

    const children = normalizeBookmarkNodes(node.children || [], existingUrls);
    if (children.length === 0) return [];
    return [{
      id: node.id,
      name: node.title.trim() || "未命名文件夹",
      children
    }];
  });
}

function collectBookmarks(nodes, result = []) {
  for (const node of nodes) {
    if (node.url) result.push(node);
    else collectBookmarks(node.children, result);
  }
  return result;
}

function SelectionCheckbox({ indeterminate = false, ...props }) {
  return (
    <input
      ref={(input) => { if (input) input.indeterminate = indeterminate; }}
      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      type="checkbox"
      {...props}
    />
  );
}

function BookmarkTreeNode({
  node,
  expandedIds,
  selectedIds,
  onToggleExpanded,
  onToggleBookmark,
  onToggleFolder
}) {
  if (node.url) {
    return (
      <li>
        <label className={`flex min-w-0 items-start gap-3 rounded-[8px] px-3 py-2.5 text-sm ${node.existing ? "opacity-50" : "cursor-pointer hover:bg-[var(--panel-1)]"}`}>
          <SelectionCheckbox
            checked={node.existing || selectedIds.has(node.id)}
            disabled={node.existing}
            onChange={() => onToggleBookmark(node.id)}
          />
          <SiteIcon url={node.url} className="mt-0.5 h-4 w-4 shrink-0 rounded-sm object-contain" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{node.name}</span>
            <span className="mt-0.5 block truncate text-xs text-ink-muted">
              {node.existing ? `已添加 · ${node.url}` : node.url}
            </span>
          </span>
        </label>
      </li>
    );
  }

  const descendants = collectBookmarks(node.children);
  const selectable = descendants.filter((item) => !item.existing);
  const checked = descendants.every((item) => item.existing || selectedIds.has(item.id));
  const hasSelected = descendants.some((item) => item.existing || selectedIds.has(item.id));
  const expanded = expandedIds.has(node.id);
  const contentId = `bookmark-folder-${node.id}`;

  return (
    <li>
      <div className="flex min-w-0 items-center gap-1 rounded-[8px] hover:bg-[var(--panel-1)]">
        <button
          className="icon-button h-9 w-9 rounded-[8px]"
          type="button"
          aria-label={`${expanded ? "收起" : "展开"}文件夹 ${node.name}`}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => onToggleExpanded(node.id)}
        >
          <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true" />
        </button>
        <label className={`flex min-w-0 flex-1 items-center gap-2 py-2 pr-3 text-sm font-medium ${selectable.length > 0 ? "cursor-pointer" : "opacity-60"}`}>
          <SelectionCheckbox
            checked={checked}
            disabled={selectable.length === 0}
            indeterminate={!checked && hasSelected}
            onChange={() => onToggleFolder(node)}
          />
          {expanded
            ? <FolderOpen className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
            : <Folder className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />}
          <span className="truncate">{node.name}</span>
          <span className="ml-auto shrink-0 text-xs font-normal text-ink-muted">{descendants.length} 项</span>
        </label>
      </div>
      <ul id={contentId} hidden={!expanded} className="m-0 ml-4 list-none space-y-1 border-l border-[color:var(--divider)] p-0 pl-4 max-[480px]:pl-3">
        {node.children.map((child) => (
          <BookmarkTreeNode
            key={child.id}
            node={child}
            expandedIds={expandedIds}
            selectedIds={selectedIds}
            onToggleExpanded={onToggleExpanded}
            onToggleBookmark={onToggleBookmark}
            onToggleFolder={onToggleFolder}
          />
        ))}
      </ul>
    </li>
  );
}

export default function BookmarkImportDialog({ open, shortcuts, onClose, onImport }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    let active = true;

    async function readBookmarks() {
      setLoading(true);
      setBookmarks([]);
      setSelectedIds(new Set());
      setExpandedIds(new Set());
      setError("");
      try {
        if (!globalThis.chrome?.bookmarks?.getTree) throw new Error("unavailable");
        const tree = await globalThis.chrome.bookmarks.getTree();
        const existingUrls = new Set(shortcuts.map((item) => comparableUrl(item.url)));
        const rootNodes = tree.length === 1 && !tree[0].title && tree[0].children
          ? tree[0].children
          : tree;
        const visibleNodes = rootNodes.flatMap((node) => (
          node.id === "1" && node.children ? node.children : [node]
        ));
        const items = normalizeBookmarkNodes(visibleNodes, existingUrls);
        const bookmarkItems = collectBookmarks(items);
        if (!active) return;
        setBookmarks(items);
        setExpandedIds(new Set(items.filter((item) => item.children).map((item) => item.id)));
        setSelectedIds(new Set(bookmarkItems.filter((item) => !item.existing).map((item) => item.id)));
      } catch (reason) {
        if (!active) return;
        setError(reason.message === "unavailable"
          ? "收藏导入仅在 Chrome 扩展中可用，请加载扩展后重试。"
          : "读取收藏夹失败，请确认已允许扩展访问收藏夹。");
      } finally {
        if (active) setLoading(false);
      }
    }

    readBookmarks();
    return () => { active = false; };
  }, [open]);

  const bookmarkItems = collectBookmarks(bookmarks);
  const selectable = bookmarkItems.filter((item) => !item.existing);
  const allSelected = selectable.length > 0 && selectable.every((item) => selectedIds.has(item.id));

  function toggleBookmark(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function toggleFolder(folder) {
    const items = collectBookmarks(folder.children).filter((item) => !item.existing);
    const shouldSelect = items.some((item) => !selectedIds.has(item.id));
    const next = new Set(selectedIds);
    for (const item of items) {
      if (shouldSelect) next.add(item.id);
      else next.delete(item.id);
    }
    setSelectedIds(next);
  }

  function toggleExpanded(id) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(selectable.map((item) => item.id)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const selected = selectable.filter((item) => selectedIds.has(item.id));
    if (selected.length === 0) return;

    setImporting(true);
    setError("");
    try {
      await onImport(selected);
      onClose();
    } catch (importError) {
      setError(storageErrorMessage(importError, "导入失败，请重试。"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="bookmark-import-title"
      className="dialog-enter m-auto max-h-[calc(100dvh_-_32px)] w-[min(calc(100%_-_32px),520px)] max-w-[520px] rounded-[10px]"
    >
      <header className="dialog-header">
        <div>
          <p className="dialog-eyebrow">常用入口</p>
          <h2 id="bookmark-import-title" className="dialog-title">导入浏览器收藏</h2>
        </div>
        <button className="icon-button -mr-2 -mt-1" type="button" aria-label="关闭收藏导入" onClick={onClose}>
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
        <div className="p-6 max-[480px]:p-5">
          {loading && (
            <div className="grid gap-3" aria-label="正在读取收藏夹" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => <div key={index} className="skeleton h-14 rounded-[8px] bg-[var(--panel-1)]" />)}
            </div>
          )}

          {!loading && !error && bookmarkItems.length === 0 && (
            <p className="m-0 py-8 text-center text-sm text-ink-muted">没有找到可导入的网页收藏。</p>
          )}

          {!loading && bookmarkItems.length > 0 && (
            <>
              <div className="mb-3 flex items-center justify-between gap-4 text-[13px] text-ink-muted">
                <span>共 {bookmarkItems.length} 个收藏</span>
                {selectable.length > 0 && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <SelectionCheckbox
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={allSelected}
                      indeterminate={selectedIds.size > 0 && !allSelected}
                      onChange={toggleAll}
                    />
                    全选
                  </label>
                )}
              </div>
              <ul className="m-0 max-h-[min(420px,50dvh)] list-none space-y-1 overflow-y-auto p-0 pr-1">
                {bookmarks.map((node) => (
                  <BookmarkTreeNode
                    key={node.id}
                    node={node}
                    expandedIds={expandedIds}
                    selectedIds={selectedIds}
                    onToggleExpanded={toggleExpanded}
                    onToggleBookmark={toggleBookmark}
                    onToggleFolder={toggleFolder}
                  />
                ))}
              </ul>
            </>
          )}

          <p className="mb-0 mt-4 min-h-5 text-[13px] leading-relaxed text-danger" role="alert">{error}</p>
        </div>
        <footer className="flex items-center justify-between gap-4 border-t border-[color:var(--divider)] p-4 px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
          <span className="text-xs text-ink-muted">已选择 {selectedIds.size} 项</span>
          <div className="flex gap-2">
            <button className="button-secondary" type="button" onClick={onClose}>取消</button>
            <button className="button-primary" type="submit" disabled={importing || loading || selectedIds.size === 0} aria-busy={importing}>
              {importing ? "导入中…" : "导入选中项"}
            </button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
