import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookmarkPlus, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import SiteIcon from "./SiteIcon";

function ShortcutContent({ url, mark, name, density, isAdd = false }) {
  const isCompact = density === "compact";
  return (
    <>
      <span className={`grid ${isCompact ? "h-11 w-11 rounded-xl" : "h-[52px] w-[52px] rounded-2xl"} place-items-center border text-[15px] font-semibold tracking-[-0.02em] transition-colors ${isAdd ? "border-dashed border-line text-ink-muted group-hover:border-sage group-hover:text-sage" : "border-line bg-surface text-sage group-hover:border-sage"}`}>
        {isAdd ? mark : (
          <SiteIcon
            url={url}
            size={64}
            className={`${isCompact ? "h-6 w-6" : "h-7 w-7"} object-contain`}
            fallback={mark}
          />
        )}
      </span>
      <span className="max-w-full truncate text-[13px] text-ink-muted transition-colors group-hover:text-ink">{name}</span>
    </>
  );
}

export default function Shortcuts({
  shortcuts,
  rows,
  density,
  openTarget,
  loading,
  onAdd,
  onEdit,
  onDelete,
  onImport,
  onReorder
}) {
  const [columns, setColumns] = useState(() => window.matchMedia("(min-width: 640px)").matches ? 8 : 3);
  const [draggingId, setDraggingId] = useState(null);
  const [dragItems, setDragItems] = useState(null);
  const [menu, setMenu] = useState(null);
  const currentPageRef = useRef(0);
  const scrollerRef = useRef(null);
  const menuRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const swipeRef = useRef(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef(null);
  const dragItemsRef = useRef(null);
  const dragTargetRef = useRef(null);
  const isDroppingRef = useRef(false);
  const itemRefs = useRef(new Map());
  const pendingPositionsRef = useRef(null);
  const isCompact = density === "compact";
  const entries = [...(dragItems || shortcuts), { id: "add", isAdd: true }];
  const pageSize = rows * columns;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const pages = Array.from({ length: pageCount }, (_, index) => entries.slice(index * pageSize, (index + 1) * pageSize));

  useLayoutEffect(() => {
    const previousPositions = pendingPositionsRef.current;
    if (!previousPositions) return;
    pendingPositionsRef.current = null;
    itemRefs.current.forEach((node) => {
      node?.getAnimations().forEach((animation) => animation.cancel());
    });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    itemRefs.current.forEach((node, id) => {
      const previous = previousPositions.get(id);
      if (!node || !previous || id === draggingId) return;
      const current = node.getBoundingClientRect();
      const x = previous.left - current.left;
      const y = previous.top - current.top;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
      node.animate(
        [{ transform: `translate(${x}px, ${y}px)` }, { transform: "translate(0, 0)" }],
        { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    });
  }, [dragItems, draggingId]);

  function capturePositions() {
    const positions = new Map();
    itemRefs.current.forEach((node, id) => {
      if (node) positions.set(id, node.getBoundingClientRect());
    });
    return positions;
  }

  function clearDrag() {
    dragItemsRef.current = null;
    dragTargetRef.current = null;
    setDraggingId(null);
    setDragItems(null);
  }

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

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const node = menuRef.current;
    const rect = node.getBoundingClientRect();
    const left = Math.max(8, Math.min(menu.left, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(menu.top, window.innerHeight - rect.height - 8));
    if (left !== menu.left || top !== menu.top) {
      setMenu((current) => current ? { ...current, left, top } : null);
    }
    node.querySelector("[role='menuitem']")?.focus();
  }, [menu]);

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

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const nextPage = Math.min(currentPageRef.current, pageCount - 1);
    currentPageRef.current = nextPage;
    scroller.scrollTo({ left: nextPage * scroller.clientWidth });
  }, [columns, loading, pageCount]);

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

  function handlePointerDown(event) {
    if (event.target instanceof Element && event.target.closest("[draggable='true']")) return;
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
    setMenu({ entry, left: event.clientX, top: event.clientY });
  }

  function handleMenuKeyDown(event) {
    if (event.key === "Tab") {
      setMenu(null);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll("[role='menuitem']") || []);
    const currentIndex = items.indexOf(document.activeElement);
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  function handleDragStart(event, id) {
    setMenu(null);
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickRef.current = false;
    swipeRef.current = null;
    dragItemsRef.current = shortcuts;
    dragTargetRef.current = id;
    setDragItems(shortcuts);
    setDraggingId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(event, id) {
    if (!draggingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (draggingId === id || dragTargetRef.current === id) return;

    const current = dragItemsRef.current;
    if (!current) return;
    const sourceIndex = current.findIndex((item) => item.id === draggingId);
    const targetIndex = current.findIndex((item) => item.id === id);
    if (sourceIndex < 0 || targetIndex < 0) return;

    pendingPositionsRef.current = capturePositions();
    const next = [...current];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    dragItemsRef.current = next;
    dragTargetRef.current = id;
    setDragItems(next);
  }

  function handleScrollerDragOver(event) {
    if (!draggingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(event) {
    event.preventDefault();
    const sourceId = draggingId || event.dataTransfer.getData("text/plain");
    const targetId = dragTargetRef.current;
    if (!sourceId) {
      clearDrag();
      return;
    }

    isDroppingRef.current = true;
    setDraggingId(null);
    try {
      if (targetId && sourceId !== targetId) await onReorder(sourceId, targetId);
    } finally {
      isDroppingRef.current = false;
      clearDrag();
    }
  }

  function handleDragEnd() {
    suppressClickRef.current = true;
    window.clearTimeout(suppressClickTimerRef.current);
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    if (!isDroppingRef.current) clearDrag();
  }

  return (
    <section className={`reveal ${isCompact ? "mt-8 max-[480px]:mt-7" : "mt-12 max-[480px]:mt-10"} [animation-delay:220ms]`} aria-labelledby="shortcuts-title">
      <div className="mb-5 flex items-center justify-end gap-2">
        <div className="-mr-2 flex items-center gap-1">
          <button
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink-muted transition hover:bg-sage-soft hover:text-ink"
            type="button"
            onClick={onImport}
          >
            <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
            <span>导入收藏</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-x-2 gap-y-6 sm:grid-cols-8" aria-busy="true">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="skeleton flex flex-col items-center gap-3" aria-hidden="true">
              <span className="h-[52px] w-[52px] rounded-2xl bg-sage-soft" />
              <span className="h-2.5 w-12 rounded-md bg-sage-soft" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div
            ref={scrollerRef}
            className="-mt-3 flex snap-x snap-mandatory select-none overflow-x-auto pt-3 motion-safe:scroll-smooth [scrollbar-width:none] [touch-action:pan-y_pinch-zoom] [&::-webkit-scrollbar]:hidden"
            role="region"
            aria-label="常用入口分页"
            aria-roledescription="轮播图"
            onScroll={handleScroll}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onClickCapture={handleClickCapture}
            onDragOver={handleScrollerDragOver}
            onDrop={handleDrop}
          >
            {pages.map((page, pageIndex) => (
              <div
                key={pageIndex}
                className={`grid w-full shrink-0 snap-start grid-cols-3 content-start gap-x-2 ${isCompact ? "gap-y-4" : "gap-y-6"} px-1 pb-1 sm:grid-cols-8`}
                role="group"
                aria-label={`第 ${pageIndex + 1} 页，共 ${pageCount} 页`}
              >

                {page.map((entry) => {
                  if (entry.isAdd) {
                    return (
                      <button
                        key={entry.id}
                        className={`group flex min-w-0 flex-col items-center ${isCompact ? "gap-2" : "gap-3"} rounded-xl transition-transform hover:-translate-y-0.5`}
                        type="button"
                        aria-label="添加常用入口"
                        onClick={onAdd}
                      >
                        <ShortcutContent density={density} isAdd name="添加" mark={<Plus className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />} />
                      </button>
                    );
                  }

                  const content = <ShortcutContent url={entry.url} mark={entry.mark} name={entry.name} density={density} />;
                  return (
                    <div
                      ref={(node) => {
                        if (node) {
                          itemRefs.current.set(entry.id, node);
                        } else {
                          itemRefs.current.delete(entry.id);
                        }
                      }}
                      key={entry.id}
                      className={`relative min-w-0 rounded-xl ${draggingId ? "will-change-transform" : ""} ${draggingId === entry.id ? "opacity-40" : ""}`}
                      onDragOver={(event) => handleDragOver(event, entry.id)}
                    >
                      <a
                        className={`group flex min-w-0 cursor-grab flex-col items-center ${isCompact ? "gap-2" : "gap-3"} rounded-xl transition-transform hover:-translate-y-0.5 active:cursor-grabbing`}
                        href={entry.url}
                        target={openTarget === "new" ? "_blank" : undefined}
                        rel={openTarget === "new" ? "noreferrer" : undefined}
                        draggable
                        aria-label={`打开${entry.name}`}
                        onDragStart={(event) => handleDragStart(event, entry.id)}
                        onDragEnd={handleDragEnd}
                        onContextMenu={(event) => handleContextMenu(event, entry)}
                      >
                        {content}
                      </a>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {menu && createPortal(
        <div
          ref={menuRef}
          className="select-enter fixed z-[400] w-36 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-dialog"
          style={{ left: menu.left, top: menu.top }}
          role="menu"
          aria-label={`${menu.entry.name}操作`}
          onKeyDown={handleMenuKeyDown}
          onContextMenu={(event) => event.preventDefault()}
        >
          <a
            className="flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-[13px] text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink focus-visible:bg-sage-soft focus-visible:text-ink"
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
            className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] text-ink-muted transition-colors hover:bg-sage-soft hover:text-ink focus-visible:bg-sage-soft focus-visible:text-ink"
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
            className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-[13px] text-danger transition-colors hover:bg-sage-soft focus-visible:bg-sage-soft"
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
        </div>,
        document.body
      )}
    </section>
  );
}
