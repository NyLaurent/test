"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChartNoAxesCombined,
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  Plus,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

type PortalSection = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const clientSections: PortalSection[] = [
  { label: "Overview", href: "#overview", icon: LayoutDashboard },
  { label: "My requests", href: "#requests", icon: ClipboardList },
  { label: "New request", href: "#new-request", icon: Plus },
];

const operationsSections: PortalSection[] = [
  { label: "Overview", href: "#overview", icon: LayoutDashboard },
  { label: "Request queue", href: "#requests", icon: ClipboardList },
  { label: "Episode inventory", href: "#episodes", icon: Database },
  { label: "Analytics", href: "#analytics", icon: ChartNoAxesCombined },
];

export function PortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState("#overview");

  if (!user) return null;

  const isClient = user.role === "client";
  const sections = isClient ? clientSections : operationsSections;
  const roleLabel = isClient ? "Client portal" : user.role === "admin" ? "Admin portal" : "Operator portal";
  const displayName = user.full_name || user.email;

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-page-background text-brand-navy lg:flex">
      <aside className="hidden w-[264px] shrink-0 border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex h-[88px] items-center gap-3 border-b border-border px-6">
          <Image
            src="/assets/images/logo.png"
            alt="Dataset Request Desk logo"
            width={1983}
            height={793}
            priority
            className="h-10 w-[88px] object-contain"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-navy">Dataset Desk</p>
            <p className="mt-0.5 text-xs text-muted-text">{roleLabel}</p>
          </div>
        </div>

        <nav aria-label="Workspace navigation" className="flex-1 space-y-1 px-3 py-6">
          <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-text">
            Workspace
          </p>
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <a
                key={section.href}
                href={section.href}
                aria-current={activeSection === section.href ? "page" : undefined}
                onClick={() => setActiveSection(section.href)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  activeSection === section.href
                    ? "bg-brand-soft-blue font-medium text-brand-blue"
                    : "text-body-text hover:bg-page-background hover:text-brand-navy"
                }`}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                {section.label}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <UserAvatar name={displayName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-brand-navy">{displayName}</p>
              <p className="truncate text-xs text-muted-text">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-2 text-muted-text transition hover:bg-page-background hover:text-brand-navy"
            >
              <LogOut aria-hidden="true" size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="border-b border-border bg-surface">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-5 sm:px-8">
            <div className="flex items-center gap-3 lg:hidden">
              <Image
                src="/assets/images/logo.png"
                alt="Dataset Request Desk logo"
                width={1983}
                height={793}
                priority
                className="h-9 w-[78px] object-contain"
              />
              <span className="h-7 w-px bg-border" aria-hidden="true" />
              <span className="text-sm font-medium text-brand-navy">{roleLabel}</span>
            </div>
            <div className="hidden items-center gap-2 text-sm lg:flex">
              <span className="text-muted-text">{user.role === "client" ? "Client" : "Operations"}</span>
              <span className="text-border">/</span>
              <span className="font-medium text-brand-blue">Overview</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-muted-text sm:inline">{user.email}</span>
              <UserAvatar name={displayName} />
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-body-text transition hover:bg-page-background lg:hidden"
              >
                Sign out
              </button>
            </div>
          </div>
          <nav aria-label="Workspace navigation" className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <a
                  key={section.href}
                  href={section.href}
                  aria-current={activeSection === section.href ? "page" : undefined}
                  onClick={() => setActiveSection(section.href)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
                    activeSection === section.href ? "bg-brand-soft-blue text-brand-blue" : "text-body-text hover:bg-page-background"
                  }`}
                >
                  <Icon aria-hidden="true" size={15} />
                  {section.label}
                </a>
              );
            })}
          </nav>
        </header>
        <main className="w-full flex-1 px-5 py-7 sm:px-8 sm:py-9">{children}</main>
        <footer className="border-t border-border px-5 py-4 text-xs text-muted-text sm:px-8">
          Dataset Request Desk <span className="px-1.5 text-border">/</span> Robotics data operations
        </footer>
      </div>
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-page-background text-xs font-semibold uppercase text-body-text">
      {name.slice(0, 2)}
    </span>
  );
}
