"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AdminLogoutButton } from "@/app/admin/assessments/AdminLogoutButton";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "داشبورد" },
  { href: "/admin/assessments", label: "ارزیابی‌ها" },
  { href: "/admin/sms-funnel", label: "قیف پیامکی" },
  { href: "/expert/consultations", label: "لیدها" },
  { href: "/admin/staff", label: "کاربران" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4"
      aria-label="ناوبری پنل ادمین"
    >
      <div className="flex flex-wrap gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin/dashboard" &&
              pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <AdminLogoutButton />
    </nav>
  );
}
