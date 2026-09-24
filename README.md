# CRM Dashboard 63 — Next.js + NexLink

Dashboard CRM Next.js (App Router) qui reprend le design **NexLink v1.3.0** à l’identique via le CSS compilé du template (pas de Tailwind, pas de re-design).

## Stack

| Couche | Choix |
|--------|--------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Design | CSS NexLink porté tel quel (`public/assets/css/styles.css`) |
| CSS framework | Bootstrap 5.3 **inclus dans** `styles.css` du template |
| Interactivité Bootstrap | **data-bs-\* + `bootstrap` JS** (bundle), pas react-bootstrap — pour garder le markup template au pixel près |
| Thème | `ThemeProvider` React (`data-bs-theme`, `data-app-sidebar`, `data-color-theme` + localStorage) |
| API | NestJS — décrite dans `API_MAP.md` (**pas branchée** à cette étape) |

## Règle template (lecture seule)

Le dossier template ThemeForest / `NexLink-v1.3.0_24_March_2026/` est une **référence en lecture seule**.  
On **copie** les assets vers `public/assets/`, on ne modifie jamais le template original.

Chemin template source (machine locale) :
`%USERPROFILE%\Downloads\themeforest-rQKx7Ra6-nexlink-crm-admin-dashboard-bootstrap-template\NexLink-v1.3.0_24_March_2026\xhtml\xhtml\src\`

## Design system (où ça vit)

```
public/assets/
  css/styles.css          ← thème NexLink compilé (Bootstrap + custom)
  css/styles-rtl.css      ← RTL (non branché)
  images/                 ← logos, avatars, media
  libs/
    flaticon/ lucide/ fontawesome/  ← icônes
    simplebar/ node-waves/
    bootstrap/              ← JS bundle dispo si besoin
```

Chargement CSS : balises `<link href="/assets/...">` dans `app/layout.tsx` (comme le template).  
**Ajustement React/Next** : pas d’`import` bundlé de `styles.css` — Turbopack ne résout pas les `@import` absolus vers `public/`, et un bundling casserait les `url()` relatives des fonts.

## Layout React (extrait une seule fois)

| Composant | Rôle |
|-----------|------|
| `components/layout/Sidebar.tsx` | Menubar latéral — liens métier uniquement |
| `components/layout/Topbar.tsx` | Recherche, notifs, user, thème |
| `components/layout/DashboardLayout.tsx` | Assemble shell `page-layout` |
| `components/providers/ThemeProvider.tsx` | Port de `appSettings.js` + toggle thème |

## App Router

```
app/
  layout.tsx                 ← HTML shell + CSS + ThemeProvider
  (auth)/layout.tsx          ← public, SANS DashboardLayout
  (dashboard)/
    layout.tsx               ← AVEC DashboardLayout
    page.tsx                 ← placeholder "Dashboard"
```

## Lancer

```bash
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## Libs React installées (pas encore intégrées UI)

Équivalents des plugins template — **dépendances prêtes**, à brancher page par page :

| Template (jQuery/vanilla) | Package React / Next |
|---------------------------|----------------------|
| ApexCharts | `apexcharts` + `react-apexcharts` |
| FullCalendar | `@fullcalendar/react` + `@fullcalendar/daygrid` + `@fullcalendar/interaction` + `@fullcalendar/timegrid` |
| DataTables | `datatables.net-bs5` + `datatables.net-react` *(ou table React custom)* |
| Flatpickr | `flatpickr` + `react-flatpickr` |
| Bootstrap-select | pas d’équivalent officiel React — garder `bootstrap-select` vanilla ou `react-select` |
| SortableJS | `sortablejs` + `react-sortablejs` |

## Points de divergence visuelle possibles (à vérifier)

1. **Menu** : sections démo template retirées → rail d’icônes mono-onglet + liste métier (structure CSS identique, contenu différent).
2. **SimpleBar / Waves** : attributs `data-simplebar` / classes `waves-effect` présents, JS SimpleBar/Waves **pas** initialisés encore → scrollbars / ripples peuvent différer.
3. **Hydration thème** : script inline anti-FOUC + `suppressHydrationWarning` sur `<html>`.
4. **Images Next** : `<img>` natif (pas `next/image`) pour coller aux chemins template.
5. **Modal recherche** : UI statique, pas de `search.json` ajax du template.
6. **Footer** : texte adapté (plus de carte « Upgrade to Pro » sidebar).
7. **CSS via `<link>`** : même fichiers que le template ; pas passés par le bundler Next (nécessaire pour fonts).
8. **Breakpoint 1480px** : le CSS force le rail 80px sous 1480px. Le toggle `data-app-sidebar` full↔mini n’est visible que **>1480px**. Sous 1480px (laptop inclus), le bouton ouvre le panneau via `#appMenubar.open` + `.app-toggler.active`.
9. **Avatars template** : certains `.webp` du pack sont des placeholders « 120 x 120 » (assets d’origine).

## API

Voir `API_MAP.md` (carte NestJS). Base URL : `NEXT_PUBLIC_API_URL` (défaut `http://localhost:3002`).

### Auth
- Token JWT dans `localStorage` (`nexlink_access_token`) + cookie miroir `nexlink_token` (middleware).
- `AuthProvider` : login / logout / réhydratation `GET /auth/me`.
- Protection : middleware (cookie) + `RequireAuth` dans `(dashboard)`.

