import { useEffect, useRef } from "react";

export default function Modal({ open, onClose, labelledBy, className = "", children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event) {
    const dialog = dialogRef.current;
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className={`overflow-hidden border border-line bg-surface p-0 text-ink shadow-dialog backdrop:bg-[var(--overlay)] ${className}`}
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
