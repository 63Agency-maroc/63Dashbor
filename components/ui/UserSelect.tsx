"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { employeeFullName, type Employee } from "@/lib/api/users";
import { roleLabel } from "@/lib/auth/storage";

export type UserSelectOption = {
  id: string;
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
  role?: string | null;
};

type Props = {
  value: string;
  onChange: (userId: string) => void;
  users: UserSelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  /** Permet de vider la sélection (valeur "") */
  clearable?: boolean;
  size?: "sm" | "md";
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
};

function optionLabel(u: UserSelectOption): string {
  return employeeFullName({
    prenom: u.prenom ?? "",
    nom: u.nom ?? "",
    email: u.email ?? "",
  });
}

/**
 * Dropdown user searchable (thème app) — setter / closer / etc.
 */
export function UserSelect({
  value,
  onChange,
  users,
  placeholder = "Sélectionner…",
  emptyLabel = "Aucun",
  disabled = false,
  clearable = true,
  size = "md",
  className = "",
  style,
  "aria-label": ariaLabel,
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );

  const selected = useMemo(() => users.find((u) => u.id === value) ?? null, [users, value]);
  const selectedLabel = selected ? optionLabel(selected) : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const blob = `${optionLabel(u)} ${u.email ?? ""} ${u.role ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [users, query]);

  function placeMenu() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(280, openUp ? spaceAbove : spaceBelow));
    setMenuPos({
      top: openUp ? rect.top - maxHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 220),
      maxHeight,
    });
  }

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onScroll = () => placeMenu();
    const onResize = () => placeMenu();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if ((e.target as HTMLElement)?.closest?.(`[data-user-select-menu="${listId}"]`)) return;
      setOpen(false);
      setQuery("");
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open, listId]);

  const btnSize = size === "sm" ? "btn-sm" : "";

  return (
    <div ref={rootRef} className={`dropdown app-select ${open ? "show" : ""} ${className}`.trim()} style={style}>
      <button
        ref={triggerRef}
        type="button"
        className={`btn btn-white dropdown-toggle w-100 text-start app-select-trigger ${btnSize}`.trim()}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setQuery("");
        }}
      >
        <span className={`app-select-trigger__label${selected ? "" : " text-muted"}`}>
          {selected ? selectedLabel : placeholder}
        </span>
      </button>

      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              data-user-select-menu={listId}
              className="dropdown-menu show app-select-menu shadow"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                maxHeight: menuPos.maxHeight,
                display: "flex",
                flexDirection: "column",
                zIndex: 2000,
                padding: 8,
                overflow: "hidden",
              }}
              role="listbox"
            >
              <input
                type="search"
                className="form-control form-control-sm mb-2"
                placeholder="Rechercher…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <div style={{ overflowY: "auto", flex: 1 }}>
                {clearable ? (
                  <button
                    type="button"
                    className={`dropdown-item${value === "" ? " active" : ""}`}
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="text-muted">{emptyLabel}</span>
                  </button>
                ) : null}
                {filtered.length === 0 ? (
                  <div className="dropdown-item disabled small text-muted">Aucun résultat</div>
                ) : (
                  filtered.map((u) => {
                    const active = u.id === value;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`dropdown-item d-flex align-items-center justify-content-between gap-2${
                          active ? " active" : ""
                        }`}
                        onClick={() => {
                          onChange(u.id);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="min-w-0">
                          <span className="d-block text-truncate">{optionLabel(u)}</span>
                          {u.role ? (
                            <span className="small text-muted d-block text-truncate">
                              {roleLabel(u.role)}
                              {u.email ? ` · ${u.email}` : ""}
                            </span>
                          ) : u.email ? (
                            <span className="small text-muted d-block text-truncate">{u.email}</span>
                          ) : null}
                        </span>
                        {active ? <i className="fi fi-rr-check flex-shrink-0" aria-hidden /> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Helper : map Employee → option UserSelect */
export function employeesToUserSelectOptions(users: Employee[]): UserSelectOption[] {
  return users.map((u) => ({
    id: u.id,
    prenom: u.prenom,
    nom: u.nom,
    email: u.email,
    role: u.role,
  }));
}
