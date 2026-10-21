"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  filterSectionsByRole,
  flattenMenu,
  isMenuItemActive,
  menuSections,
  pinnedMenuItems,
} from "@/lib/menu";
import { useAuth } from "@/components/providers/AuthProvider";
import { useThemeSettings } from "@/components/providers/ThemeProvider";
import { BRAND_NAME, LOGO_SIDEBAR, LOGO_SIDEBAR_OPEN } from "@/lib/constants/brand";
import { LogoutConfirmModal } from "@/components/ui/LogoutConfirmModal";

const OVERLAY_MAX = 1023;

/**
 * Sidebar unique : chaque page est une entrée de premier niveau
 * (icône + libellé + href). Le bouton « replie toute la barre.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { setSidebarHover, settings } = useThemeSettings();
  const { user, logout } = useAuth();
  const role = typeof user?.role === "string" ? user.role : "";
  const [confirmLogout, setConfirmLogout] = useState(false);

  const sections = useMemo(() => filterSectionsByRole(menuSections, role), [role]);
  const entries = useMemo(() => flattenMenu(sections), [sections]);
  const pinned = useMemo(() => pinnedMenuItems(sections), [sections]);

  const hrefs = useMemo(
    () => [
      ...entries.flatMap((entry) => (entry.kind === "item" ? [entry.item.href] : [])),
      ...pinned.map((item) => item.href),
    ],
    [entries, pinned],
  );

  const iconRail = settings.appSidebar === "mini";

  useEffect(() => {
    if (!iconRail) return;
    let disposed = false;
    const tips: { dispose: () => void }[] = [];
    void import("bootstrap").then((bootstrap) => {
      if (disposed) return;
      document.querySelectorAll<HTMLElement>("#appMenubar [data-bs-toggle='tooltip']").forEach((el) => {
        tips.push(bootstrap.Tooltip.getOrCreateInstance(el, { placement: "right", trigger: "hover" }));
      });
    });
    return () => {
      disposed = true;
      tips.forEach((tip) => tip.dispose());
    };
  }, [iconRail, entries, pinned]);

  function closeDrawer() {
    document.getElementById("appMenubar")?.classList.remove("open");
    document.querySelectorAll(".app-toggler").forEach((el) => el.classList.remove("active"));
  }

  useEffect(() => {
    if (window.innerWidth > OVERLAY_MAX) return;
    closeDrawer();
  }, [pathname]);

  return (
    <>
    <aside
      className="app-menubar"
      id="appMenubar"
      onMouseEnter={() => setSidebarHover(true)}
      onMouseLeave={() => setSidebarHover(false)}
    >
      <div className="app-navbar-brand">
        <Link href="/" aria-label={BRAND_NAME} className="app-sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SIDEBAR} alt="" className="app-sidebar-logo app-sidebar-logo--mark" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SIDEBAR_OPEN} alt={BRAND_NAME} className="app-sidebar-logo app-sidebar-logo--wordmark" />
        </Link>
      </div>

      <nav className="app-navbar">
        <ul className="menubar">
          {entries.map((entry, index) => {
            if (entry.kind === "divider") {
              return <li key={`divider-${index}`} className="menu-divider" aria-hidden />;
            }
            const active = isMenuItemActive(pathname, entry.item.href, hrefs);
            return (
              <Fragment key={`${entry.item.href}:${entry.item.label}`}>
                <li className="menu-item">
                  <Link
                    className={`menu-link${active ? " active" : ""}`}
                    href={entry.item.href}
                    title={entry.item.label}
                    {...(iconRail
                      ? {
                          "data-bs-toggle": "tooltip",
                          "data-bs-placement": "right",
                          "data-bs-title": entry.item.label,
                        }
                      : {})}
                  >
                    <i className={entry.item.icon} aria-hidden />
                    <span className="menu-label">{entry.item.label}</span>
                  </Link>
                </li>
              </Fragment>
            );
          })}
        </ul>
      </nav>

      <div className="app-footer">
        {pinned.map((item) => {
          const active = isMenuItemActive(pathname, item.href, hrefs);
          return (
            <Link
              key={item.href}
              className={`menu-link${active ? " active" : ""}`}
              href={item.href}
              title={item.label}
              {...(iconRail
                ? {
                    "data-bs-toggle": "tooltip",
                    "data-bs-placement": "right",
                    "data-bs-title": item.label,
                  }
                : {})}
            >
              <i className={item.icon} aria-hidden />
              <span className="menu-label">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className="menu-link text-danger"
          title="Log Out"
          aria-label="Log Out"
          {...(iconRail
            ? { "data-bs-toggle": "tooltip", "data-bs-placement": "right", "data-bs-title": "Log Out" }
            : {})}
          onClick={() => setConfirmLogout(true)}
        >
          <i className="fi fi-sr-exit" aria-hidden />
          <span className="menu-label">Log Out</span>
        </button>
      </div>

      <LogoutConfirmModal
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
      />
    </aside>
    <button type="button" className="app-sidebar-backdrop" aria-label="Fermer le menu" onClick={closeDrawer} />
    </>
  );
}
