"use client";

import { useState } from "react";
import type {
  DomainBreakdownViewModel,
  RenderMedium,
} from "@/modules/report/report.renderer";
import type {
  DomainQuickWinAction,
  DomainRootCause,
} from "@/types/report-spec";
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

function hasText(value?: string | null): value is string {
  return Boolean(value?.trim());
}

function RootCauseCard({ rootCause }: { rootCause: DomainRootCause }) {
  return (
    <li className="rounded-lg border border-amber-100 bg-amber-50/60 p-4">
      {hasText(rootCause.rootTitle) && (
        <p className="text-sm font-medium text-zinc-900">{rootCause.rootTitle}</p>
      )}
      {hasText(rootCause.publicRootSentence) && (
        <div className="mt-3">
          <p className="text-xs font-medium text-amber-800">ریشه احتمالی</p>
          <p className="mt-1 text-sm leading-7 text-zinc-700">
            {rootCause.publicRootSentence}
          </p>
        </div>
      )}
      {hasText(rootCause.mechanism) && (
        <div className="mt-3">
          <p className="text-xs font-medium text-amber-800">
            چرا این اتفاق روی فروش اثر می‌گذارد؟
          </p>
          <p className="mt-1 text-sm leading-7 text-zinc-700">
            {rootCause.mechanism}
          </p>
        </div>
      )}
      {hasText(rootCause.salesImpact) && (
        <div className="mt-3">
          <p className="text-xs font-medium text-amber-800">اثر روی فروش</p>
          <p className="mt-1 text-sm leading-7 text-zinc-700">
            {rootCause.salesImpact}
          </p>
        </div>
      )}
      {rootCause.evidence.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rootCause.evidence.map((item, index) => (
            <li
              key={`${rootCause.rootId}-evidence-${item.questionNumber ?? index}`}
              className="rounded-md bg-white/80 p-3 text-sm"
            >
              {hasText(item.questionText) && (
                <p className="font-medium text-zinc-900">{item.questionText}</p>
              )}
              {hasText(item.selectedOptionText) && (
                <p className="mt-1 text-zinc-600">{item.selectedOptionText}</p>
              )}
              {hasText(item.publicReflection) && (
                <p className="mt-2 text-zinc-600">{item.publicReflection}</p>
              )}
              {hasText(item.evidenceSentence) && (
                <p className="mt-2 text-zinc-500">{item.evidenceSentence}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function DomainQuickWinActionSection({
  action,
}: {
  action: DomainQuickWinAction;
}) {
  return (
    <div className="mt-2 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
      <p className="text-xs font-medium text-emerald-800">برد سریع پیشنهادی</p>
      {hasText(action.actionTitle) && (
        <p className="text-sm font-medium text-zinc-900">{action.actionTitle}</p>
      )}
      {hasText(action.quickWinSummary) && (
        <p className="text-sm leading-7 text-zinc-700">{action.quickWinSummary}</p>
      )}
      {hasText(action.fullAction) && (
        <div>
          <p className="text-xs font-medium text-emerald-800">اقدام کامل</p>
          <p className="mt-1 text-sm leading-7 text-zinc-700">{action.fullAction}</p>
        </div>
      )}
    </div>
  );
}

function DomainLockedActionSection({
  teaser,
  isPrint,
  onFixLockClick,
}: {
  teaser: string;
  isPrint: boolean;
  onFixLockClick?: () => void;
}) {
  return (
    <div className="mt-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4">
      <p className="text-xs font-medium text-zinc-500">چطور درستش کنیم؟</p>
      <p className="mt-2 text-sm leading-7 text-zinc-700">{teaser}</p>
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
  );
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
  const rootCauses = domain.rootCauses ?? [];
  const showQuickWinAction = Boolean(domain.quickWinAction);
  const showLockedTeaser =
    !showQuickWinAction && hasText(domain.lockedActionTeaser);

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
          {hasText(domain.levelHeadline) && (
            <section>
              <p className="text-xs font-medium text-emerald-700">وضعیت این حوزه</p>
              <p className="mt-2 text-sm font-medium leading-7 text-zinc-800">
                {domain.levelHeadline}
              </p>
            </section>
          )}

          <section>
            <p className="text-xs font-medium text-emerald-700">علائم</p>
            {domain.symptomsList && domain.symptomsList.length > 0 ? (
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-7 text-zinc-700">
                {domain.symptomsList.map((symptom) => (
                  <li key={symptom}>{symptom}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm leading-7 text-zinc-700">
                {domain.symptoms}
              </p>
            )}
          </section>

          {domain.evidence.length > 0 && rootCauses.length === 0 && (
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

          {rootCauses.length > 0 && (
            <section>
              <p className="text-xs font-medium text-emerald-700">
                ریشه‌های احتمالی
              </p>
              <ul className="mt-3 space-y-3">
                {rootCauses.map((rootCause) => (
                  <RootCauseCard key={rootCause.rootId} rootCause={rootCause} />
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
            {showQuickWinAction && domain.quickWinAction ? (
              <>
                <p className="mt-2 text-sm leading-7 text-emerald-800">
                  {domain.fixLock.label}
                </p>
                <DomainQuickWinActionSection action={domain.quickWinAction} />
              </>
            ) : showLockedTeaser ? (
              <>
                <p className="mt-2 text-sm text-zinc-600">{domain.fixLock.label}</p>
                <DomainLockedActionSection
                  teaser={domain.lockedActionTeaser!}
                  isPrint={isPrint}
                  onFixLockClick={onFixLockClick}
                />
              </>
            ) : domain.fixLock.locked ? (
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
            {hasText(domain.levelHeadline)
              ? domain.levelHeadline
              : domain.collapsedSummary}
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
