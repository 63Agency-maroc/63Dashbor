"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Sidebar unique.
 * >1023px : data-app-sidebar full | mini (bouton «).
 * ≤1023px : #appMenubar.open fait glisser la barre.
 */
const SIDEBAR_OVERLAY_MAX = 1023;
const STORAGE_KEY = "nexlink-app-settings";

export type AppTheme = "light" | "dark";
/** Valeurs persistées : full | mini. mini-hover = état DOM transitoire (hover). */
export type AppSidebar = "full" | "mini" | "mini-hover";
export type AppColor = "blue" | "teal" | "slate";

export type AppSettings = {
  appTheme: AppTheme;
  appSidebar: AppSidebar;
  appColor: AppColor;
};

const defaults: AppSettings = {
  appTheme: "light",
  appSidebar: "full",
  appColor: "blue",
};

type ThemeContextValue = {
  settings: AppSettings;
  setSettings: (patch: Partial<AppSettings>) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarHover: (hover: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function persistSidebarMode(mode: AppSidebar): "full" | "mini" {
  return mode === "mini-hover" ? "mini" : mode === "mini" ? "mini" : "full";
}

function readStored(): AppSettings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return { ...defaults, appTheme: prefersDark ? "dark" : "light" };
    }
    const parsed = { ...defaults, ...JSON.parse(raw) } as AppSettings;
    // Marque 63 Agency : ink blue (migre l’ancien gold / accents template)
    const allowed: AppColor[] = ["blue", "teal", "slate"];
    if (!allowed.includes(parsed.appColor)) {
      parsed.appColor = "blue";
    }
    return parsed;
  } catch {
    return defaults;
  }
}

function writeStored(settings: AppSettings) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      appTheme: settings.appTheme,
      appSidebar: persistSidebarMode(settings.appSidebar),
      appColor: settings.appColor,
    }),
  );
}

/** Applique data-bs-theme / data-color-theme / data-app-sidebar sur <html> — comme appSettings.js */
function applyToDom(settings: AppSettings) {
  const docEl = document.documentElement;
  docEl.setAttribute("data-bs-theme", settings.appTheme);
  docEl.setAttribute("data-color-theme", settings.appColor);

  // appSettings.js : n’applique data-app-sidebar qu’au-dessus du breakpoint JS
  if (window.innerWidth > SIDEBAR_OVERLAY_MAX) {
    docEl.setAttribute("data-app-sidebar", settings.appSidebar);
  } else {
    docEl.removeAttribute("data-app-sidebar");
  }
}

function syncTogglerActive(active: boolean) {
  document.querySelectorAll(".app-toggler").forEach((el) => {
    el.classList.toggle("active", active);
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<AppSettings>(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readStored();
    setSettingsState(initial);
    applyToDom(initial);
    // Sur grand écran, .active reflète le mode mini (comme après un clic template)
    if (window.innerWidth > SIDEBAR_OVERLAY_MAX) {
      syncTogglerActive(persistSidebarMode(initial.appSidebar) === "mini");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applyToDom(settings);
    writeStored(settings);
  }, [settings, hydrated]);

  useEffect(() => {
    const onResize = () => {
      applyToDom(settings);
      // Sous 1480px le panneau se gère via .open — on retire data-driven active si besoin
      if (window.innerWidth <= SIDEBAR_OVERLAY_MAX) {
        const open = document.getElementById("appMenubar")?.classList.contains("open") ?? false;
        syncTogglerActive(open);
      } else {
        syncTogglerActive(persistSidebarMode(settings.appSidebar) === "mini");
        document.getElementById("appMenubar")?.classList.remove("open");
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [settings]);

  const setSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const toggleTheme = useCallback(() => {
    setSettingsState((prev) => ({
      ...prev,
      appTheme: prev.appTheme === "dark" ? "light" : "dark",
    }));
  }, []);

  /**
   * Bouton « : replie toute la sidebar (full ↔ mini) à partir de 1024px,
   * ou la fait glisser en overlay en dessous.
   */
  const toggleSidebar = useCallback(() => {
    const width = window.innerWidth;
    const docEl = document.documentElement;
    const menubar = document.getElementById("appMenubar");

    if (width > SIDEBAR_OVERLAY_MAX) {
      const current = docEl.getAttribute("data-app-sidebar");
      const next: "full" | "mini" = current === "full" || current === "mini-hover" ? "mini" : "full";
      docEl.setAttribute("data-app-sidebar", next);
      syncTogglerActive(next === "mini");
      menubar?.classList.remove("open");
      setSettingsState((prev) => ({ ...prev, appSidebar: next }));
      return;
    }

    if (menubar) {
      const willOpen = !menubar.classList.contains("open");
      menubar.classList.toggle("open", willOpen);
      syncTogglerActive(willOpen);
    }
  }, []);

  const setSidebarHover = useCallback((hover: boolean) => {
    if (window.innerWidth <= SIDEBAR_OVERLAY_MAX) return;

    setSettingsState((prev) => {
      if (hover && prev.appSidebar === "mini") {
        return { ...prev, appSidebar: "mini-hover" };
      }
      if (!hover && prev.appSidebar === "mini-hover") {
        return { ...prev, appSidebar: "mini" };
      }
      return prev;
    });
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setSettings,
      toggleTheme,
      toggleSidebar,
      setSidebarHover,
    }),
    [settings, setSettings, toggleTheme, toggleSidebar, setSidebarHover],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeSettings must be used within ThemeProvider");
  return ctx;
}
