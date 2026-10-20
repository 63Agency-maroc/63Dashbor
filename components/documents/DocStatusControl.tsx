"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getDocumentStatusPalette } from "@/lib/documents/statusPalette";

type Props = {
  status: string | null | undefined;
  statuses: readonly string[];
  saving: boolean;
  onPick: (status: string) => void;
};

export function DocStatusControl({ status, statuses, saving, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; openUp: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const palette = getDocumentStatusPalette(status);
  const current = (status ?? "").trim().toLowerCase();

  const placeMenu = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const openUp = window.innerHeight - rect.bottom < 280 && rect.top > 280;
    setMenuPos({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 220)),
      openUp,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onWin = () => placeMenu();
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, placeMenu]);

  const menu =
    open && menuPos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="dropdown-menu show shadow-sm py-1 status-menu"
            role="listbox"
            aria-label="Statut"
            style={{
              position: "fixed",
              top: menuPos.openUp ? undefined : menuPos.top,
              bottom: menuPos.openUp ? window.innerHeight - menuPos.top : undefined,
              left: menuPos.left,
              zIndex: 2000,
              minWidth: 180,
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {statuses.map((value) => {
              const option = getDocumentStatusPalette(value);
              const active = value === current;
              return (
                <button
                  key={value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className="dropdown-item d-flex align-items-center gap-2"
                  onClick={() => {
                    setOpen(false);
                    if (!active) onPick(value);
                  }}
                >
                  <span
                    className="badge rounded-pill"
                    style={{ backgroundColor: option.bg, color: option.text }}
                  >
                    {option.label}
                  </span>
                  {active ? <i className="fi fi-rr-check ms-auto text-primary" aria-hidden /> : null}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="badge rounded-pill border-0 d-inline-flex align-items-center"
        style={{ backgroundColor: palette.bg, color: palette.text, cursor: saving ? "wait" : "pointer" }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Statut : ${palette.label}`}
        disabled={saving}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((currentOpen) => !currentOpen);
        }}
      >
        {palette.label}
        <i className="fi fi-rr-angle-small-down ms-1" aria-hidden />
      </button>
      {menu}
    </>
  );
}
