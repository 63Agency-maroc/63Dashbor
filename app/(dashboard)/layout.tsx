import type { ReactNode } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RequireAuth } from "@/components/providers/RequireAuth";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
import { WhatsappNotificationsProvider } from "@/components/providers/WhatsappNotificationsProvider";

export default function DashboardSegmentLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <RealtimeProvider>
        <WhatsappNotificationsProvider>
          <DashboardLayout>{children}</DashboardLayout>
        </WhatsappNotificationsProvider>
      </RealtimeProvider>
    </RequireAuth>
  );
}
