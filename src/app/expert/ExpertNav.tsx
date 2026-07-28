"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/LinkButton";
import { ExpertLogoutButton } from "@/app/expert/consultations/ExpertLogoutButton";
import { AdminLogoutButton } from "@/app/admin/assessments/AdminLogoutButton";

const CALL_QUEUE_HREF =
  "/expert/consultations?excludeAssessmentInProgress=true";

const NAV_ITEMS = [
  {
    href: "/expert/dashboard",
    label: "داشبورد",
    matchPath: "/expert/dashboard",
  },
  {
    href: "/expert/consultations",
    label: "لیدهای من",
    matchPath: "/expert/consultations",
  },
  {
    href: CALL_QUEUE_HREF,
    label: "صف تماس",
    matchPath: "/expert/consultations",
    callQueue: true,
  },
] as const;

interface ExpertNavProps {
  isAdmin?: boolean;
}

function ExpertNavLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCallQueueActive =
    pathname.startsWith("/expert/consultations") &&
    searchParams.get("excludeAssessmentInProgress") === "true";

  return (
    <div className="flex flex-wrap gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          "callQueue" in item && item.callQueue
            ? isCallQueueActive
            : item.matchPath === "/expert/dashboard"
              ? pathname === item.matchPath
              : pathname.startsWith(item.matchPath) && !isCallQueueActive;

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
    <nav
      className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-4"
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
  );
}
