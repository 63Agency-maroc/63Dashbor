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
 * Breakpoints NexLink (issus du template) :
 * - main.js : 1191 → décide data-app-sidebar vs class .open
 * - styles.css @media (max-width: 1480px) : force --app-menubar-tabs: 80px
 *   et n’affiche le panneau texte que via #appMenubar.open
 *
 * Conséquence : entre 1191 et 1480, basculer seulement data-app-sidebar
 * ne change RIEN visuellement. On porte le JS template + on aligne le
 * mécanisme visible sur le breakpoint CSS 1480.
 */
const JS_SIDEBAR_BREAKPOINT = 1191; // main.js
const CSS_COMPACT_MAX = 1480; // styles.css media query
const STORAGE_KEY = "nexlink-app-settings";

export type AppTheme = "light" | "dark";
/** Valeurs persistées : full | mini. mini-hover = état DOM transitoire (hover). */
export type AppSidebar = "full" | "mini" | "mini-hover";
export type AppColor =
  | "blue"
  | "indigo"
  | "purple"
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "teal"
  | "cyan";

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
    return { ...defaults, ...JSON.parse(raw) };
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
  if (window.innerWidth >= JS_SIDEBAR_BREAKPOINT) {
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
    if (window.innerWidth > CSS_COMPACT_MAX) {
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
      if (window.innerWidth <= CSS_COMPACT_MAX) {
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
   * Port de main.js initAppToggler + alignement CSS @media 1480px.
   * Bouton : .app-toggler
   * Desktop large (>1480) : <html data-app-sidebar="full"|"mini">
   * ≤1480 (incl. “desktop” laptop) : #appMenubar.classList "open" (+ .active backdrop)
   */
  const toggleSidebar = useCallback(() => {
    const width = window.innerWidth;
    const docEl = document.documentElement;
    const menubar = document.getElementById("appMenubar");

    if (width > CSS_COMPACT_MAX) {
      // Comportement template desktop (main.js) — effective seulement hors media 1480
      // Lit l’attribut DOM comme le template (gère aussi mini-hover)
      const current = docEl.getAttribute("data-app-sidebar");
      const next: "full" | "mini" = current === "full" ? "mini" : "full";
      docEl.setAttribute("data-app-sidebar", next);
      syncTogglerActive(next === "mini");
      menubar?.classList.remove("open");
      setSettingsState((prev) => ({ ...prev, appSidebar: next }));
      return;
    }

    // Viewport ≤1480 : le CSS force déjà le rail 80px ; le panneau s’ouvre via .open
    // (même markup/CSS que le template pour tablette / laptop)
    if (menubar) {
      const willOpen = !menubar.classList.contains("open");
      menubar.classList.toggle("open", willOpen);
      syncTogglerActive(willOpen);
    }

    // Au-dessus du breakpoint JS, on garde aussi data-app-sidebar cohérent pour le resize → grand écran
    if (width >= JS_SIDEBAR_BREAKPOINT) {
      const current = docEl.getAttribute("data-app-sidebar");
      // Ne force pas un toggle full/mini ici : l’UI visible est .open.
      // On s’assure juste que l’attribut existe (défaut full en storage).
      if (!current || current === "mini-hover") {
        const mode = persistSidebarMode(settings.appSidebar);
        docEl.setAttribute("data-app-sidebar", mode);
      }
    }
  }, [settings.appSidebar]);

  const setSidebarHover = useCallback((hover: boolean) => {
    // Hover expand seulement en vrai mode mini desktop (comme main.js)
    if (window.innerWidth <= CSS_COMPACT_MAX) return;

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
    () => ({ settings, setSettings, toggleTheme, toggleSidebar, setSidebarHover }),
    [settings, setSettings, toggleTheme, toggleSidebar, setSidebarHover],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeSettings must be used within ThemeProvider");
  return ctx;
}
