"use client";

import type { CSSProperties, ReactNode } from "react";

export type StatCardAccent =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "secondary"
  | "dark";

export type StatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  /** Accent Bootstrap / NexLink pour le cercle d’icône */
  iconColor?: StatCardAccent;
  subtext?: string;
  className?: string;
  style?: CSSProperties;
};

const ACCENT: Record<StatCardAccent, { bg: string; text: string }> = {
  primary: { bg: "bg-primary-subtle", text: "text-primary" },
  success: { bg: "bg-success-subtle", text: "text-success" },
  warning: { bg: "bg-warning-subtle", text: "text-warning" },
  danger: { bg: "bg-danger-subtle", text: "text-danger" },
  info: { bg: "bg-info-subtle", text: "text-info" },
  secondary: { bg: "bg-secondary-subtle", text: "text-secondary" },
  dark: { bg: "bg-dark-subtle", text: "text-dark" },
};

/**
 * Stat card style demo NexLink :
 * icône cercle doux à gauche · label uppercase · grande valeur · subtext.
 */
export function StatCard({
  label,
  value,
  icon,
  iconColor = "primary",
  subtext,
  className = "",
  style,
}: StatCardProps) {
  const accent = ACCENT[iconColor] ?? ACCENT.primary;

  return (
    <div className={`card app-stat-card h-100 ${className}`.trim()} style={style}>
      <div className="card-body">
        <div className="d-flex align-items-start gap-3">
          {icon ? (
            <div
              className={`app-stat-card__icon ${accent.bg} ${accent.text}`}
              aria-hidden
            >
              {icon}
            </div>
          ) : null}
          <div className="app-stat-card__body min-w-0 flex-grow-1">
            <div className="app-stat-card__label" title={label}>
              {label}
            </div>
            <div className="app-stat-card__value">{value}</div>
            {subtext ? (
              <div className="app-stat-card__subtext text-truncate" title={subtext}>
                {subtext}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
