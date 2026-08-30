"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/sales", label: "Sales", icon: "🧾" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/products", label: "Stock", icon: "📦" },
  { href: "/expenses", label: "Expenses", icon: "💸" },
  { href: "/reports", label: "Reports", icon: "📊" },
  { href: "/ai", label: "AI", icon: "✨" },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="flex overflow-x-auto no-scrollbar">
        {ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 min-w-[64px] flex flex-col items-center justify-center py-2 text-xs font-medium ${
                active ? "text-brand" : "text-slate-400"
              }`}
            >
              <span className="text-lg leading-none mb-1">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
