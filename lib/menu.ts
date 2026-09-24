export type MenuItem = {
  label: string;
  href: string;
  icon: string;
  /** Masqué pour les non-admin (sidebar) */
  adminOnly?: boolean;
};

export type MenuSection = {
  id: string;
  label: string;
  icon: string;
  /** Affiche un séparateur (nav-item-hr) après cette section dans le rail */
  dividerAfter?: boolean;
  items: MenuItem[];
};

/**
 * Sections du menubar NexLink (double-rail) :
 * rail d’icônes → onglets Bootstrap ; panneau → side-menubar par section.
 */
export const menuSections: MenuSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "fi fi-rr-house-blank",
    items: [{ label: "Vue d'ensemble", href: "/", icon: "fi fi-rr-dashboard" }],
  },
  {
    id: "crm",
    label: "CRM",
    icon: "fi fi-rr-users",
    items: [
      { label: "Clients", href: "/clients", icon: "fi fi-rr-review" },
      { label: "Leads", href: "/leads", icon: "fi fi-rr-chart-user" },
      { label: "Calendar", href: "/calendar", icon: "fi fi-rr-calendar" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icon: "fi fi-rr-comment",
    dividerAfter: true,
    items: [
      { label: "WhatsApp", href: "/whatsapp", icon: "fab fa-whatsapp" },
      { label: "Broadcast", href: "/whatsapp/broadcast", icon: "fi fi-rr-paper-plane" },
      { label: "Email", href: "/email", icon: "fi fi-rr-envelope" },
      { label: "Notifications", href: "/notifications", icon: "fi fi-rr-bell" },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    icon: "fi fi-rr-folder",
    dividerAfter: true,
    items: [
      { label: "Devis", href: "/devis", icon: "fi fi-rr-file-invoice", adminOnly: true },
      { label: "Factures", href: "/factures", icon: "fi fi-rr-receipt", adminOnly: true },
      { label: "Propositions", href: "/propositions", icon: "fi fi-rr-document", adminOnly: true },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "fi fi-rr-settings",
    items: [
      { label: "Users", href: "/users", icon: "fi fi-rr-users", adminOnly: true },
      { label: "Settings", href: "/settings", icon: "fi fi-rr-settings", adminOnly: true },
      { label: "Profile", href: "/profile", icon: "fi fi-rr-user" },
    ],
  },
];

/** Flat list (rétrocompat) */
export const businessMenu: MenuItem[] = menuSections.flatMap((s) => s.items);

export function sectionTabId(sectionId: string) {
  return `${sectionId}Tab`;
}

export function isMenuItemActive(pathname: string, href: string, siblingHrefs: string[]): boolean {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  return !siblingHrefs.some(
    (h) =>
      h !== href &&
      h.startsWith(href) &&
      (pathname === h || pathname.startsWith(`${h}/`)),
  );
}

export function findSectionIdForPath(pathname: string, sections: MenuSection[]): string {
  for (const section of sections) {
    const hrefs = section.items.map((i) => i.href);
    if (section.items.some((item) => isMenuItemActive(pathname, item.href, hrefs))) {
      return section.id;
    }
  }
  return sections[0]?.id ?? "dashboard";
}

export function filterSectionsByRole(sections: MenuSection[], isAdmin: boolean): MenuSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => (item.adminOnly ? isAdmin : true)),
    }))
    .filter((section) => section.items.length > 0);
}
