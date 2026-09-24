import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RequireAuth } from "@/components/providers/RequireAuth";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";

export default function DashboardSegmentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RealtimeProvider>
        <DashboardLayout>{children}</DashboardLayout>
      </RealtimeProvider>
    </RequireAuth>
  );
}
