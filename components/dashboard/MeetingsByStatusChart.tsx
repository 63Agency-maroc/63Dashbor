"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { useThemeSettings } from "@/components/providers/ThemeProvider";
import { MEETING_STATUSES, type MeetingStatusCounts } from "@/lib/api/meetings";
import { STATUS_PALETTE } from "@/lib/calendar/statusPalette";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type Props = {
  byStatus: MeetingStatusCounts | null;
  loading?: boolean;
};

export function MeetingsByStatusChart({ byStatus, loading }: Props) {
  const { settings } = useThemeSettings();
  const isDark = settings.appTheme === "dark";
  const muted = isDark ? "rgba(232,232,232,0.55)" : "#6c757d";

  const rows = useMemo(() => {
    if (!byStatus) return [];
    return MEETING_STATUSES.map((key) => ({
      key,
      label: STATUS_PALETTE[key]?.label ?? key,
      count: byStatus[key] ?? 0,
      color: STATUS_PALETTE[key]?.bg ?? "#6c757d",
    })).filter((r) => r.count > 0);
  }, [byStatus]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.count, 0), [rows]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "donut",
        fontFamily: "Instrument Sans, system-ui, sans-serif",
        background: "transparent",
        foreColor: muted,
      },
      labels: rows.map((r) => r.label),
      colors: rows.map((r) => r.color),
      legend: {
        position: "bottom",
        fontSize: "12px",
        labels: { colors: muted },
        markers: { size: 8 },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      plotOptions: {
        pie: {
          donut: {
            size: "68%",
            labels: {
              show: true,
              name: { show: true, color: muted, fontSize: "12px" },
              value: {
                show: true,
                fontSize: "22px",
                fontWeight: 600,
                color: isDark ? "#f2f2f2" : "#212529",
                formatter: (v) => String(v),
              },
              total: {
                show: true,
                label: "Total",
                color: muted,
                formatter: () => String(total),
              },
            },
          },
        },
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        y: { formatter: (v) => `${v}` },
      },
    }),
    [isDark, muted, rows, total],
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
        <i className="fi fi-rr-chart-pie-alt d-block mb-2 fs-3 opacity-50" />
        Aucune répartition disponible.
      </div>
    );
  }

  return (
    <ReactApexChart
      type="donut"
      height={300}
      series={rows.map((r) => r.count)}
      options={options}
    />
  );
}
