import type { ReactNode } from "react";
import { PortalGuard } from "@/components/portal/portal-guard";
import { PortalShell } from "@/components/portal/portal-shell";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalGuard>
      <PortalShell>{children}</PortalShell>
    </PortalGuard>
  );
}
