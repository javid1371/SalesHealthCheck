"use client";

import { useState } from "react";
import type {
  DomainBreakdownViewModel,
  RenderMedium,
} from "@/modules/report/report.renderer";
import {
  DOMAIN_LEVEL_LABELS,
  domainLevelBarColor,
} from "@/lib/report-ui";
import { cn } from "@/lib/utils";

interface DomainAnatomyProps {
  domains: DomainBreakdownViewModel[];
  medium?: RenderMedium;
  onFixLockClick?: () => void;
}

function DomainCard({
  domain,
  medium = "app",
  onFixLockClick,
}: {
  domain: DomainBreakdownViewModel;
  medium?: RenderMedium;
  onFixLockClick?: DomainAnatomyProps["onFixLockClick"];
}) {
  const isPrint = medium === "print";
  const [expanded, setExpanded] = useState(isPrint ? true : domain.expanded);
  const isExpanded = isPrint || expanded;

  return (
    <article
      className={cn(
        "rounded-xl border border-zinc-100 p-4",
        isPrint && "print-avoid-break",
      )}
    >
      {isPrint ? (
        <div className="flex w-full items-start justify-between gap-4 text-right">
          <DomainCardHeader domain={domain} isExpanded={isExpanded} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-start justify-between gap-4 text-right"
        >
          <DomainCardHeader domain={domain} isExpanded={isExpanded} />
        </button>
      )}

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full ${domainLevelBarColor(domain.level)}`}
          style={{ width: `${domain.percentage}%` }}
        />
      </div>

      {isExpanded && (
        <div className="mt-5 space-y-5 border-t border-zinc-100 pt-5">
          <section>
            <p className="text-xs font-medium text-emerald-700">علائم</p>
            <p className="mt-2 text-sm leading-7 text-zinc-700">
              {domain.symptoms}
            </p>
          </section>

          {domain.evidence.length > 0 && (
            <section>
              <p className="text-xs font-medium text-emerald-700">
                شواهد از پاسخ‌های شما
              </p>
              <ul className="mt-3 space-y-3">
                {domain.evidence.map((item) => (
                  <li
                    key={`${domain.domainSlug}-${item.questionNumber}`}
                    className="rounded-lg bg-zinc-50 p-3 text-sm"
                  >
                    <p className="font-medium text-zinc-900">
                      سؤال {item.questionNumber}: {item.questionText}
                    </p>
                    <p className="mt-1 text-zinc-600">
                      {item.selectedOptionText}
                    </p>
                    <p className="mt-2 text-zinc-600">
                      {item.selectedInterpretation}
                    </p>
                    <p className="mt-2 text-zinc-500">{item.rootSentence}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <p className="text-xs font-medium text-emerald-700">تفسیر</p>
            <p className="mt-2 text-sm leading-7 text-zinc-700">
              {domain.interpretation}
            </p>
          </section>

          <section>
            <p className="text-xs font-medium text-emerald-700">
              اثر بر کسب‌وکار
            </p>
            <p className="mt-2 text-sm leading-7 text-zinc-700">
              {domain.qualitativeCost}
            </p>
          </section>

          <section>
            <p className="text-xs font-medium text-emerald-700">راهکار</p>
            {domain.fixLock.locked ? (
              <div className="mt-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-600">{domain.fixLock.label}</p>
                {!isPrint && onFixLockClick && (
                  <button
                    type="button"
                    onClick={() => onFixLockClick?.()}
                    className="mt-3 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    درخواست مشاوره برای دریافت راهکار
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm leading-7 text-emerald-800">
                {domain.fixLock.label}
              </p>
            )}
          </section>
        </div>
      )}

      {!isPrint && !isExpanded && (
        <p className="mt-3 text-xs font-medium text-emerald-700">
          برای جزئیات بیشتر روی عنوان کلیک کنید
        </p>
      )}
    </article>
  );
}

function DomainCardHeader({
  domain,
  isExpanded,
}: {
  domain: DomainBreakdownViewModel;
  isExpanded: boolean;
}) {
  return (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-zinc-900">{domain.domainName}</p>
          <span className="text-xs text-zinc-500">{domain.family}</span>
        </div>
        {!isExpanded && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600">
            {domain.collapsedSummary}
          </p>
        )}
      </div>
      <div className="shrink-0 text-left">
        <span className="text-sm font-semibold tabular-nums text-zinc-700">
          {Math.round(domain.percentage)}%
        </span>
        <p className="mt-1 text-xs text-zinc-500">
          {DOMAIN_LEVEL_LABELS[domain.level as keyof typeof DOMAIN_LEVEL_LABELS] ??
            domain.level}
        </p>
      </div>
    </>
  );
}

export function DomainAnatomy({
  domains,
  medium = "app",
  onFixLockClick,
}: DomainAnatomyProps) {
  const isPrint = medium === "print";

  return (
    <section
      className={cn(
        "rounded-2xl bg-white p-6 shadow-sm sm:p-8",
        isPrint && "print-avoid-break",
      )}
    >
      <h2 className="text-lg font-semibold text-zinc-900">جزئیات ۱۶ حوزه فروش</h2>
      <p className="mt-1 text-sm text-zinc-500">
        حوزه‌های ضعیف باز و حوزه‌های سالم جمع‌شده
      </p>
      <div className="mt-6 space-y-4">
        {domains.map((domain) => (
          <DomainCard
            key={domain.domainSlug}
            domain={domain}
            medium={medium}
            onFixLockClick={onFixLockClick}
          />
        ))}
      </div>
    </section>
  );
}
