
"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function PortalGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const workspace = pathname.split("/")[1];
    if (workspace !== user.role) router.replace(`/${user.role}`);
  }, [isLoading, pathname, router, user]);

  if (isLoading || !user || pathname.split("/")[1] !== user.role) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page-background text-sm text-muted-text">
        Loading your workspace…
      </main>
    );
  }

  return children;
}
