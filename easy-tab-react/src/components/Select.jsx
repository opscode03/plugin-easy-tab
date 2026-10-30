import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

const TRIGGER_VARIANTS = {
  field: "field-input pr-9",
  ghost: "h-10 w-[96px] rounded-[10px] bg-transparent pl-2 pr-7 text-[13px] text-ink-muted outline-none transition hover:bg-sage-soft hover:text-ink focus-visible:bg-sage-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-sage max-[480px]:w-[84px] max-[480px]:pl-1 max-[480px]:text-xs"
};

const LIST_VARIANTS = {
  field: "left-0 w-full",
  ghost: "right-0 w-36"
};

export default function Select({ id, value, options, onChange, ariaLabel, variant = "field", className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => listRef.current?.focus());

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  function handleOpen() {
    setActiveIndex(selectedIndex);
    setIsOpen(true);
  }

  function handleSelect(optionValue) {
    onChange(optionValue);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event) {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      handleOpen();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen) {
        setIsOpen(false);
      } else {
        handleOpen();
      }
    }
  }

  function handleListKeyDown(event) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "Home") setActiveIndex(0);
      if (event.key === "End") setActiveIndex(options.length - 1);
      if (event.key === "ArrowDown") setActiveIndex((index) => Math.min(index + 1, options.length - 1));
      if (event.key === "ArrowUp") setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect(options[activeIndex].value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative flex items-center"
      onKeyDown={(event) => {
        if (event.key === "/") event.stopPropagation();
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        className={`cursor-pointer text-left ${TRIGGER_VARIANTS[variant]} ${className}`}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            handleOpen();
          }
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="truncate">{selectedOption?.label}</span>
      </button>
      <ChevronDown
        className={`pointer-events-none absolute h-4 w-4 text-ink-muted transition-transform ${isOpen ? "rotate-180" : ""} ${variant === "field" ? "right-3" : "right-2"}`}
        aria-hidden="true"
      />

      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          className={`select-enter absolute top-[calc(100%_+_6px)] z-50 max-h-60 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 text-ink shadow-dialog outline-none focus-visible:ring-2 focus-visible:ring-sage ${LIST_VARIANTS[variant]}`}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={`${listboxId}-option-${activeIndex}`}
          onKeyDown={handleListKeyDown}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <li
                ref={(node) => { optionRefs.current[index] = node; }}
                id={`${listboxId}-option-${index}`}
                key={option.value}
                className={`flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-[13px] transition-colors ${isActive ? "bg-sage-soft text-ink" : "text-ink-muted"} ${isSelected ? "font-medium text-ink" : ""}`}
                role="option"
                aria-selected={isSelected}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => handleSelect(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-sage" strokeWidth={2} aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
