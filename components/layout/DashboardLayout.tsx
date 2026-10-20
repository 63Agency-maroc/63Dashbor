import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { Footer } from "@/components/layout/Footer";
import { RoleRouteGuard } from "@/components/layout/RoleRouteGuard";

/**
 * Shell layout NexLink : page-layout + header + menubar + wrapper + footer.
 * Markup aligné sur index.html du template (sans le contenu page).
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page-layout">
      <Topbar />
      <Sidebar />
      <main className="app-wrapper">
        <RoleRouteGuard>{children}</RoleRouteGuard>
      </main>
      <Footer />
    </div>
  );
}
