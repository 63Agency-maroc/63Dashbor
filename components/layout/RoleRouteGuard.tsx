"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { canAccessPath } from "@/lib/menu";

/** N’affiche pas une page hors rôle : retour à l’accueil, sans écran « accès réservé ». */
export function RoleRouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const role = typeof user?.role === "string" ? user.role : "";
  const allowed = isLoading || canAccessPath(role, pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!canAccessPath(role, pathname)) router.replace("/");
  }, [isLoading, role, pathname, router]);

  if (!allowed) return null;
  return children;
}
