"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function PortalGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [isLoading, router, user]);

  if (isLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6f8] text-sm text-slate-500">
        Loading your workspace…
      </main>
    );
  }

  return children;
}
