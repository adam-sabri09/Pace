"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  icon: string;
};

// All nav items — used in the desktop sidebar (no size limit).
const ITEMS: Item[] = [
  { href: "/today", label: "Today", icon: "calendar_today" },
  { href: "/plan", label: "Plan", icon: "event_note" },
  { href: "/subjects", label: "Subjects", icon: "menu_book" },
  { href: "/coursework", label: "Coursework", icon: "description" },
  { href: "/analytics", label: "Analytics", icon: "insights" },
  { href: "/coach", label: "Coach", icon: "chat" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

// Subset shown in the mobile bottom nav — 5 max fits on a 375px screen.
// Settings is accessible via the gear icon in the TopAppBar instead.
// Analytics is desktop-only; Coursework is a core upload flow that must be reachable on mobile.
const MOBILE_ITEMS: Item[] = [
  { href: "/today", label: "Today", icon: "calendar_today" },
  { href: "/plan", label: "Plan", icon: "event_note" },
  { href: "/subjects", label: "Subjects", icon: "menu_book" },
  { href: "/coursework", label: "Coursework", icon: "description" },
  { href: "/coach", label: "Coach", icon: "chat" },
];

function isActive(pathname: string, href: string) {
  if (href === "/today") return pathname === "/today";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...ITEMS, { href: "/admin", label: "Admin", icon: "admin_panel_settings" }]
    : ITEMS;
  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex flex-col fixed left-0 top-0 h-full pt-stack-lg px-gutter w-64 bg-surface border-r border-outline-variant z-40"
    >
      <div className="mb-stack-lg px-2">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pace-icon.svg" alt="" width={28} height={28} className="rounded flex-shrink-0" aria-hidden="true" />
          <span className="font-display text-headline-md text-primary">Pace</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors " +
                  (active
                    ? "text-primary bg-secondary-container"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface")
                }
              >
                <span
                  className="material-symbols-outlined text-[20px] flex-shrink-0"
                  style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : { fontVariationSettings: "'wght' 300" }}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className={`font-label-md text-label-md ${active ? "font-semibold" : ""}`}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopAppBar() {
  const pathname = usePathname();
  const settingsActive = pathname === "/settings";
  return (
    <header className="md:hidden fixed top-0 left-0 w-full bg-surface border-b border-outline-variant px-container-margin z-40 flex items-center justify-between h-14">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pace-icon.svg" alt="" width={22} height={22} className="rounded flex-shrink-0" aria-hidden="true" />
        <span className="font-display text-headline-md text-primary">Pace</span>
      </div>
      <Link
        href="/settings"
        aria-label="Settings"
        aria-current={settingsActive ? "page" : undefined}
        className={
          "p-2 rounded-lg transition-colors " +
          (settingsActive
            ? "text-primary bg-secondary-container"
            : "text-on-surface-variant hover:bg-surface-container-low")
        }
      >
        <span
          className="material-symbols-outlined text-[20px]"
          style={settingsActive ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : { fontVariationSettings: "'wght' 300" }}
          aria-hidden="true"
        >
          settings
        </span>
      </Link>
    </header>
  );
}

export function BottomNav({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...MOBILE_ITEMS, { href: "/admin", label: "Admin", icon: "admin_panel_settings" }]
    : MOBILE_ITEMS;
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 w-full flex justify-around items-center px-2 py-1 md:hidden bg-surface border-t border-outline-variant z-50 pb-safe"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center justify-center min-w-[56px] py-2 gap-0.5"
          >
            <span
              className={`material-symbols-outlined text-[22px] transition-colors ${active ? "text-primary" : "text-on-surface-variant"}`}
              style={active ? { fontVariationSettings: "'FILL' 1, 'wght' 500" } : { fontVariationSettings: "'wght' 300" }}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span className={`font-label-sm text-label-sm transition-colors ${active ? "text-primary font-semibold" : "text-on-surface-variant"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
      <style>{`.pb-safe { padding-bottom: env(safe-area-inset-bottom); }`}</style>
    </nav>
  );
}
