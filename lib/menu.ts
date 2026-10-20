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
 * Navigation : les sections ne sont que des groupes.
 * L’UI affiche leurs items au premier niveau du sidebar.
 */
export const menuSections: MenuSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "fi fi-rr-house-blank",
    items: [
      { label: "Dashboard Data", href: "/", icon: "fi fi-rr-dashboard" },
      { label: "Team Manager", href: "/team-manager", icon: "fi fi-rr-leaderboard", adminOnly: true },
      { label: "Employees", href: "/employees", icon: "fi fi-rr-employee-man", adminOnly: true },
    ],
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
      { label: "Settings", href: "/settings", icon: "fi fi-rr-settings", adminOnly: true },
      { label: "Profile", href: "/profile", icon: "fi fi-rr-user" },
    ],
  },
];

/** Flat list (rétrocompat) */
export const businessMenu: MenuItem[] = menuSections.flatMap((s) => s.items);

export type FlatMenuEntry =
  | { kind: "item"; item: MenuItem }
  | { kind: "divider" };

/** Sections conteneurs → entrées de premier niveau, séparateurs conservés. */
export function flattenMenu(sections: MenuSection[]): FlatMenuEntry[] {
  const entries: FlatMenuEntry[] = [];
  sections.forEach((section, index) => {
    for (const item of section.items) entries.push({ kind: "item", item });
    if (section.dividerAfter && index < sections.length - 1) entries.push({ kind: "divider" });
  });
  return entries;
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

export function filterSectionsByRole(sections: MenuSection[], isAdmin: boolean): MenuSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => (item.adminOnly ? isAdmin : true)),
    }))
    .filter((section) => section.items.length > 0);
}
