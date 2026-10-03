"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { ClientDashboard } from "@/components/portal/client-dashboard";
import { OperatorDashboard } from "@/components/portal/operator-dashboard";

export default function PortalPage() {
  const { user } = useAuth();

  if (!user) return null;
  return user.role === "client" ? <ClientDashboard /> : <OperatorDashboard />;
}
