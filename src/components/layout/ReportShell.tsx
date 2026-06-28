import { type ReactNode } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import {
  ReportMobileToc,
  type ReportTocItem,
} from "@/components/report/ReportMobileToc";

export type { ReportTocItem };

type ReportMaxWidth = "lg" | "xl" | "2xl" | "5xl";

interface ReportShellProps {
  title: string;
  subtitle?: string;
  maxWidth?: ReportMaxWidth;
  toc?: ReportTocItem[];
  children: ReactNode;
}

export function ReportShell({
  title,
  subtitle,
  maxWidth = "2xl",
  toc,
  children,
}: ReportShellProps) {
  const hasToc = toc !== undefined && toc.length > 0;

  return (
    <PageLayout title={title} subtitle={subtitle} maxWidth={maxWidth}>
      {hasToc ? (
        <>
          <ReportMobileToc items={toc} />
          <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[12rem_minmax(0,1fr)]">
            <nav
              className="mb-6 hidden lg:block"
              aria-label="فهرست گزارش"
            >
              <ul className="sticky top-8 space-y-2 border-r border-zinc-100 pr-4 text-sm">
                {toc.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className="block py-1 text-zinc-600 transition hover:text-emerald-700"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div>{children}</div>
          </div>
        </>
      ) : (
        children
      )}
    </PageLayout>
  );
}
