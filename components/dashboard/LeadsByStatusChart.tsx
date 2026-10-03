"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { useThemeSettings } from "@/components/providers/ThemeProvider";
import type { LeadsOverviewStatusRow } from "@/lib/api/leads";
import { getLeadStatusPalette } from "@/lib/leads/statusPalette";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type Props = {
  items: LeadsOverviewStatusRow[];
  loading?: boolean;
};

export function LeadsByStatusChart({ items, loading }: Props) {
  const { settings } = useThemeSettings();
  const isDark = settings.appTheme === "dark";
  const muted = isDark ? "rgba(232,232,232,0.55)" : "#6c757d";
  const grid = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const rows = useMemo(
    () =>
      [...items]
        .filter((r) => (r.count ?? 0) > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
    [items],
  );

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        fontFamily: "Instrument Sans, system-ui, sans-serif",
        background: "transparent",
        foreColor: muted,
      },
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 4,
          barHeight: "65%",
          distributed: true,
        },
      },
      colors: rows.map((r) => getLeadStatusPalette(r.status).bg),
      dataLabels: { enabled: false },
      legend: { show: false },
      grid: { borderColor: grid, strokeDashArray: 4, xaxis: { lines: { show: true } } },
      xaxis: {
        categories: rows.map((r) => getLeadStatusPalette(r.status).label || r.status),
        labels: { style: { colors: muted, fontSize: "11px" } },
      },
      yaxis: {
        labels: { style: { colors: muted, fontSize: "11px" } },
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        y: { formatter: (v) => `${v}` },
      },
    }),
    [grid, isDark, muted, rows],
  );

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center py-5 text-muted">
        <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
        Chargement…
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="text-center text-muted py-5">
        <i className="fi fi-rr-chart-histogram d-block mb-2 fs-3 opacity-50" />
        Aucun lead sur cette période.
      </div>
    );
  }

  return (
    <ReactApexChart
      type="bar"
      height={Math.max(220, rows.length * 36)}
      series={[{ name: "Leads", data: rows.map((r) => r.count) }]}
      options={options}
    />
  );
}
