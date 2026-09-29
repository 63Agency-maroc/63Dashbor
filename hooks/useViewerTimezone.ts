"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  CASABLANCA_TZ,
  resolveIanaZone,
  shortTimezoneLabel,
} from "@/lib/datetime/timezone";

/** Fuseau IANA du viewer connecté (fallback Maroc). */
export function useViewerTimezone(): string {
  const { user } = useAuth();
  return useMemo(
    () => resolveIanaZone(typeof user?.timezone === "string" ? user.timezone : null),
    [user?.timezone],
  );
}

export function useViewerTimezoneLabel(): string {
  const tz = useViewerTimezone();
  return shortTimezoneLabel(tz === "UTC" ? CASABLANCA_TZ : tz);
}
