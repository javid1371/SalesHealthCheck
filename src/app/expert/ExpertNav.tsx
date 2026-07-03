"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/LinkButton";
import { ExpertLogoutButton } from "@/app/expert/consultations/ExpertLogoutButton";
import { AdminLogoutButton } from "@/app/admin/assessments/AdminLogoutButton";

const NAV_ITEMS = [
  { href: "/expert/dashboard", label: "داشبورد" },
  { href: "/expert/consultations", label: "لیدهای من" },
] as const;

interface ExpertNavProps {
  isAdmin?: boolean;
}

export function ExpertNav({ isAdmin = false }: ExpertNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4"
      aria-label="ناوبری پنل کارشناس"
    >
      <div className="flex flex-wrap gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/expert/dashboard" &&
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
      <div className="flex flex-wrap items-center gap-2">
        {isAdmin ? (
          <>
            <LinkButton href="/admin/dashboard" variant="secondary" size="sm">
              پنل ادمین
            </LinkButton>
            <AdminLogoutButton />
          </>
        ) : (
          <ExpertLogoutButton />
        )}
      </div>
    </nav>
  );
}
