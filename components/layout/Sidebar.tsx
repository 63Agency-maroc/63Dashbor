"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  filterSectionsByRole,
  findSectionIdForPath,
  isMenuItemActive,
  menuSections,
  sectionTabId,
} from "@/lib/menu";
import { useAuth } from "@/components/providers/AuthProvider";
import { useThemeSettings } from "@/components/providers/ThemeProvider";
import { AgencyLogo, BrandText } from "@/components/brand/AgencyLogo";

/**
 * Menubar double-rail (markup template) :
 * - rail gauche : app-navbar-tabs (icônes = onglets)
 * - panneau droit : app-tab-content + tab-pane + side-menubar
 * Sync onglet actif ↔ pathname.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { setSidebarHover } = useThemeSettings();
  const { user } = useAuth();
  const isAdmin = (user?.role ?? "") === "admin";

  const sections = useMemo(
    () => filterSectionsByRole(menuSections, isAdmin),
    [isAdmin],
  );

  const [activeSectionId, setActiveSectionId] = useState(() =>
    findSectionIdForPath(pathname, sections),
  );

  // Auto-sélection de la section contenant la page courante (comme main.js)
  useEffect(() => {
    setActiveSectionId(findSectionIdForPath(pathname, sections));
  }, [pathname, sections]);

  // Tooltips rail (data-bs-toggle) — ré-init après montage / changement de sections
  useEffect(() => {
    let cancelled = false;
    void import("bootstrap").then((bootstrap) => {
      if (cancelled) return;
      document
        .querySelectorAll<HTMLElement>("#appMenubarTabs [data-bs-toggle='tooltip']")
        .forEach((el) => {
          bootstrap.Tooltip.getOrCreateInstance(el, { placement: "right" });
        });
    });
    return () => {
      cancelled = true;
    };
  }, [sections]);

  return (
    <aside
      className="app-menubar-tabs"
      id="appMenubar"
      onMouseEnter={() => setSidebarHover(true)}
      onMouseLeave={() => setSidebarHover(false)}
    >
      {/* Logo — rail 80px */}
      <div className="app-navbar-brand d-flex align-items-center justify-content-center">
        <AgencyLogo href="/" height={34} />
      </div>

      {/* RAIL ICÔNES = onglets sections */}
      <div className="app-navbar-tabs" data-simplebar>
        <ul className="nav" id="appMenubarTabs" role="tablist" aria-orientation="vertical">
          {sections.map((section) => {
            const tabId = sectionTabId(section.id);
            const isActive = activeSectionId === section.id;
            return (
              <Fragment key={section.id}>
                <li
                  className="nav-item"
                  data-bs-toggle="tooltip"
                  data-bs-placement="right"
                  data-bs-title={section.label}
                >
                  <a
                    className={`menu-link${isActive ? " active" : ""}`}
                    href={`#${tabId}`}
                    role="tab"
                    aria-controls={tabId}
                    aria-selected={isActive}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveSectionId(section.id);
                    }}
                  >
                    <i className={section.icon} aria-hidden />
                    <span className="visually-hidden">{section.label}</span>
                  </a>
                </li>
                {section.dividerAfter ? <li className="nav-item-hr" aria-hidden /> : null}
              </Fragment>
            );
          })}
        </ul>
      </div>

      {/* PANNEAU SOUS-MENUS */}
      <div className="app-tab-content">
        <div className="app-side-brands">
          <Link className="navbar-brand-text" href="/">
            <BrandText />
          </Link>
        </div>
        <div className="app-content-inner">
          <div className="tab-content" id="appMenubarTabsContent">
            {sections.map((section) => {
              const tabId = sectionTabId(section.id);
              const isActive = activeSectionId === section.id;
              const hrefs = section.items.map((i) => i.href);

              return (
                <div
                  key={section.id}
                  className={`tab-pane fade${isActive ? " show active" : ""}`}
                  id={tabId}
                  role="tabpanel"
                  tabIndex={0}
                  aria-labelledby={`${tabId}-tab`}
                >
                  <nav className="app-navbar" data-simplebar>
                    <ul className="side-menubar">
                      <li className="menu-heading">
                        <span className="menu-label">{section.label}</span>
                      </li>
                      {section.items.map((item) => {
                        const active = isMenuItemActive(pathname, item.href, hrefs);
                        return (
                          <li className="menu-item" key={item.href}>
                            <Link
                              className={`menu-link${active ? " active" : ""}`}
                              href={item.href}
                              role="button"
                            >
                              <i className={item.icon} aria-hidden />
                              <span className="menu-label">{item.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}
