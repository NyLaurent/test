"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";

type PortalSection = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
};

const clientSections: PortalSection[] = [
  { label: "Overview", href: "/portal", icon: LayoutDashboard },
  { label: "My requests", href: "/portal/requests", icon: ClipboardList },
  { label: "Profile", href: "/portal/profile", icon: UserRound },
];

const operationsSections: PortalSection[] = [
  { label: "Overview", href: "/portal", icon: LayoutDashboard },
  { label: "Request queue", href: "/portal/requests", icon: ClipboardList },
  { label: "Episode inventory", href: "/portal/episodes", icon: Database },
  { label: "Analytics", href: "/portal/analytics", icon: ChartNoAxesCombined },
];

const routeTitles: Record<string, string> = {
  "/portal": "Overview",
  "/portal/requests": "Requests",
  "/portal/requests/new": "New request",
  "/portal/episodes": "Episode inventory",
  "/portal/analytics": "Analytics",
  "/portal/profile": "Profile",
};

export function PortalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [profileOpenAtPath, setProfileOpenAtPath] = useState<string | null>(null);
  const [mobileNavOpenAtPath, setMobileNavOpenAtPath] = useState<string | null>(null);
  const [logoutConfirmationOpen, setLogoutConfirmationOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const cancelLogout = useCallback(() => setLogoutConfirmationOpen(false), []);
  const profileOpen = profileOpenAtPath === pathname;
  const mobileNavOpen = mobileNavOpenAtPath === pathname;

  useEffect(() => {
    if (!profileOpen && !mobileNavOpen) return;

    function dismissMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setProfileOpenAtPath(null);
        setMobileNavOpenAtPath(null);
      } else if (
        event instanceof MouseEvent &&
        profileOpen &&
        !profileMenuRef.current?.contains(event.target as Node)
      ) {
        setProfileOpenAtPath(null);
      }
    }

    document.addEventListener("mousedown", dismissMenu);
    document.addEventListener("keydown", dismissMenu);
    return () => {
      document.removeEventListener("mousedown", dismissMenu);
      document.removeEventListener("keydown", dismissMenu);
    };
  }, [mobileNavOpen, profileOpen]);

  if (!user) return null;

  const isClient = user.role === "client";
  const sections = isClient ? clientSections : operationsSections;
  const roleLabel = isClient ? "Client portal" : user.role === "admin" ? "Admin portal" : "Operator portal";
  const displayName = user.full_name || user.email;
  const pageTitle = routeTitles[pathname] ?? "Workspace";

  function requestLogout() {
    setProfileOpenAtPath(null);
    setMobileNavOpenAtPath(null);
    setLogoutConfirmationOpen(true);
  }

  function confirmLogout() {
    setLogoutConfirmationOpen(false);
    logout();
    router.replace("/login");
  }

  function isActive(href: string) {
    return pathname === href;
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
            const active = isActive(section.href);
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-brand-soft-blue font-medium text-brand-blue"
                    : "text-body-text hover:bg-page-background hover:text-brand-navy"
                }`}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                {section.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <Link
            href="/portal/profile"
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-page-background"
          >
            <UserAvatar name={displayName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-brand-navy">{displayName}</p>
              <p className="truncate text-xs text-muted-text">{user.email}</p>
            </div>
          </Link>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-surface">
          <div className="flex min-h-[64px] items-center justify-between gap-3 px-4 sm:min-h-[72px] sm:gap-4 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileNavOpen}
                aria-controls="portal-mobile-navigation"
                onClick={() => setMobileNavOpenAtPath((openPath) => openPath === pathname ? null : pathname)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-body-text transition hover:bg-page-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue lg:hidden"
              >
                {mobileNavOpen ? <X aria-hidden="true" size={19} /> : <Menu aria-hidden="true" size={19} />}
              </button>
              <Image
                src="/assets/images/logo.png"
                alt="Dataset Request Desk logo"
                width={1983}
                height={793}
                priority
                className="hidden h-8 w-[68px] shrink-0 object-contain sm:block sm:h-9 sm:w-[78px] lg:hidden"
              />
              <div className="flex min-w-0 items-center gap-1.5 text-xs sm:gap-2 sm:text-sm">
                <span className="hidden text-muted-text sm:inline">{isClient ? "Client" : "Operations"}</span>
                <span className="hidden text-border sm:inline">/</span>
                <span className="truncate font-medium text-brand-navy">{pageTitle}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                title="Notifications are not available yet"
                aria-label="Notifications are not available yet"
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-text sm:flex"
              >
                <Bell aria-hidden="true" size={19} strokeWidth={1.8} />
              </span>
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  aria-label="Open profile menu"
                  onClick={() => setProfileOpenAtPath((openPath) => openPath === pathname ? null : pathname)}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface p-1 pr-2 transition hover:bg-page-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                >
                  <UserAvatar name={displayName} />
                  <ChevronDown aria-hidden="true" size={15} className="text-muted-text" />
                </button>
                {profileOpen ? (
                  <div
                    role="menu"
                    aria-label="Profile menu"
                    className="absolute right-0 top-[calc(100%+10px)] z-50 w-[260px] rounded-xl border border-border bg-surface p-2"
                  >
                    <div className="border-b border-border px-3 py-3">
                      <p className="truncate text-sm font-semibold text-brand-navy">{displayName}</p>
                      <p className="mt-1 truncate text-xs text-muted-text">{user.email}</p>
                      <p className="mt-2 text-[11px] font-medium capitalize tracking-wide text-muted-text">{user.role}</p>
                    </div>
                    <Link
                      href="/portal/profile"
                      role="menuitem"
                      onClick={() => setProfileOpenAtPath(null)}
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-body-text hover:bg-page-background"
                    >
                      <UserRound aria-hidden="true" size={16} />
                      Profile
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={requestLogout}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-status-bad hover:bg-status-bad/5"
                    >
                      <LogOut aria-hidden="true" size={16} />
                      Log out
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMobileNavOpenAtPath(null)}
              className="absolute inset-0 h-full w-full cursor-default bg-brand-navy/35 backdrop-blur-[2px]"
            />
            <aside
              id="portal-mobile-navigation"
              aria-label="Mobile workspace navigation"
              className="relative flex h-full w-[min(19rem,85vw)] flex-col border-r border-border bg-surface"
            >
              <div className="flex h-[72px] items-center justify-between border-b border-border px-5">
                <div className="flex items-center gap-3">
                  <Image src="/assets/images/logo.png" alt="Dataset Request Desk logo" width={1983} height={793} className="h-9 w-[78px] object-contain" />
                  <div className="h-8 w-px bg-border" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-brand-navy">Dataset Desk</p>
                    <p className="text-xs text-muted-text">{roleLabel}</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close navigation menu"
                  onClick={() => setMobileNavOpenAtPath(null)}
                  className="rounded-lg p-2 text-muted-text hover:bg-page-background hover:text-brand-navy"
                >
                  <X aria-hidden="true" size={19} />
                </button>
              </div>
              <nav aria-label="Workspace navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
                <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-text">Workspace</p>
                {sections.map((section) => {
                  const Icon = section.icon;
                  const active = isActive(section.href);
                  return (
                    <Link
                      key={section.href}
                      href={section.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileNavOpenAtPath(null)}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                        active ? "bg-brand-soft-blue font-medium text-brand-blue" : "text-body-text hover:bg-page-background hover:text-brand-navy"
                      }`}
                    >
                      <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                      {section.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-border p-4">
                <Link
                  href="/portal/profile"
                  onClick={() => setMobileNavOpenAtPath(null)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-page-background"
                >
                  <UserAvatar name={displayName} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-brand-navy">{displayName}</p>
                    <p className="truncate text-xs text-muted-text">{user.email}</p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={requestLogout}
                  className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-status-bad hover:bg-status-bad/5"
                >
                  <LogOut aria-hidden="true" size={17} />
                  Log out
                </button>
              </div>
            </aside>
          </div>
        ) : null}
        <main className="w-full min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-9">{children}</main>
        <footer className="border-t border-border px-5 py-4 text-xs text-muted-text sm:px-8">
          Dataset Request Desk <span className="px-1.5 text-border">/</span> Robotics data operations
        </footer>
      </div>
      <ConfirmationModal
        open={logoutConfirmationOpen}
        title="Log out of your account?"
        description="Are you sure you want to log out? You will need to sign in again to access your workspace."
        confirmLabel="Log out"
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
        isDestructive
      />
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
