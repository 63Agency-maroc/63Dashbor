"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import { useThemeSettings } from "@/components/providers/ThemeProvider";
import type { MeetingsByDayItem } from "@/lib/api/meetings";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type Props = {
  items: MeetingsByDayItem[];
  loading?: boolean;
};

function formatDayLabel(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}`;
}

export function MeetingsByDayChart({ items, loading }: Props) {
  const { settings } = useThemeSettings();
  const isDark = settings.appTheme === "dark";

  const categories = useMemo(() => items.map((i) => formatDayLabel(i.day)), [items]);
  const seriesData = useMemo(() => items.map((i) => i.count), [items]);
  const primary = isDark ? "#5b9fd4" : "#1F4E79";
  const muted = isDark ? "rgba(232,232,232,0.55)" : "#6c757d";
  const grid = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: "area",
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: "Instrument Sans, system-ui, sans-serif",
        background: "transparent",
        foreColor: muted,
      },
      colors: [primary],
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 2.5 },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: isDark ? 0.45 : 0.35,
          opacityTo: 0.05,
          stops: [0, 90, 100],
        },
      },
      grid: {
        borderColor: grid,
        strokeDashArray: 4,
        padding: { left: 8, right: 8 },
      },
      xaxis: {
        categories,
        labels: {
          style: { colors: muted, fontSize: "11px" },
          rotate: categories.length > 20 ? -45 : 0,
          hideOverlappingLabels: true,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        min: 0,
        forceNiceScale: true,
        labels: {
          style: { colors: muted, fontSize: "11px" },
          formatter: (v) => String(Math.round(v)),
        },
      },
      tooltip: {
        theme: isDark ? "dark" : "light",
        y: { formatter: (v) => `${v} meeting${v === 1 ? "" : "s"}` },
      },
      markers: { size: 0, hover: { size: 5 } },
    }),
    [categories, grid, isDark, muted, primary],
  );

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center py-5 text-muted">
        <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
        Chargement…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="text-center text-muted py-5">
        <i className="fi fi-rr-chart-histogram d-block mb-2 fs-3 opacity-50" />
        Aucune donnée sur cette période.
      </div>
    );
  }

  return (
    <ReactApexChart
      type="area"
      height={280}
      series={[{ name: "Meetings", data: seriesData }]}
      options={options}
    />
  );
}
