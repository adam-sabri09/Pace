"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Authenticated shell: fixed left side nav on desktop, fixed bottom nav +
 * top app bar on mobile (DESIGN-SPEC.md §2.11–§2.13). Renders four items:
 * Today / Plan / Subjects / Settings. No notifications or search icons
 * per DECISIONS.md D29.
 */

type Item = {
  href: "/today" | "/plan" | "/subjects" | "/settings";
  label: string;
  icon: string;
};

const ITEMS: Item[] = [
  { href: "/today", label: "Today", icon: "calendar_today" },
  { href: "/plan", label: "Plan", icon: "event_note" },
  { href: "/subjects", label: "Subjects", icon: "menu_book" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function isActive(pathname: string, href: string) {
  if (href === "/today") return pathname === "/today";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex flex-col fixed left-0 top-0 h-full pt-stack-lg px-gutter w-64 bg-surface border-r border-outline-variant z-40"
    >
      <div className="mb-stack-lg px-2">
        <span className="font-display text-headline-md text-primary block">Pace</span>
        <p className="font-label-sm text-label-sm text-on-surface-variant mt-1 uppercase tracking-wider">
          The Quiet Mentor
        </p>
      </div>
      <ul className="flex flex-col gap-base">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex items-center gap-gutter px-4 py-3 rounded-lg transition-all " +
                  (active
                    ? "text-primary font-bold bg-secondary-container"
                    : "text-on-surface-variant hover:bg-surface-container-low")
                }
              >
                <span
                  className="material-symbols-outlined"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="font-label-md text-label-md">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopAppBar() {
  return (
    <header className="md:hidden fixed top-0 left-0 w-full bg-surface border-b border-outline-variant px-container-margin py-base z-40 flex items-center">
      <span className="font-display text-headline-md text-primary">Pace</span>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 w-full flex justify-around items-center px-2 py-2 md:hidden bg-surface border-t border-outline-variant z-50 pb-safe"
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={
              "flex flex-col items-center justify-center px-4 py-1 transition-transform duration-150 " +
              (active
                ? "bg-secondary-container text-on-secondary-container rounded-full scale-95"
                : "text-on-surface-variant hover:bg-surface-container-low rounded-full")
            }
          >
            <span
              className="material-symbols-outlined"
              style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span className="font-label-sm text-label-sm mt-1">{item.label}</span>
          </Link>
        );
      })}
      <style>{`.pb-safe { padding-bottom: env(safe-area-inset-bottom); }`}</style>
    </nav>
  );
}
