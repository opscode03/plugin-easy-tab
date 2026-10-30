import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Check, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
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
  managing,
  onToggleManaging,
  onAdd,
  onEdit,
  onDelete,
  onImport,
  onReorder
}) {
  const [columns, setColumns] = useState(() => window.matchMedia("(min-width: 640px)").matches ? 8 : 3);
  const [draggingId, setDraggingId] = useState(null);
  const currentPageRef = useRef(0);
  const scrollerRef = useRef(null);
  const swipeRef = useRef(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef(null);
  const isCompact = density === "compact";
  const entries = [...shortcuts, { id: "add", isAdd: true }];
  const pageSize = rows * columns;
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const pages = Array.from({ length: pageCount }, (_, index) => entries.slice(index * pageSize, (index + 1) * pageSize));

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

  function handleDragStart(event, id) {
    setDraggingId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(event, id) {
    if (!draggingId || draggingId === id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleDrop(event, targetId) {
    event.preventDefault();
    const sourceId = draggingId || event.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== targetId) onReorder(sourceId, targetId);
    setDraggingId(null);
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
          <button
            className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] text-ink-muted transition hover:bg-sage-soft hover:text-ink"
            type="button"
            aria-pressed={managing}
            onClick={onToggleManaging}
          >
            {managing ? <Check className="h-4 w-4" aria-hidden="true" /> : <Pencil className="h-4 w-4" aria-hidden="true" />}
            <span>{managing ? "完成" : "管理"}</span>
          </button>
        </div>
      </div>


      {managing && (
        <p className="-mt-2 mb-4 text-xs text-ink-muted">拖动左侧手柄排序。</p>
      )}

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
                      key={entry.id}
                      className={`relative min-w-0 rounded-xl ${draggingId === entry.id ? "opacity-40" : ""}`}
                      onDragOver={(event) => handleDragOver(event, entry.id)}
                      onDrop={(event) => handleDrop(event, entry.id)}
                    >
                      {managing ? (
                        <button
                          className={`group flex min-w-0 flex-col items-center ${isCompact ? "gap-2" : "gap-3"} justify-self-stretch rounded-xl transition-transform hover:-translate-y-0.5`}
                          type="button"
                          aria-label={`编辑${entry.name}`}
                          onClick={() => onEdit(entry)}
                        >
                          {content}
                        </button>
                      ) : (
                        <a
                          className={`group flex min-w-0 flex-col items-center ${isCompact ? "gap-2" : "gap-3"} rounded-xl transition-transform hover:-translate-y-0.5`}
                          href={entry.url}
                          target={openTarget === "new" ? "_blank" : undefined}
                          rel={openTarget === "new" ? "noreferrer" : undefined}
                          aria-label={`打开${entry.name}`}
                        >
                          {content}
                        </a>
                      )}
                      {managing && (
                        <>
                          <button
                            className="absolute -left-1 -top-2 z-10 grid h-8 w-8 cursor-grab place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-sm transition hover:border-sage hover:text-sage active:cursor-grabbing"
                            type="button"
                            draggable
                            aria-label={`排序${entry.name}`}
                            title="拖拽排序"
                            onDragStart={(event) => handleDragStart(event, entry.id)}
                            onDragEnd={() => setDraggingId(null)}
                          >
                            <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            className="absolute -right-1 -top-2 grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-sm transition hover:border-danger hover:text-danger"
                            type="button"
                            aria-label={`删除${entry.name}`}
                            onClick={() => onDelete(entry.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
