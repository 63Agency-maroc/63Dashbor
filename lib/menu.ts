/** Qui peut voir l’entrée. `all` = tous les rôles connectés. */
export type MenuAccess = "all" | "admin" | "leads" | "meetings" | "whatsapp";

export type MenuItem = {
  label: string;
  href: string;
  icon: string;
  /** Défaut : visible pour tous les rôles */
  access?: MenuAccess;
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
      { label: "Team Manager", href: "/team-manager", icon: "fi fi-rr-leaderboard", access: "admin" },
      { label: "Employees", href: "/employees", icon: "fi fi-rr-employee-man", access: "admin" },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    icon: "fi fi-rr-users",
    items: [
      { label: "Clients", href: "/clients", icon: "fi fi-rr-review", access: "admin" },
      { label: "Leads", href: "/leads", icon: "fi fi-rr-chart-user", access: "leads" },
      { label: "Calendar", href: "/calendar", icon: "fi fi-rr-calendar", access: "meetings" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icon: "fi fi-rr-comment",
    dividerAfter: true,
    items: [
      { label: "WhatsApp", href: "/whatsapp", icon: "fab fa-whatsapp", access: "whatsapp" },
      { label: "Broadcast", href: "/whatsapp/broadcast", icon: "fi fi-rr-paper-plane", access: "whatsapp" },
      { label: "Email", href: "/email", icon: "fi fi-rr-envelope" },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    icon: "fi fi-rr-folder",
    dividerAfter: true,
    items: [
      { label: "Devis", href: "/devis", icon: "fi fi-rr-file-invoice", access: "admin" },
      { label: "Factures", href: "/factures", icon: "fi fi-rr-receipt", access: "admin" },
      { label: "Propositions", href: "/propositions", icon: "fi fi-rr-document", access: "admin" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: "fi fi-rr-settings",
    items: [
      { label: "Settings", href: "/settings", icon: "fi fi-rr-settings" },
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

export function roleHasAccess(role: string | null | undefined, access: MenuAccess = "all"): boolean {
  const r = (role ?? "").trim();
  if (access === "all") return true;
  if (access === "admin") return r === "admin";
  if (access === "whatsapp") return r === "admin" || r === "admin_whatsapp";
  if (access === "leads") return r === "admin" || r === "admin_whatsapp" || r === "setter";
  if (access === "meetings") {
    return r === "admin" || r === "admin_whatsapp" || r === "fixed_meeting" || r === "setter";
  }
  return false;
}

const PATH_ACCESS: { prefix: string; access: MenuAccess }[] = [
  { prefix: "/team-manager", access: "admin" },
  { prefix: "/employees", access: "admin" },
  { prefix: "/clients", access: "admin" },
  { prefix: "/devis", access: "admin" },
  { prefix: "/factures", access: "admin" },
  { prefix: "/propositions", access: "admin" },
  { prefix: "/whatsapp/broadcast", access: "whatsapp" },
  { prefix: "/whatsapp", access: "whatsapp" },
  { prefix: "/leads", access: "leads" },
  { prefix: "/calendar", access: "meetings" },
];

/** true si ce rôle peut ouvrir l’URL. Les pages hors liste restent ouvertes. */
export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  const rule = PATH_ACCESS.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  );
  if (!rule) return true;
  return roleHasAccess(role, rule.access);
}

export function filterSectionsByRole(sections: MenuSection[], role: string | null | undefined): MenuSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => roleHasAccess(role, item.access ?? "all")),
    }))
    .filter((section) => section.items.length > 0);
}
