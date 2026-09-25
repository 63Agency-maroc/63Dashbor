"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type AppSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  /** @deprecated Recherche retirée du panneau — prop ignorée (compat). */
  searchable?: boolean;
  searchPlaceholder?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: CSSProperties;
  id?: string;
  name?: string;
  "aria-label"?: string;
  required?: boolean;
};

type MenuPos = { top: number; left: number; width: number; maxHeight: number; openUp: boolean };

function measureOptionsWidth(options: SelectOption[]): number {
  if (typeof document === "undefined") return 220;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 260;
  ctx.font = "500 14px Instrument Sans, system-ui, sans-serif";
  let max = 0;
  for (const o of options) {
    max = Math.max(max, ctx.measureText(o.label).width);
  }
  // padding item (15*2) + checkmark + gaps
  return max + 56;
}

/**
 * Dropdown NexLink (pas de <select> natif) :
 * trigger chip `btn btn-white dropdown-toggle` + panneau `dropdown-menu` +
 * items `dropdown-item` + checkmark sur l’option active.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Sélectionner…",
  disabled = false,
  size = "md",
  className = "",
  style,
  id,
  name,
  "aria-label": ariaLabel,
  required,
}: AppSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [mounted, setMounted] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const preferred = Math.min(280, Math.max(spaceBelow, spaceAbove, 120));
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(preferred, openUp ? spaceAbove : spaceBelow);

    const contentW = measureOptionsWidth(options);
    const maxW = Math.min(440, window.innerWidth - 16);
    const width = Math.min(maxW, Math.max(rect.width, contentW, 200));
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - 8 - width);
    }

    setPos({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left,
      width,
      maxHeight: Math.max(120, maxHeight),
      openUp,
    });
  }, [options]);

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(0);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value && !o.disabled),
    );
    setHighlight(idx >= 0 ? idx : 0);
  }, [disabled, options, value]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const onWin = () => updatePosition();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, updatePosition, options.length]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      menuRef.current?.querySelector<HTMLElement>("[data-app-select-option]")?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    setHighlight((h) => Math.min(h, Math.max(0, options.length - 1)));
  }, [options.length, open]);

  const pick = (opt: SelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
    triggerRef.current?.focus();
  };

  const moveHighlight = (dir: 1 | -1) => {
    if (options.length === 0) return;
    let i = highlight;
    for (let n = 0; n < options.length; n += 1) {
      i = (i + dir + options.length) % options.length;
      if (!options[i]?.disabled) {
        setHighlight(i);
        return;
      }
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) openMenu();
      else if (e.key === "ArrowDown") moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) openMenu();
      else moveHighlight(-1);
    }
  };

  const onMenuKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt) pick(opt);
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlight(Math.max(0, options.length - 1));
    }
  };

  const btnSize =
    size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";

  const menu =
    mounted && open && pos
      ? createPortal(
          <div
            ref={menuRef}
            className="dropdown-menu show app-select-menu"
            style={{
              position: "fixed",
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              zIndex: 2000,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            role="listbox"
            id={listId}
            aria-activedescendant={
              options[highlight] ? `${listId}-opt-${highlight}` : undefined
            }
            onKeyDown={onMenuKeyDown}
          >
            <ul className="app-select-menu__list list-unstyled mb-0">
              {options.length === 0 ? (
                <li className="dropdown-item text-muted small disabled">Aucune option</li>
              ) : (
                options.map((opt, i) => {
                  const isSelected = opt.value === value;
                  const isActive = i === highlight;
                  return (
                    <li key={`${opt.value}::${opt.label}`} role="presentation">
                      <button
                        type="button"
                        id={`${listId}-opt-${i}`}
                        role="option"
                        data-app-select-option
                        aria-selected={isSelected}
                        disabled={opt.disabled}
                        className={`dropdown-item d-flex align-items-center justify-content-between gap-2${
                          isActive ? " active" : ""
                        }${isSelected ? " app-select-item--selected" : ""}`}
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => pick(opt)}
                      >
                        <span className="app-select-item__label">{opt.label}</span>
                        {isSelected ? (
                          <i className="fi fi-rr-check flex-shrink-0 text-primary" aria-hidden />
                        ) : (
                          <span className="app-select-item__check-spacer flex-shrink-0" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`dropdown app-select ${open ? "show" : ""} ${className}`.trim()}
      style={style}
    >
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`btn btn-white dropdown-toggle w-100 text-start app-select-trigger ${btnSize}`.trim()}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={`app-select-trigger__label${selected ? "" : " text-muted"}`}>
          {selected?.label ?? placeholder}
        </span>
      </button>
      {menu}
    </div>
  );
}
