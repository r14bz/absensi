"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({
  name,
  nav,
  extra,
  children,
}: {
  name: string;
  nav: NavItem[];
  extra?: NavItem;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  async function logout() {
    await getBrowserClient().auth.signOut();
    window.location.assign("/login");
  }

  const items = extra ? [...nav, extra] : nav;

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 pb-10">
      <header className="flex items-center justify-between gap-3 py-4">
        <p className="truncate text-sm text-gray-600 dark:text-gray-400">
          Halo, <span className="font-semibold text-gray-900 dark:text-gray-100">{name}</span>
        </p>
        <button type="button" onClick={logout} className="btn-ghost shrink-0">
          Keluar
        </button>
      </header>
      <nav aria-label="Navigasi utama" className="-mx-1 mb-6 flex gap-1 overflow-x-auto pb-1">
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={
                "whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition " +
                (active
                  ? "bg-brand-600 text-white"
                  : "text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800")
              }
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
