"use client";

import { useEffect, useRef } from "react";
import { ProgressBar } from "@/components/assessment/ProgressBar";
import {
  SaveStatusIndicator,
  type SaveStatus,
} from "@/components/assessment/SaveStatusIndicator";
import { StickyZone } from "@/components/ui/StickyZone";
import { SITE_HEADER_SELECTOR } from "@/lib/assessment-scroll";

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl";

interface AssessmentProgressHeaderProps {
  overall: { current: number; total: number; label?: string };
  domain?: {
    current: number;
    total: number;
    domainIndex: number;
    domainTotal: number;
    domainName?: string;
  };
  saveStatus?: SaveStatus;
  maxWidth?: MaxWidth;
}

const PROGRESS_HEIGHT_VAR = "--assessment-progress-height";
const HEADER_HEIGHT_VAR = "--header-height";
const FALLBACK_PROGRESS_HEIGHT = "9rem";
const FALLBACK_HEADER_HEIGHT = "calc(env(safe-area-inset-top) + 3.25rem)";

function findCssVariableRoot(): HTMLElement {
  return document.documentElement;
}

export function AssessmentProgressHeader({
  overall,
  domain,
  saveStatus = "idle",
  maxWidth = "lg",
}: AssessmentProgressHeaderProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const stickyEl = content.parentElement;
    if (!stickyEl) return;

    const cssRoot = findCssVariableRoot();
    const siteHeader = document.querySelector(SITE_HEADER_SELECTOR);

    const updateMetrics = () => {
      cssRoot.style.setProperty(
        PROGRESS_HEIGHT_VAR,
        `${stickyEl.offsetHeight}px`,
      );
      if (siteHeader instanceof HTMLElement) {
        cssRoot.style.setProperty(
          HEADER_HEIGHT_VAR,
          `${siteHeader.offsetHeight}px`,
        );
      }
    };

    updateMetrics();

    const observer = new ResizeObserver(updateMetrics);
    observer.observe(stickyEl);
    if (siteHeader instanceof HTMLElement) {
      observer.observe(siteHeader);
    }

    return () => {
      observer.disconnect();
      cssRoot.style.setProperty(PROGRESS_HEIGHT_VAR, FALLBACK_PROGRESS_HEIGHT);
      cssRoot.style.setProperty(HEADER_HEIGHT_VAR, FALLBACK_HEADER_HEIGHT);
    };
  }, []);

  return (
    <StickyZone
      position="top"
      mode="fixed"
      maxWidth={maxWidth}
      data-assessment-progress
    >
      <div ref={contentRef} className="relative space-y-3 py-3">
        {saveStatus !== "idle" && (
          <SaveStatusIndicator
            status={saveStatus}
            className="absolute end-0 top-3"
          />
        )}
        {domain && (
          <p className="min-w-0 break-words text-sm text-foreground-muted">
            دامنه {domain.domainIndex} از {domain.domainTotal}
            {domain.domainName ? ` — ${domain.domainName}` : ""}
          </p>
        )}
        <ProgressBar
          compact
          label={overall.label ?? "پیشرفت کلی"}
          current={overall.current}
          total={overall.total}
        />
        {domain && (
          <ProgressBar
            compact
            label="پیشرفت این بخش"
            current={domain.current}
            total={domain.total}
            showPercentage
          />
        )}
      </div>
    </StickyZone>
  );
}
