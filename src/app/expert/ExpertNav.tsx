"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/LinkButton";
import { ExpertLogoutButton } from "@/app/expert/consultations/ExpertLogoutButton";
import { AdminLogoutButton } from "@/app/admin/assessments/AdminLogoutButton";

const NAV_ITEMS = [
  {
    href: "/expert/dashboard",
    label: "امروز",
    kind: "today" as const,
  },
  {
    href: "/expert/consultations",
    label: "لیدهای من",
    kind: "mine" as const,
  },
  {
    href: "/expert/consultations?onlyTeamQueue=true",
    label: "صف تیم",
    kind: "team" as const,
  },
] as const;

interface ExpertNavProps {
  isAdmin?: boolean;
}

function ExpertNavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isTeamQueueActive =
    pathname.startsWith("/expert/consultations") &&
    searchParams.get("onlyTeamQueue") === "true";

  return (
    <div className="flex flex-wrap gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.kind === "today"
            ? pathname === "/expert/dashboard"
            : item.kind === "team"
              ? isTeamQueueActive
              : pathname.startsWith("/expert/consultations") &&
                !isTeamQueueActive;

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
  );
}

function ExpertNavLinksFallback() {
  return (
    <div className="flex flex-wrap gap-1">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="rounded-full px-4 py-2 text-sm font-medium text-zinc-600"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function ExpertNav({ isAdmin = false }: ExpertNavProps) {
  return (
    <div className="mb-6">
      {isAdmin ? (
        <div
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
          role="status"
        >
          <p className="font-medium text-amber-950">
            در حال مشاهده نمای کارشناس به‌عنوان ادمین
          </p>
          <Link
            href="/admin/dashboard"
            className="font-medium text-amber-900 underline-offset-2 hover:underline"
          >
            بازگشت به پنل ادمین
          </Link>
        </div>
      ) : null}
      <nav
        className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4"
        aria-label="ناوبری پنل کارشناس"
      >
        <Suspense fallback={<ExpertNavLinksFallback />}>
          <ExpertNavLinks />
        </Suspense>
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
    </div>
  );
}
