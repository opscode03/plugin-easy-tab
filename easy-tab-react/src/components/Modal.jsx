import { useEffect, useRef } from "react";

export default function Modal({ open, onClose, labelledBy, className = "", children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event) {
    // 键盘激活按钮时 click 坐标为 0,0，仅点击对话框自身（遮罩）才关闭
    if (event.target === dialogRef.current) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={`overflow-hidden border border-[color:var(--line)] bg-surface p-0 text-ink backdrop:bg-[var(--overlay)] ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  );
}
