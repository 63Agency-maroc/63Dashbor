import {
  detectBrowserTimezone,
  resolveIanaZone,
  setDefaultViewerTimezone,
} from "@/lib/datetime/timezone";
import { updateMyTimezone } from "@/lib/api/users";
import type { AuthUser } from "@/lib/auth/storage";

const SESSION_KEY = "nexlink_tz_autodetect_v1";

function storedTz(user: AuthUser | null | undefined): string {
  return typeof user?.timezone === "string" ? user.timezone.trim() : "";
}

/** Applique le fuseau viewer comme défaut des helpers format*. */
export function applyViewerTimezoneDefault(user: AuthUser | null | undefined) {
  setDefaultViewerTimezone(storedTz(user) || detectBrowserTimezone());
}

/**
 * Auto-detect navigateur → PATCH si timezone manquant ou différent.
 * Une seule fois par onglet (sessionStorage) pour éviter les boucles.
 */
export async function syncViewerTimezoneOnce(
  user: AuthUser,
  applyUser: (u: AuthUser) => void,
): Promise<void> {
  if (typeof window === "undefined") return;
  applyViewerTimezoneDefault(user);

  let already = false;
  try {
    already = sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    /* ignore */
  }
  if (already) return;

  const browser = detectBrowserTimezone();
  const current = storedTz(user);
  const resolvedCurrent = current ? resolveIanaZone(current) : "";
  const resolvedBrowser = resolveIanaZone(browser);

  if (resolvedCurrent && resolvedCurrent === resolvedBrowser) {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    const updated = await updateMyTimezone(browser);
    const next: AuthUser = {
      ...user,
      ...(updated && typeof updated === "object" ? updated : {}),
      timezone: (updated as AuthUser)?.timezone || browser,
    };
    applyUser(next);
    applyViewerTimezoneDefault(next);
  } catch {
    /* silencieux — ne bloque pas le login */
  } finally {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
  }
}

/** Après changement manuel Settings — ne pas re-auto-detect dans la même session. */
export function markTimezoneSynced() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}
