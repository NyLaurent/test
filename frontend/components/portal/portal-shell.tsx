"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

export function PortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (!user) return null;

  const roleLabel = user.role === "client" ? "Client workspace" : "Operations workspace";

  return (
    <div className="min-h-screen bg-page-background text-brand-navy">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Image
              src="/assets/images/logo.png"
              alt="Dataset Request Desk logo"
              width={1983}
              height={793}
              priority
              className="h-12 w-[120px] object-contain"
            />
            <div>
              <p className="text-sm font-bold tracking-wide">FIELDNOTES <span className="font-medium text-brand-blue">/ DATA OPS</span></p>
              <p className="text-xs text-slate-500">Dataset Request Desk</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.full_name || user.email}</p>
              <p className="text-xs capitalize text-slate-500">{roleLabel}</p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft-blue text-sm font-semibold uppercase text-brand-blue">
              {(user.full_name || user.email).slice(0, 1)}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-body-text transition hover:bg-page-background"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
