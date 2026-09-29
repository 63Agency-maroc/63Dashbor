"use client";

import type { ReactNode } from "react";
import type { MeetingsStats } from "@/lib/api/meetings";
import { MEETING_STATUSES, MEETING_TITLES } from "@/lib/api/meetings";
import { STATUS_PALETTE } from "@/lib/calendar/statusPalette";
import { getAssigneeColor } from "@/lib/calendar/assigneePalette";
import { Select } from "@/components/ui/Select";

export type CalView =
  | "timeGridDay"
  | "timeGridThreeDay"
  | "timeGridWeek"
  | "dayGridMonth"
  | "agenda";

type Props = {
  periodTitle: string;
  activeView: CalView;
  stats: MeetingsStats | null;
  meetingCount: number;
  canManageBlocked: boolean;
  canManageAvailabilities: boolean;
  canAssign: boolean;
  search: string;
  assigneeFilter: string;
  statusFilter: string;
  typeFilter: string;
  colorBy: "status" | "type" | "assignee";
  assigneeOptions: { value: string; label: string }[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalView) => void;
  onSearchChange: (v: string) => void;
  onAssigneeFilter: (v: string) => void;
  onStatusFilter: (v: string) => void;
  onTypeFilter: (v: string) => void;
  onColorBy: (v: "status" | "type" | "assignee") => void;
  onAddMeeting: () => void;
  onBlockDate: () => void;
  onAvailabilities: () => void;
};

const VIEWS: { id: CalView; label: string }[] = [
  { id: "timeGridDay", label: "Jour" },
  { id: "timeGridThreeDay", label: "3 jours" },
  { id: "timeGridWeek", label: "Semaine" },
  { id: "dayGridMonth", label: "Mois" },
  { id: "agenda", label: "Agenda" },
];

const LEGEND_STATUSES = [
  "scheduled",
  "confirmed",
  "bon_qualified",
  "done",
  "cancelled",
  "no_show",
] as const;

export function CalendarPageShell({
  periodTitle,
  activeView,
  stats,
  meetingCount,
  canManageBlocked,
  canManageAvailabilities,
  canAssign,
  search,
  assigneeFilter,
  statusFilter,
  typeFilter,
  colorBy,
  assigneeOptions,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onSearchChange,
  onAssigneeFilter,
  onStatusFilter,
  onTypeFilter,
  onColorBy,
  onAddMeeting,
  onBlockDate,
  onAvailabilities,
  children,
}: Props & { children: ReactNode }) {
  return (
    <div className="cal-page">
      {/* Row 1 — navigation + views + actions */}
      <div className="cal-page__bar">
        <div className="cal-page__nav">
          <button type="button" className="cal-page__icon-btn" onClick={onPrev} aria-label="Précédent">
            <i className="fi fi-rr-angle-left" />
          </button>
          <button type="button" className="cal-page__icon-btn" onClick={onNext} aria-label="Suivant">
            <i className="fi fi-rr-angle-right" />
          </button>
          <span className="cal-page__period">{periodTitle || "…"}</span>
          <button type="button" className="cal-page__chip" onClick={onToday}>
            Aujourd&apos;hui
          </button>
        </div>

        <div className="cal-page__views" role="tablist" aria-label="Vue">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={activeView === v.id}
              className={`cal-page__view-btn${activeView === v.id ? " is-active" : ""}`}
              onClick={() => onViewChange(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="cal-page__actions">
          {canManageAvailabilities ? (
            <button type="button" className="cal-page__btn cal-page__btn--ghost" onClick={onAvailabilities}>
              <i className="fi fi-rr-clock" aria-hidden />{" "}
              <span className="cal-page__btn-long">Dispos</span>
              <span className="cal-page__btn-short">Dispos</span>
            </button>
          ) : null}
          {canManageBlocked ? (
            <button type="button" className="cal-page__btn cal-page__btn--ghost" onClick={onBlockDate}>
              <i className="fi fi-rr-ban" aria-hidden />{" "}
              <span className="cal-page__btn-long">Bloquer un créneau</span>
              <span className="cal-page__btn-short">Bloquer</span>
            </button>
          ) : null}
          <button type="button" className="cal-page__btn cal-page__btn--primary" onClick={onAddMeeting}>
            <i className="fi fi-rr-plus" aria-hidden />{" "}
            <span className="cal-page__btn-long">Nouveau rendez-vous</span>
            <span className="cal-page__btn-short">Nouveau</span>
          </button>
        </div>
      </div>

      {/* Row 2 — filters (une seule ligne) */}
      <div className="cal-page__filters">
        <div className="cal-page__search">
          <i className="fi fi-rr-search" aria-hidden />
          <input
            type="search"
            placeholder="Rechercher un client…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="cal-page__filter-pills">
          {canAssign ? (
            <Select
              size="sm"
              className="cal-page__select"
              style={{ width: 160 }}
              value={assigneeFilter}
              onChange={onAssigneeFilter}
              options={[{ value: "", label: "Toute l'équipe" }, ...assigneeOptions]}
              aria-label="Filtrer par closer"
            />
          ) : null}

          <Select
            size="sm"
            className="cal-page__select"
            style={{ width: 170 }}
            value={typeFilter}
            onChange={onTypeFilter}
            options={[
              { value: "", label: "Tous les types" },
              ...MEETING_TITLES.map((t) => ({ value: t, label: t })),
            ]}
            aria-label="Filtrer par type"
          />

          <Select
            size="sm"
            className="cal-page__select"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={onStatusFilter}
            options={[
              { value: "", label: "Tous les statuts" },
              ...MEETING_STATUSES.map((s) => ({
                value: s,
                label: STATUS_PALETTE[s]?.label ?? s,
              })),
            ]}
            aria-label="Filtrer par statut"
          />
        </div>

        <div className="cal-page__colorby">
          <span className="cal-page__colorby-label">Couleur par</span>
          <div className="cal-page__colorby-toggle">
            <button
              type="button"
              className={colorBy === "assignee" ? "is-active" : ""}
              onClick={() => onColorBy("assignee")}
            >
              Équipe
            </button>
            <button
              type="button"
              className={colorBy === "status" ? "is-active" : ""}
              onClick={() => onColorBy("status")}
            >
              Statut
            </button>
            <button
              type="button"
              className={colorBy === "type" ? "is-active" : ""}
              onClick={() => onColorBy("type")}
            >
              Type
            </button>
          </div>
        </div>
      </div>

      {/* Grid / agenda stage */}
      <div className="cal-page__stage">{children}</div>

      {/* Legend footer */}
      <div className="cal-page__legend">
        <div className="cal-page__legend-top">
          <span className="cal-page__legend-stat">
            <strong>{meetingCount}</strong> rendez-vous
          </span>
          {stats ? (
            <span className="cal-page__legend-stat text-muted">
              Aujourd&apos;hui {stats.today} · Semaine {stats.thisWeek}
              {stats.pending > 0 ? ` · Pending ${stats.pending}` : ""}
            </span>
          ) : null}
        </div>
        <p className="cal-page__hint mb-0">
          Touchez un créneau libre pour réserver · Cliquez un rendez-vous pour ouvrir le détail
        </p>
        <div className="cal-page__legend-statuses">
          <span className="cal-page__legend-label">
            {colorBy === "assignee"
              ? "Légende équipe (closers)"
              : colorBy === "type"
                ? "Légende des types"
                : "Légende des statuts"}
          </span>
          {colorBy === "assignee"
            ? assigneeOptions.map((a) => {
                const c = getAssigneeColor(
                  a.value,
                  assigneeOptions.map((o) => o.value),
                );
                return (
                  <span key={a.value} className="cal-page__status-pill">
                    <span className="cal-page__status-dot" style={{ background: c.bg }} />
                    {a.label}
                  </span>
                );
              })
            : colorBy === "type"
              ? MEETING_TITLES.map((t) => {
                  const typeDot =
                    t.includes("présentiel")
                      ? "#334155"
                      : t.includes("online")
                        ? "#0E7490"
                        : t.includes("Appel")
                          ? "#4B5563"
                          : "#1F4E79";
                  return (
                  <span key={t} className="cal-page__status-pill">
                    <span className="cal-page__status-dot" style={{ background: typeDot }} />
                    {t}
                  </span>
                  );
                })
              : LEGEND_STATUSES.map((key) => {
                  const p = STATUS_PALETTE[key];
                  return (
                    <span key={key} className="cal-page__status-pill">
                      <span className="cal-page__status-dot" style={{ background: p.bg }} />
                      {p.label}
                    </span>
                  );
                })}
        </div>
      </div>
    </div>
  );
}
