import type { ReportSpec } from "@/types/report-spec";
import type { RenderMedium } from "@/modules/report/report.renderer";
import { DOMAIN_LEVEL_LABELS, ISSUE_ROLE_LABELS } from "@/lib/report-ui";
import { cn } from "@/lib/utils";

interface IssuesSectionProps {
  issues: ReportSpec["issues"];
  medium?: RenderMedium;
  compact?: boolean;
}

export function IssuesSection({
  issues,
  medium = "app",
  compact = false,
}: IssuesSectionProps) {
  if (issues.length === 0) return null;

  return (
    <section
      id="result-priorities"
      className={cn(
        "scroll-mt-8 rounded-2xl bg-white p-6 shadow-sm sm:p-8",
        medium === "print" && "print-avoid-break",
      )}
    >
      <h2 className="text-lg font-semibold text-zinc-900">مهم‌ترین اولویت‌ها</h2>
      <p className="mt-1 text-sm text-zinc-500">
        مهم‌ترین نقاطی که باید روی آن‌ها تمرکز کنید
      </p>
      <div className="mt-6 space-y-4">
        {issues.map((issue, index) => (
          <article
            key={`${issue.role}-${issue.engineId}`}
            className="rounded-xl border border-zinc-100 p-5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-medium text-emerald-800">
                اولویت {index + 1}
              </span>
              <span className="text-xs text-zinc-500">
                {ISSUE_ROLE_LABELS[issue.role]} ·{" "}
                {DOMAIN_LEVEL_LABELS[issue.level]}
              </span>
            </div>
            <h3 className="mt-3 font-semibold text-zinc-900">
              {issue.domainName}
            </h3>
            <p className="mt-2 text-sm leading-7 text-zinc-700">
              {issue.mechanism}
            </p>
            {!compact && (
              <>
                <p className="mt-3 text-sm leading-7 text-zinc-600">
                  {issue.rootSentence}
                </p>
                <p className="mt-3 rounded-lg bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-600">
                  {issue.costHint}
                </p>
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
