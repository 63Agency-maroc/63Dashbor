# Project rules — CRM Dashboard 63

## Stack
- **Next.js App Router** + TypeScript (pas Pages Router, pas Tailwind).
- Design : **CSS NexLink v1.3.0** porté tel quel (`public/assets/css/styles.css` + libs icônes).
- Bootstrap 5.3 via le CSS template ; interactivité via **data-bs-\* + package `bootstrap` JS** (pas react-bootstrap), pour markup identique au template.

## Design system
- Source de vérité visuelle : `public/assets/` (css, images, flaticon/lucide/fontawesome, simplebar, waves).
- CSS chargé via `<link href="/assets/...">` dans `app/layout.tsx` (pas d’import bundlé — conserve les fonts).
- **Ne pas** réécrire le thème en Tailwind / CSS Modules custom pour le shell.

## Template = lecture seule
- Le dossier ThemeForest `NexLink-v1.3.0_24_March_2026/` (et le zip Downloads) est une **référence** : ne jamais le modifier.
- Porter / copier vers `public/` + composants React. Si un écart React est nécessaire, le documenter dans le README.

## Layout
- Shell unique : `components/layout/{Sidebar,Topbar,DashboardLayout,Footer}.tsx`.
- Menu métier seulement (pas demo components/forms/charts/maps/icons/ai/blog/pricing) : voir `lib/menu.ts`.
- Thème : `components/providers/ThemeProvider.tsx` (`data-bs-theme`, `data-app-sidebar`, `data-color-theme` + localStorage).
- Toggle sidebar : bouton `.app-toggler` — sur grand écran (>1480) bascule `<html data-app-sidebar="full|mini">` ; ≤1480 utilise `#appMenubar.open` + `.app-toggler.active` (le CSS force déjà le rail 80px).

## Routes
- `app/(auth)/` — pages publiques, **sans** DashboardLayout.
- `app/(dashboard)/` — pages métier **avec** DashboardLayout.
- Ne pas dupliquer sidebar/topbar dans chaque page.

## API
- API NestJS : `NEXT_PUBLIC_API_URL`, client dans `lib/api/`, auth dans `lib/auth/` + `AuthProvider`.
- Token : localStorage + cookie `nexlink_token` pour middleware. Protection : middleware + `RequireAuth`.
- Ne pas inventer d’endpoints ; se référer à **API_MAP.md**.

## Libs charts / tables (installées, pas intégrées)
- react-apexcharts, @fullcalendar/react, flatpickr/react-flatpickr, sortablejs — lister dans README ; intégrer page par page.
