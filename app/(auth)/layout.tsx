import type { ReactNode } from "react";
import { Suspense } from "react";
import { RedirectIfAuthenticated } from "@/components/providers/RedirectIfAuthenticated";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <RedirectIfAuthenticated>
      <Suspense
        fallback={
          <div className="d-flex align-items-center justify-content-center min-vh-100">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        }
      >
        {children}
      </Suspense>
    </RedirectIfAuthenticated>
  );
}
