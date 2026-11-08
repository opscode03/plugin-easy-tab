import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, ExternalLink, FolderInput, Pencil, Plus, Trash2 } from "lucide-react";
import SiteIcon from "./SiteIcon";
import Modal from "./Modal";
import { getOrderedGroups, isGroupNameTaken, normalizeGroupName } from "../data";
import { storageErrorMessage } from "../storage";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// 排序位移与落位过渡统一使用同一段缓动，避免松手出现第二次跳变
const SORT_TRANSITION = { duration: 200, easing: "cubic-bezier(0.22, 1, 0.36, 1)" };
const ACTIVATION_DISTANCE = 5;
const EDGE_BAND = 56;
const MIN_EDGE_SPEED = 2;
const MAX_EDGE_SPEED = 14;
const PAGE_FLIP_MAX_INTERVAL = 1400;
const PAGE_FLIP_MIN_INTERVAL = 900;
const WHEEL_INTERVAL = 360;

function edgeSpeed(depth) {
  const ratio = Math.min(1, Math.max(0, depth / EDGE_BAND));
  return Math.round(MIN_EDGE_SPEED + (MAX_EDGE_SPEED - MIN_EDGE_SPEED) * ratio);
}

// 入口卡片：指针拖拽由 dnd-kit 的 PointerSensor 接管，键盘仍保留链接语义
function SortableEntry({ entry, content, openTarget, isCompact, onContextMenu }) {
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `entry:${entry.id}`,
    transition: SORT_TRANSITION
  });
  return (
    <div
      ref={setNodeRef}
      data-sortable-item
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative min-w-0 rounded-[10px] ${isDragging ? "drag-source" : ""}`}
    >
      <a
        className={`tile-body ${isCompact ? "tile-body-compact" : ""} group drag-handle cursor-grab rounded-[10px] border border-transparent bg-transparent transition-[background-color,border-color] hover:border-[color:var(--line)] hover:bg-[var(--panel-1)]`}
        href={entry.url}
        target={openTarget === "new" ? "_blank" : undefined}
        rel={openTarget === "new" ? "noreferrer" : undefined}
        draggable={false}
        aria-label={`打开${entry.name}`}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={listeners?.onPointerDown}
        onContextMenu={(event) => onContextMenu(event, entry)}
      >
        {content}
      </a>
    </div>
  );
}

// 分组按钮：可排序、可作为入口拖入的落点，Space 启动键盘拖拽，Enter 保持选择语义
function SortableGroupButton({ group, activeGroupId, groupDropTargetId, onSelect, onContextMenu }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `group:${group.id}`,
    transition: SORT_TRANSITION
  });
  const isActive = activeGroupId === group.id;
  const isTarget = groupDropTargetId === group.id;
  return (
    <button
      {...attributes}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative min-h-7 shrink-0 cursor-grab rounded-[8px] px-2.5 text-[12.5px] transition-colors ${isActive ? "bg-[var(--accent-soft)] font-medium text-accent" : "text-ink-muted hover:bg-[var(--panel-1)] hover:text-ink"} ${isDragging ? "drag-source" : ""} ${isTarget ? "bg-[var(--accent-soft)] text-accent outline outline-1 outline-[color:var(--accent)]" : ""}`}
      type="button"
      aria-pressed={isActive}
      aria-label={`${group.name}分组，可拖拽排序、接收入口或右键管理`}
      onClick={() => onSelect(group.id)}
      onContextMenu={(event) => onContextMenu(event, group)}
      onPointerDown={(event) => listeners?.onPointerDown?.(event)}
      onKeyDown={(event) => {
        if (event.key === "ContextMenu" || event.key === "F10") {
          event.preventDefault();
          onContextMenu(event, group);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          onSelect(group.id);
          return;
        }
        listeners?.onKeyDown?.(event);
      }}
    >
      {group.name}
    </button>
  );
}

function ShortcutContent({ url, mark, name, density, isAdd = false }) {
  const isCompact = density === "compact";
  return (
    <>
      <span className={`tile-icon ${isCompact ? "tile-icon-compact" : ""} text-[15px] font-semibold tracking-[-0.02em] ${isAdd ? "text-ink-faint group-hover:text-ink" : "text-ink"}`}>
        {isAdd ? mark : (
          <SiteIcon
            url={url}
            size={64}
            className="tile-glyph"
            fallback={mark}
          />
        )}
      </span>
      <span className="tile-name">{name}</span>
    </>
  );
}

export default function Shortcuts({
  shortcuts,
  groups,
  groupOrder,
  showAllGroup,
  restoreLastGroup,
  lastGroupId,
  rows,
  density,
  openTarget,
  loading,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  onAddGroup,
  onRenameGroup,
  onDeleteGroup,
  onReorderGroups,
  onMoveShortcut,
  onGroupSelect
}) {
  const [columns, setColumns] = useState(() => window.matchMedia("(min-width: 640px)").matches ? 8 : 3);
  const [activeGroupId, setActiveGroupId] = useState("all");
  const [groupDropTargetId, setGroupDropTargetId] = useState(null);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupError, setGroupError] = useState("");
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [renamingGroupId, setRenamingGroupId] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [renameError, setRenameError] = useState("");
  const [isRenamingGroup, setIsRenamingGroup] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState(null);
  const [deleteGroupError, setDeleteGroupError] = useState("");
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [menu, setMenu] = useState(null);
  const currentPageRef = useRef(0);
  const scrollerRef = useRef(null);
  const verticalRef = useRef(null);
  const groupBarRef = useRef(null);
  const menuRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const swipeRef = useRef(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef(null);
  const groupInputRef = useRef(null);
  const renameInputRef = useRef(null);
  const pointerRef = useRef(null);
  const pageFlipAtRef = useRef(0);
  const wheelAtRef = useRef(-WHEEL_INTERVAL);
  const wheelHandlerRef = useRef(null);
  const pendingGroupPageRef = useRef(null);
  const didRestoreGroupRef = useRef(false);
  const [activeDrag, setActiveDrag] = useState(null);
  // 浮层缩放围绕抓取点，保证拖拽全程该点相对元素与指针都不变
  const [overlayOrigin, setOverlayOrigin] = useState(null);
  // 松手瞬间先本地落位，持久化完成后再由 props 接管，避免异步保存造成第二次跳变
  const [pendingEntries, setPendingEntries] = useState(null);
  const [pendingGroups, setPendingGroups] = useState(null);
  const isCompact = density === "compact";
  const visibleShortcuts = activeGroupId === "all"
    ? shortcuts
    : activeGroupId
      ? shortcuts.filter((shortcut) => shortcut.groupId === activeGroupId)
      : [];
  const orderedEntries = pendingEntries || visibleShortcuts;
  const orderedGroups = pendingGroups || getOrderedGroups(groups, groupOrder, showAllGroup);
  const entries = [...orderedEntries, { id: "add", isAdd: true }];
  const pageSize = rows * columns;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const pages = Array.from({ length: pageCount }, (_, index) => entries.slice(index * pageSize, (index + 1) * pageSize));
  const entryIds = orderedEntries.map((entry) => `entry:${entry.id}`);
  const groupIds = orderedGroups.map((group) => `group:${group.id}`);
  // 指针与触屏共用 PointerSensor；分组保留键盘拖拽
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const activeEntry = activeDrag?.type === "entry" ? shortcuts.find((item) => item.id === activeDrag.id) : null;
  const activeGroup = activeDrag?.type === "group" ? orderedGroups.find((item) => item.id === activeDrag.id) : null;
  const isEntryDragging = activeDrag?.type === "entry";
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const handleMediaChange = () => setColumns(media.matches ? 8 : 3);
    handleMediaChange();
    media.addEventListener("change", handleMediaChange);
    return () => {
      media.removeEventListener("change", handleMediaChange);
      window.clearTimeout(suppressClickTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isAddingGroup) groupInputRef.current?.focus();
  }, [isAddingGroup]);

  useEffect(() => {
    if (renamingGroupId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingGroupId]);

  useEffect(() => {
    if (loading) return;
    const availableIds = getOrderedGroups(groups, groupOrder, showAllGroup).map((group) => group.id);
    const fallbackGroupId = availableIds.includes("all") ? "all" : availableIds[0] || null;
    const restoredGroupId = restoreLastGroup && availableIds.includes(lastGroupId) ? lastGroupId : fallbackGroupId;
    setActiveGroupId((current) => {
      if (!didRestoreGroupRef.current) {
        didRestoreGroupRef.current = true;
        return restoredGroupId;
      }
      return availableIds.includes(current) ? current : fallbackGroupId;
    });
  }, [loading, groups, groupOrder, showAllGroup, restoreLastGroup, lastGroupId]);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const node = menuRef.current;
    const rect = node.getBoundingClientRect();
    const left = Math.max(8, Math.min(menu.left, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(menu.top, window.innerHeight - rect.height - 8));
    if (left !== menu.left || top !== menu.top) {
      setMenu((current) => current ? { ...current, left, top } : null);
    }
  }, [menu]);

  useLayoutEffect(() => {
    if (menu) menuRef.current?.querySelector("[role='menuitem']")?.focus();
  }, [menu?.entry, menu?.group]);

  useEffect(() => {
    if (!menu) return;

    function handleOutsidePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) setMenu(null);
    }

    function handleEscape(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMenu(null);
      menuTriggerRef.current?.focus();
    }

    function handleMenuClose() {
      setMenu(null);
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleMenuClose);
    window.addEventListener("scroll", handleMenuClose, true);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleMenuClose);
      window.removeEventListener("scroll", handleMenuClose, true);
    };
  }, [menu]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const pendingPage = pendingGroupPageRef.current?.groupId === activeGroupId
      ? pendingGroupPageRef.current.page
      : currentPageRef.current;
    const nextPage = Math.min(pendingPage, pageCount - 1);
    pendingGroupPageRef.current = null;
    currentPageRef.current = nextPage;
    scroller.scrollTo({ left: nextPage * scroller.clientWidth, behavior: "instant" });
  }, [activeGroupId, columns, loading, pageCount]);

  useEffect(() => {
    const wheelArea = verticalRef.current;
    if (!wheelArea || loading) return;
    const listener = (event) => wheelHandlerRef.current?.(event);
    wheelArea.addEventListener("wheel", listener, { passive: false });
    return () => wheelArea.removeEventListener("wheel", listener);
  }, [loading]);

  // 拖拽期间逐帧检测边缘：入口区上下滚动 + 多页翻页，分组条左右滚动
  useEffect(() => {
    if (!activeDrag) return;
    let frame = 0;
    const step = () => {
      frame = window.requestAnimationFrame(step);
      const pointer = pointerRef.current;
      if (!pointer) return;
      if (activeDrag.type === "entry") {
        const scrollNode = verticalRef.current;
        if (scrollNode) {
          const rect = scrollNode.getBoundingClientRect();
          const depthTop = rect.top + EDGE_BAND - pointer.y;
          const depthBottom = pointer.y - (rect.bottom - EDGE_BAND);
          const depth = Math.max(depthTop, depthBottom);
          if (depth > 0) {
            const speed = edgeSpeed(depth);
            scrollNode.scrollTop += depthTop > 0 ? -speed : speed;
          }
        }
        if (pageCount > 1) {
          const scroller = scrollerRef.current;
          if (scroller) {
            const rect = scroller.getBoundingClientRect();
            const depthLeft = rect.left + EDGE_BAND - pointer.x;
            const depthRight = pointer.x - (rect.right - EDGE_BAND);
            const direction = depthLeft > 0 ? -1 : depthRight > 0 ? 1 : 0;
            if (direction) flipPage(direction, Math.max(depthLeft, depthRight));
          }
        }
        return;
      }
      const bar = groupBarRef.current;
      if (!bar) return;
      const rect = bar.getBoundingClientRect();
      const depthLeft = rect.left + EDGE_BAND - pointer.x;
      const depthRight = pointer.x - (rect.right - EDGE_BAND);
      const depth = Math.max(depthLeft, depthRight);
      if (depth <= 0) return;
      const speed = edgeSpeed(depth);
      bar.scrollLeft += depthLeft > 0 ? -speed : speed;
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [activeDrag, pageCount]);

  function flipPage(direction, depth) {
    const scroller = scrollerRef.current;
    if (!scroller || !scroller.clientWidth) return;
    const now = window.performance.now();
    const interval = PAGE_FLIP_MAX_INTERVAL
      - (PAGE_FLIP_MAX_INTERVAL - PAGE_FLIP_MIN_INTERVAL) * Math.min(1, depth / EDGE_BAND);
    if (now - pageFlipAtRef.current < interval) return;
    const next = Math.min(pageCount - 1, Math.max(0, currentPageRef.current + direction));
    if (next === currentPageRef.current) return;
    pageFlipAtRef.current = now;
    currentPageRef.current = next;
    scroller.scrollTo({ left: next * scroller.clientWidth, behavior: "instant" });
  }

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || !scroller.clientWidth) return;
    currentPageRef.current = Math.round(scroller.scrollLeft / scroller.clientWidth);
  }

  function handlePageChange(page) {
    const nextPage = Math.min(pageCount - 1, Math.max(0, page));
    currentPageRef.current = nextPage;
    scrollerRef.current?.scrollTo({ left: nextPage * scrollerRef.current.clientWidth });
  }

  function getPageCountForGroup(groupId) {
    const count = groupId === "all"
      ? shortcuts.length
      : groupId
        ? shortcuts.filter((shortcut) => shortcut.groupId === groupId).length
        : 0;
    return Math.max(1, Math.ceil((count + 1) / (rows * columns)));
  }

  function handleWheel(event) {
    if (event.ctrlKey || activeDrag) return;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) return;
    event.preventDefault();
    const now = window.performance.now();
    if (now - wheelAtRef.current < WHEEL_INTERVAL) return;
    wheelAtRef.current = now;

    const direction = delta > 0 ? 1 : -1;
    const nextPage = currentPageRef.current + direction;
    if (nextPage >= 0 && nextPage < pageCount) {
      handlePageChange(nextPage);
      return;
    }
    if (!orderedGroups.length) return;

    const currentIndex = orderedGroups.findIndex((group) => group.id === activeGroupId);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + direction + orderedGroups.length) % orderedGroups.length;
    const nextGroupId = orderedGroups[nextIndex].id;
    if (nextGroupId === activeGroupId) {
      handlePageChange(direction > 0 ? 0 : pageCount - 1);
      return;
    }
    handleGroupSelect(nextGroupId, direction < 0 ? getPageCountForGroup(nextGroupId) - 1 : 0);
  }

  function handlePointerDown(event) {
    if (event.target instanceof Element && event.target.closest("[data-sortable-item]")) return;
    if (pageCount < 2 || (event.pointerType === "mouse" && event.button !== 0)) return;
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickRef.current = false;
    swipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false
    };
  }

  function handlePointerMove(event) {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId || swipe.active) return;
    const distanceX = event.clientX - swipe.startX;
    const distanceY = event.clientY - swipe.startY;
    if (Math.abs(distanceX) < 8 || Math.abs(distanceX) <= Math.abs(distanceY)) return;
    swipe.active = true;
    scrollerRef.current?.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event) {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;
    swipeRef.current = null;
    const scroller = scrollerRef.current;
    if (scroller?.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
    if (!swipe.active) return;

    const distanceX = event.clientX - swipe.startX;
    const distanceY = event.clientY - swipe.startY;
    if (Math.abs(distanceX) >= 48 && Math.abs(distanceX) > Math.abs(distanceY)) {
      handlePageChange(currentPageRef.current + (distanceX < 0 ? 1 : -1));
    }

    suppressClickRef.current = true;
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function handlePointerCancel() {
    swipeRef.current = null;
  }

  function handleClickCapture(event) {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }

  function handleContextMenu(event, entry) {
    event.preventDefault();
    menuTriggerRef.current = event.currentTarget;
    setMenu({ kind: "shortcut", entry, left: event.clientX, top: event.clientY, showGroups: false, groupTop: 0 });
  }

  function handleGroupContextMenu(event, group) {
    event.preventDefault();
    menuTriggerRef.current = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    const hasPoint = event.clientX > 0 || event.clientY > 0;
    setMenu({
      kind: "group",
      group,
      left: hasPoint ? event.clientX : rect.left,
      top: hasPoint ? event.clientY : rect.bottom
    });
  }

  function startGroupRename(group) {
    setMenu(null);
    setRenamingGroupId(group.id);
    setRenameName(group.name);
    setRenameError("");
  }

  function cancelGroupRename() {
    setRenamingGroupId(null);
    setRenameName("");
    setRenameError("");
  }

  async function handleRenameGroupSubmit(event, group) {
    event.preventDefault();
    const name = normalizeGroupName(renameName);
    if (!name) {
      setRenameError("请输入分组名称。");
      renameInputRef.current?.focus();
      return;
    }
    if (isGroupNameTaken(groups, name, group.id)) {
      setRenameError("分组名称已存在。");
      renameInputRef.current?.focus();
      return;
    }

    setIsRenamingGroup(true);
    setRenameError("");
    try {
      await onRenameGroup(group.id, name);
      cancelGroupRename();
    } catch (error) {
      setRenameError(error?.message === "group-name-taken" ? "分组名称已存在。" : storageErrorMessage(error, "分组保存失败，请重试。"));
    } finally {
      setIsRenamingGroup(false);
    }
  }

  function requestDeleteGroup(group) {
    setMenu(null);
    setDeleteGroupError("");
    setDeleteGroupTarget(group);
  }

  async function handleDeleteGroupConfirm() {
    if (!deleteGroupTarget) return;
    setIsDeletingGroup(true);
    setDeleteGroupError("");
    try {
      const remainingGroups = orderedGroups.filter((group) => group.id !== deleteGroupTarget.id);
      const fallbackGroupId = deleteGroupTarget.id !== "all" && showAllGroup
        ? "all"
        : remainingGroups[0]?.id || null;
      await onDeleteGroup(deleteGroupTarget.id);
      if (activeGroupId === deleteGroupTarget.id) handleGroupSelect(fallbackGroupId);
      setDeleteGroupTarget(null);
    } catch (error) {
      setDeleteGroupError(storageErrorMessage(error, "删除分组失败，请重试。"));
    } finally {
      setIsDeletingGroup(false);
    }
  }

  function handleMenuKeyDown(event) {
    if (event.key === "Tab") {
      setMenu(null);
      return;
    }

    const activeItem = document.activeElement;
    if (event.key === "ArrowRight" && activeItem?.hasAttribute("data-group-trigger")) {
      event.preventDefault();
      const groupTop = activeItem.getBoundingClientRect().top - menuRef.current.getBoundingClientRect().top;
      setMenu((current) => current ? { ...current, showGroups: true, groupTop } : null);
      window.requestAnimationFrame(() => menuRef.current?.querySelector("[data-group-menu] [role='menuitem']")?.focus());
      return;
    }
    if (event.key === "ArrowLeft" && activeItem?.closest("[data-group-menu]")) {
      event.preventDefault();
      setMenu((current) => current ? { ...current, showGroups: false } : null);
      window.requestAnimationFrame(() => menuRef.current?.querySelector("[data-group-trigger]")?.focus());
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentMenu = activeItem?.closest("[role='menu']");
    const items = Array.from(currentMenu?.querySelectorAll("[role='menuitem']") || []);
    if (!items.length) return;
    const currentIndex = items.indexOf(activeItem);
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  function handleSortStart(event) {
    const activeId = String(event.active.id);
    setActiveDrag({ type: activeId.startsWith("entry:") ? "entry" : "group", id: activeId.slice(6) });
    document.documentElement.classList.add("is-dragging");
    setMenu(null);
    setGroupDropTargetId(null);
    swipeRef.current = null;
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickRef.current = false;
    pageFlipAtRef.current = window.performance.now();
    const activator = event.activatorEvent;
    const target = activator?.target instanceof Element
      ? activator.target.closest("[data-sortable-item], [aria-label*='可拖拽排序']")
      : null;
    const originRect = target ? target.getBoundingClientRect() : null;
    setOverlayOrigin(
      originRect && typeof activator.clientX === "number"
        ? { x: activator.clientX - originRect.left, y: activator.clientY - originRect.top }
        : null
    );
    pointerRef.current = activator && typeof activator.clientX === "number"
      ? { x: activator.clientX, y: activator.clientY }
      : null;
  }

  function handleSortMove(event) {
    const activator = event.activatorEvent;
    if (!activator || typeof activator.clientX !== "number") return;
    pointerRef.current = { x: activator.clientX + event.delta.x, y: activator.clientY + event.delta.y };
  }

  // 预览位移由 dnd-kit 的排序策略负责，这里只记录“入口拖到分组”的落点高亮
  function handleSortOver(event) {
    const { active, over } = event;
    const activeId = String(active.id);
    const overId = over ? String(over.id) : "";
    const target = activeId.startsWith("entry:") && overId.startsWith("group:") ? overId.slice(6) : null;
    setGroupDropTargetId((current) => (current === target ? current : target));
  }

  async function handleSortEnd(event) {
    const { active, over } = event;
    const activeId = String(active.id);
    document.documentElement.classList.remove("is-dragging");
    setActiveDrag(null);
    pointerRef.current = null;
    setOverlayOrigin(null);
    setGroupDropTargetId(null);

    const overId = over ? String(over.id) : "";
    if (!overId || overId === activeId) return;

    suppressClickRef.current = true;
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);

    if (activeId.startsWith("entry:") && overId.startsWith("entry:")) {
      const from = orderedEntries.findIndex((item) => item.id === activeId.slice(6));
      const to = orderedEntries.findIndex((item) => item.id === overId.slice(6));
      if (from >= 0 && to >= 0 && from !== to) setPendingEntries(arrayMove(orderedEntries, from, to));
      await onReorder(activeId.slice(6), overId.slice(6));
    } else if (activeId.startsWith("entry:") && overId.startsWith("group:")) {
      setPendingEntries(orderedEntries.filter((item) => item.id !== activeId.slice(6)));
      await onMoveShortcut(activeId.slice(6), overId.slice(6));
    } else if (activeId.startsWith("group:") && overId.startsWith("group:")) {
      const from = orderedGroups.findIndex((item) => item.id === activeId.slice(6));
      const to = orderedGroups.findIndex((item) => item.id === overId.slice(6));
      if (from >= 0 && to >= 0 && from !== to) setPendingGroups(arrayMove(orderedGroups, from, to));
      await onReorderGroups(activeId.slice(6), overId.slice(6));
    }
    setPendingEntries(null);
    setPendingGroups(null);
  }

  function handleSortCancel() {
    document.documentElement.classList.remove("is-dragging");
    setActiveDrag(null);
    pointerRef.current = null;
    setOverlayOrigin(null);
    setGroupDropTargetId(null);
  }

  function handleGroupSelect(groupId, page = 0) {
    setGroupDropTargetId(null);
    setMenu(null);
    const nextPage = Math.min(getPageCountForGroup(groupId) - 1, Math.max(0, page));
    if (groupId === activeGroupId) {
      pendingGroupPageRef.current = null;
      handlePageChange(nextPage);
    } else {
      pendingGroupPageRef.current = { groupId, page: nextPage };
      currentPageRef.current = nextPage;
      setActiveGroupId(groupId);
    }
    onGroupSelect(groupId);
  }

  async function handleAddGroupSubmit(event) {
    event.preventDefault();
    const name = normalizeGroupName(groupName);
    if (!name) {
      setGroupError("请输入分组名称。");
      groupInputRef.current?.focus();
      return;
    }
    if (isGroupNameTaken(groups, name)) {
      setGroupError("分组名称已存在。");
      groupInputRef.current?.focus();
      return;
    }

    setIsSavingGroup(true);
    setGroupError("");
    try {
      const groupId = await onAddGroup(name);
      setGroupName("");
      setIsAddingGroup(false);
      handleGroupSelect(groupId);
    } catch (error) {
      setGroupError(error?.message === "group-name-taken" ? "分组名称已存在。" : storageErrorMessage(error, "分组保存失败，请重试。"));
    } finally {
      setIsSavingGroup(false);
    }
  }

  wheelHandlerRef.current = handleWheel;

  return (
    <section className={`reveal ${isCompact ? "mt-3 max-[480px]:mt-2" : "mt-4 max-[480px]:mt-3"} flex min-h-0 flex-1 flex-col [animation-delay:220ms]`} aria-labelledby="shortcuts-title">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleSortStart}
        onDragMove={handleSortMove}
        onDragOver={handleSortOver}
        onDragEnd={handleSortEnd}
        onDragCancel={handleSortCancel}
      >
      <div className="mb-3 shrink-0">
        <div
          ref={groupBarRef}
          className={`flex items-center gap-1 overflow-x-auto rounded-[8px] p-1 transition-colors [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${isEntryDragging ? "outline outline-1 outline-[color:var(--line)]" : ""}`}
          role="group"
          aria-label="入口分组"
        >
          <SortableContext items={groupIds} strategy={rectSortingStrategy}>
          {orderedGroups.map((group) => (
            renamingGroupId === group.id ? (
              <form
                key={group.id}
                className="flex shrink-0 items-center gap-1"
                onSubmit={(event) => handleRenameGroupSubmit(event, group)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  cancelGroupRename();
                }}
              >
                <input
                  ref={renameInputRef}
                  className="h-7 w-24 rounded-[6px] border border-[color:var(--line)] bg-[var(--panel-2)] px-2 text-[12px] text-ink outline-none placeholder:text-ink-faint focus:border-[color:var(--accent)] aria-[invalid=true]:border-danger"
                  type="text"
                  maxLength={12}
                  value={renameName}
                  aria-label="重命名分组"
                  aria-invalid={Boolean(renameError)}
                  aria-describedby="group-rename-error"
                  disabled={isRenamingGroup}
                  onChange={(event) => {
                    setRenameName(event.target.value);
                    setRenameError("");
                  }}
                />
                <button className="min-h-7 rounded-[6px] px-2 text-[12px] font-medium text-ink transition-colors hover:bg-[var(--panel-1)] disabled:opacity-50" type="submit" disabled={isRenamingGroup}>
                  {isRenamingGroup ? "保存中…" : "确定"}
                </button>
                <button className="min-h-7 rounded-[6px] px-2 text-[12px] text-ink-muted transition-colors hover:bg-[var(--panel-1)] hover:text-ink" type="button" disabled={isRenamingGroup} onClick={cancelGroupRename}>
                  取消
                </button>
              </form>
            ) : (
              <SortableGroupButton
                key={group.id}
                group={group}
                activeGroupId={activeGroupId}
                groupDropTargetId={groupDropTargetId}
                onSelect={handleGroupSelect}
                onContextMenu={handleGroupContextMenu}
              />
            )
          ))}
          </SortableContext>
          {isAddingGroup ? (
            <form
              className="flex shrink-0 items-center gap-1"
              onSubmit={handleAddGroupSubmit}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                setIsAddingGroup(false);
                setGroupName("");
                setGroupError("");
              }}
            >
              <input
                ref={groupInputRef}
                className="h-7 w-24 rounded-[6px] border border-[color:var(--line)] bg-[var(--panel-2)] px-2 text-[12px] text-ink outline-none placeholder:text-ink-faint focus:border-[color:var(--accent)] aria-[invalid=true]:border-danger"
                type="text"
                maxLength={12}
                placeholder="分组名称"
                aria-label="分组名称"
                aria-invalid={Boolean(groupError)}
                disabled={isSavingGroup}
                value={groupName}
                onChange={(event) => {
                  setGroupName(event.target.value);
                  setGroupError("");
                }}
              />
              <button className="min-h-7 rounded-[6px] px-2 text-[12px] font-medium text-ink transition-colors hover:bg-[var(--panel-1)] disabled:opacity-50" type="submit" disabled={isSavingGroup}>
                {isSavingGroup ? "保存中…" : "确定"}
              </button>
              <button
                className="min-h-7 rounded-[6px] px-2 text-[12px] text-ink-muted transition-colors hover:bg-[var(--panel-1)] hover:text-ink"
                type="button"
                disabled={isSavingGroup}
                onClick={() => {
                  setIsAddingGroup(false);
                  setGroupName("");
                  setGroupError("");
                }}
              >
                取消
              </button>
            </form>
          ) : (
            <button
              className="flex min-h-7 shrink-0 items-center gap-1 rounded-[8px] px-2 text-[12px] text-ink-muted transition-colors hover:bg-[var(--panel-1)] hover:text-ink"
              type="button"
              onClick={() => setIsAddingGroup(true)}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
              <span>新增分组</span>
            </button>
          )}
        </div>
      </div>
      {groupError && <p className="mb-3 text-left text-xs leading-relaxed text-danger" role="alert">{groupError}</p>}
      {renameError && <p id="group-rename-error" className="mb-3 text-left text-xs leading-relaxed text-danger" role="alert">{renameError}</p>}

      <div ref={verticalRef} data-drag-scroll className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-8" aria-busy="true">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="skeleton flex flex-col items-center gap-2" aria-hidden="true">
                <span className="tile-icon" />
                <span className="h-2.5 w-12 rounded-[4px] bg-[var(--panel-1)]" />
              </div>
            ))}
          </div>
        ) : (
        <>
          <div
            ref={scrollerRef}
            className="flex snap-x snap-mandatory select-none overflow-x-auto motion-safe:scroll-smooth [scrollbar-width:none] [touch-action:pan-y_pinch-zoom] [&::-webkit-scrollbar]:hidden"
            role="region"
            aria-label="常用入口分页"
            aria-roledescription="轮播图"
            onScroll={handleScroll}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClickCapture={handleClickCapture}
          >
            <SortableContext items={entryIds} strategy={rectSortingStrategy}>
            {pages.map((page, pageIndex) => (
              <div
                key={pageIndex}
                className="grid w-full shrink-0 snap-start grid-cols-3 content-start gap-x-3 gap-y-2 pt-2 px-1.5 pb-1 sm:grid-cols-8"
                role="group"
                aria-label={`第 ${pageIndex + 1} 页，共 ${pageCount} 页`}
              >

                {page.map((entry) => {
                  if (entry.isAdd) {
                    return (
                      <button
                        key={entry.id}
                        className={`tile-body ${isCompact ? "tile-body-compact" : ""} group rounded-[10px] border border-dashed border-[color:var(--line)] bg-transparent transition-[background-color,border-color] hover:bg-[var(--panel-1)] hover:border-[color:var(--text-faint)]`}
                        type="button"
                        aria-label="添加常用入口"
                        onClick={onAdd}
                      >
                        <ShortcutContent density={density} isAdd name="添加" mark={<Plus className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />} />
                      </button>
                    );
                  }

                  return (
                    <SortableEntry
                      key={entry.id}
                      entry={entry}
                      openTarget={openTarget}
                      isCompact={isCompact}
                      onContextMenu={handleContextMenu}
                      content={<ShortcutContent url={entry.url} mark={entry.mark} name={entry.name} density={density} />}
                    />
                  );
                })}
              </div>
            ))}
            </SortableContext>
          </div>
        </>
      )}
      </div>

      {menu && createPortal(
        <div
          ref={menuRef}
          className="select-enter fixed z-[400] flex items-start gap-1 text-ink"
          style={{ left: menu.left, top: menu.top }}
          onKeyDown={handleMenuKeyDown}
          onContextMenu={(event) => event.preventDefault()}
        >
          {menu.kind === "group" ? (
            <div className="w-40 rounded-[8px] border border-[color:var(--line)] bg-[var(--menu-bg)] p-1" role="menu" aria-label={`${menu.group.name}分组操作`}>
              {menu.group.id !== "all" && (
                <button
                  className="flex min-h-9 w-full items-center gap-2.5 rounded-[6px] px-3 text-left text-[13px] text-ink-muted transition-colors hover:bg-[var(--panel-2)] hover:text-ink focus-visible:bg-[var(--panel-2)] focus-visible:text-ink"
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => startGroupRename(menu.group)}
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                  <span>重命名</span>
                </button>
              )}
              <button
                className="flex min-h-9 w-full items-center gap-2.5 rounded-[6px] px-3 text-left text-[13px] text-danger transition-colors hover:bg-[var(--panel-2)] focus-visible:bg-[var(--panel-2)]"
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => requestDeleteGroup(menu.group)}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                <span>删除分组</span>
              </button>
            </div>
          ) : (
          <>
          <div className="w-36 rounded-[8px] border border-[color:var(--line)] bg-[var(--menu-bg)] p-1" role="menu" aria-label={`${menu.entry.name}操作`}>
            <a
              className="flex min-h-9 items-center gap-2.5 rounded-[6px] px-3 text-[13px] text-ink-muted transition-colors hover:bg-[var(--panel-2)] hover:text-ink focus-visible:bg-[var(--panel-2)] focus-visible:text-ink"
              href={menu.entry.url}
              target={openTarget === "new" ? "_blank" : undefined}
              rel={openTarget === "new" ? "noreferrer" : undefined}
              role="menuitem"
              tabIndex={-1}
              onClick={() => setMenu(null)}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
              <span>打开</span>
            </a>
            <button
              className="flex min-h-9 w-full items-center gap-2.5 rounded-[6px] px-3 text-left text-[13px] text-ink-muted transition-colors hover:bg-[var(--panel-2)] hover:text-ink focus-visible:bg-[var(--panel-2)] focus-visible:text-ink"
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setMenu(null);
                onEdit(menu.entry);
              }}
            >
              <Pencil className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
              <span>编辑</span>
            </button>
            <button
              className="flex min-h-9 w-full items-center gap-2.5 rounded-[6px] px-3 text-left text-[13px] text-ink-muted transition-colors hover:bg-[var(--panel-2)] hover:text-ink focus-visible:bg-[var(--panel-2)] focus-visible:text-ink"
              type="button"
              role="menuitem"
              tabIndex={-1}
              data-group-trigger
              aria-haspopup="menu"
              aria-expanded={menu.showGroups}
              onMouseEnter={(event) => {
                const groupTop = event.currentTarget.getBoundingClientRect().top - menuRef.current.getBoundingClientRect().top;
                setMenu((current) => current ? { ...current, showGroups: !current.showGroups, groupTop } : null);
              }}
              onClick={(event) => {
                const groupTop = event.currentTarget.getBoundingClientRect().top - menuRef.current.getBoundingClientRect().top;
                setMenu((current) => current ? { ...current, showGroups: !current.showGroups, groupTop } : null);
              }}
            >
              <FolderInput className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
              <span>移动分组</span>
              <ChevronRight className="ml-auto h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
            </button>
            <button
              className="flex min-h-9 w-full items-center gap-2.5 rounded-[6px] px-3 text-left text-[13px] text-danger transition-colors hover:bg-[var(--panel-2)] focus-visible:bg-[var(--panel-2)]"
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setMenu(null);
                onDelete(menu.entry.id);
              }}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
              <span>删除</span>
            </button>
          </div>

          {menu.showGroups && (
            <div
              className="w-44 self-start rounded-[8px] border border-[color:var(--line)] bg-[var(--menu-bg)] p-1"
              style={{ marginTop: menu.groupTop }}
              role="menu"
              aria-label={`移动${menu.entry.name}到分组`}
              data-group-menu
            >
              <div className="max-h-64 overflow-y-auto">
                <button
                  className="flex min-h-9 w-full items-center justify-between gap-2 rounded-[6px] px-3 text-left text-[13px] text-ink-muted transition-colors hover:bg-[var(--panel-2)] hover:text-ink focus-visible:bg-[var(--panel-2)] focus-visible:text-ink"
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    setMenu(null);
                    onMoveShortcut(menu.entry.id, null);
                  }}
                >
                  <span>移出分组</span>
                  {!menu.entry.groupId && <Check className="h-4 w-4 text-accent" strokeWidth={1.8} aria-label="当前分组" />}
                </button>
                {groups.map((group) => (
                  <button
                    key={group.id}
                    className="flex min-h-9 w-full items-center justify-between gap-2 rounded-[6px] px-3 text-left text-[13px] text-ink-muted transition-colors hover:bg-[var(--panel-2)] hover:text-ink focus-visible:bg-[var(--panel-2)] focus-visible:text-ink"
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      setMenu(null);
                      onMoveShortcut(menu.entry.id, group.id);
                    }}
                  >
                    <span className="truncate">{group.name}</span>
                    {menu.entry.groupId === group.id && <Check className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.8} aria-label="当前分组" />}
                  </button>
                ))}
              </div>
            </div>
          )}
          </>
          )}
        </div>,
        document.body
      )}

      <Modal
        open={Boolean(deleteGroupTarget)}
        onClose={() => {
          if (isDeletingGroup) return;
          setDeleteGroupTarget(null);
          setDeleteGroupError("");
        }}
        labelledBy="delete-group-title"
        className="dialog-enter m-auto w-[min(calc(100%_-_32px),340px)] max-w-[340px] rounded-[10px]"
      >
        <div className="px-4 pb-3 pt-4">
          <h2 id="delete-group-title" className="m-0 break-words text-[15px] font-medium leading-6 text-ink">
            删除分组「{deleteGroupTarget?.name}」？
          </h2>
          <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-ink-muted">
            {deleteGroupTarget?.id === "all"
              ? "只移除「全部」分组，所有常用入口都会保留。"
              : `其中的 ${deleteGroupTarget ? shortcuts.filter((item) => item.groupId === deleteGroupTarget.id).length : 0} 个入口会退出分组${showAllGroup ? "并回到「全部」" : ""}，入口本身不会被删除。`}
          </p>
          {deleteGroupError && (
            <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-danger" role="alert">{deleteGroupError}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            className="button-secondary"
            type="button"
            disabled={isDeletingGroup}
            onClick={() => {
              setDeleteGroupTarget(null);
              setDeleteGroupError("");
            }}
          >
            取消
          </button>
          <button
            className="button bg-[var(--danger)] text-[var(--accent-ink)] hover:opacity-95"
            type="button"
            disabled={isDeletingGroup}
            aria-busy={isDeletingGroup}
            onClick={handleDeleteGroupConfirm}
          >
            {isDeletingGroup ? "删除中…" : "删除"}
          </button>
        </div>
      </Modal>

      {/* 渲染到 body：祖先的 reveal 动画 transform 会成为 fixed 元素的包含块，导致浮层整体偏移 */}
      {createPortal(
        <DragOverlay dropAnimation={prefersReducedMotion ? null : SORT_TRANSITION}>
          {activeEntry ? (
            <div id={`entry:${activeEntry.id}`} className="drag-overlay h-full w-full" style={overlayOrigin ? { transformOrigin: `${overlayOrigin.x}px ${overlayOrigin.y}px` } : undefined}>
              <div className={`tile-body ${isCompact ? "tile-body-compact" : ""} rounded-[10px] border border-[color:var(--line)] bg-[var(--canvas)]`}>
                <ShortcutContent url={activeEntry.url} mark={activeEntry.mark} name={activeEntry.name} density={density} />
              </div>
            </div>
          ) : activeGroup ? (
            <div id={`group:${activeGroup.id}`} className="drag-overlay flex h-full w-full items-center justify-center rounded-[8px] border border-[color:var(--line)] bg-[var(--canvas)] px-2.5 text-[12.5px] font-medium text-accent" style={overlayOrigin ? { transformOrigin: `${overlayOrigin.x}px ${overlayOrigin.y}px` } : undefined}>
              {activeGroup.name}
            </div>
          ) : null}
        </DragOverlay>,
        document.body
      )}
      </DndContext>
    </section>
  );
}
