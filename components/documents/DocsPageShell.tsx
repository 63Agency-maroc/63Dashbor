"use client";

import type { ReactNode } from "react";
import { DOC_STATUS_LEGEND_KEYS, getDocumentStatusPalette } from "@/lib/documents/statusPalette";
import { Select } from "@/components/ui/Select";

type Props = {
  title: string;
  breadcrumb: string;
  count: number;
  search: string;
  statusFilter: string;
  statusOptions: { value: string; label: string }[];
  actions?: ReactNode;
  onSearchChange: (v: string) => void;
  onStatusFilter: (v: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

/** Shell type calendrier pour Devis / Factures / Propositions */
export function DocsPageShell({
  title,
  breadcrumb,
  count,
  search,
  statusFilter,
  statusOptions,
  actions,
  onSearchChange,
  onStatusFilter,
  onRefresh,
  refreshing,
  children,
  footer,
}: Props) {
  return (
    <div className="docs-page">
      <div className="docs-page__bar">
        <div className="min-w-0">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-1">
              <li className="breadcrumb-item">
                <a href="/">
                  <i className="fi fi-rr-home" /> Home
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">
                {breadcrumb}
              </li>
            </ol>
          </nav>
          <h4 className="docs-page__title mb-0">{title}</h4>
        </div>
        <div className="docs-page__actions">{actions}</div>
      </div>

      <div className="docs-page__filters">
        <div className="docs-page__search">
          <i className="fi fi-rr-search" aria-hidden />
          <input
            type="search"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Rechercher"
          />
        </div>
        <div className="docs-page__filter-pills">
          <Select
            size="sm"
            className="docs-page__select"
            value={statusFilter}
            onChange={onStatusFilter}
            options={[
              { value: "", label: "Tous les statuts" },
              ...statusOptions,
            ]}
            aria-label="Filtrer par statut"
          />
          {onRefresh ? (
            <button
              type="button"
              className="docs-page__chip"
              onClick={onRefresh}
              disabled={refreshing}
            >
              <i className="fi fi-rr-refresh me-1" aria-hidden />
              Actualiser
            </button>
          ) : null}
        </div>
      </div>

      <div className="docs-page__stage">
        {children}
        {footer ? <div className="docs-page__footer">{footer}</div> : null}
      </div>

      <div className="docs-page__legend">
        <span className="docs-page__legend-stat">
          <strong>{count}</strong> document{count > 1 ? "s" : ""}
        </span>
        <div className="docs-page__legend-statuses">
          <span className="docs-page__legend-label">Légende des statuts</span>
          {DOC_STATUS_LEGEND_KEYS.map((key) => {
            const p = getDocumentStatusPalette(key);
            return (
              <span key={key} className="docs-page__status-pill">
                <span className="docs-page__status-dot" style={{ background: p.bg }} />
                {p.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DocStatusBadge({ status }: { status: string | null | undefined }) {
  const p = getDocumentStatusPalette(status);
  return (
    <span
      className="badge rounded-pill"
      style={{ backgroundColor: p.bg, color: p.text }}
    >
      {p.label}
    </span>
  );
}
